import express from 'express';
import pg from 'pg';
import { createClient } from 'redis';
import { waitForPg, waitForRedis } from './wait.js';
import axios from 'axios';

import { publish } from "./redis.js";

const app = express();
app.use(express.json());

const CHANNEL = "seat-released";
const queueName = process.env.QUEUE_NAME || 'refundRequests'
const pipeline = process.env.PIPELINE || 'team-03'
const ttlSec = Number(process.env.IDEM_TTL_SEC || '86400')


const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || "postgres://user:pass@refund-db:5432/refunddb" });
const redis = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
await waitForPg(pool, 'refunds');
await waitForRedis(redis, 'refunds');

function jobKey(refundId) {
  return `job:${pipeline}:${refundId}`
}

function effectKey(refundId) {
  return `effect:${pipeline}:${refundId}`
}

function processedKey(refundId) {
  return `processed:${pipeline}:${refundId}`
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function applySideEffect(refundRequestId, purchaseId) {
  /* TODO

  // edit database
  const result = await pool.query(
    'INSERT INTO refunds (refundRequestId, purchaseId, success) VALUES ($1, $2) RETURNING *',
    [refundRequestId, purchaseId, true]
  );
  const post = result.rows[0];

  //publish on REDIS
  await publish(CHANNEL,post);

  */
  const delayMs = 1000;
  await sleep(delayMs)

  const effectCount = await redis.incr(effectKey(refundRequestId))
  await redis.expire(effectKey(refundRequestId), ttlSec)

  return { delayMs, effectCount }
}

console.log("started refund service");

app.get('/health', async (req, res) => {
  const pgCheck = await pool.query('SELECT 1');
  if (pgCheck==null) {
    res.status(503).json({ ok: false, status: 'db-not-ready', service: 'refund' })
    return;
  }

  try {
    await redis.ping()
    res.status(200).json({ ok: true, status: 'ok', service: 'refund' })
  } catch {
    res.status(503).json({ ok: false, status: 'redis-not-ready', service: 'refund' })
  }
  
  //console.log("received health check")
  //res.json({ ok: true, service: 'refund' });
});

app.post('/refund-request', async (req, res) => {

  //Extract information
  const { refundRequestId , purchaseId  } = req.body;

  // set request to processing
  await redis.hSet(jobKey(refundRequestId), {
    status: 'processing',
    updatedAt: new Date().toISOString(), //now
    pipeline,
  })
  await redis.hIncrBy(jobKey(refundRequestId), 'processAttempts', 1)
  await redis.expire(jobKey(refundRequestId), ttlSec)

  // idempotency check on refund id
  const claimed = await redis.set(processedKey(refundRequestId), '1', {
    NX: true,
    EX: ttlSec,
  })

  if (!claimed) {
    await redis.hSet(jobKey(refundRequestId), {
      status: 'duplicate-skipped',
      updatedAt: new Date().toISOString(),
      idempotency: 'skipped',
    })
    await redis.hIncrBy(jobKey(refundRequestId), 'duplicateSkips', 1)
    console.log(`pipeline=${pipeline} job=${refundRequestId} duplicate-skipped`)
    res.status(400).json({
      refundRequestId:refundRequestId, 
      purchaseId:purchaseId, 
      success:false,
      duplicate:true
    });
    return;
  }

  /* TODO

  Check with ticket purchase to see if purchaseId exists and if is complete 
  const { data } = await axios.post('http://purchase-service:3002/purchaseOrSomething', req.body);

  if purchase doesn't exist or is still processing:
    console.log(`pipeline=${pipeline} job=${refundRequestId} purchase not found`)
    return error 404

  */
  const { delayMs, effectCount } = await applySideEffect(refundRequestId, purchaseId)
  const doneAt = new Date().toISOString()
  await redis.hSet(jobKey(refundRequestId), {
    status: 'done',
    updatedAt: doneAt,
    finishedAt: doneAt,
    effectCount: String(effectCount),
    idempotency: 'applied',
  }) 
  console.log(`refund job=${refundRequestId} status=done effectCount=${effectCount} delayMs=${delayMs}`)
  res.status(200).json({
    refundRequestId:refundRequestId, 
    purchaseId:purchaseId, 
    success:true
  });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Refund service listening on :${port}`);
});

/*
docker compose exec holmes bash

k6 run /workspace/k6/sprint-3-poison.js
curl http://fraud-worker:3000/health | jq .

mkdir -p results
k6 run --summary-export results/k6-sprint-2-async-output-summary.json /workspace/k6/sprint-2-async.js | tee results/k6-sprint-2-async-output.txt

healthcheck http://purchase-service:3001/health
curl http://refund-service:3005/health | jq .
curl http://analytics-worker:3000/health | jq

curl -s -X GET http://event-cat-service:3001/events/0e350ac0-a8f1-4a7a-9191-806716cc6181 \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" \

curl -s -X POST http://refund-service:3005/refund-request \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" \
  -d '{"refundRequestId": "refund-004", "purchaseId": "purchase-001"}' | jq .

curl -s -X POST http://payment-service:3001/payments \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" \
  -d '{"purchase_id": "test-purchase-idem-1", "amount": 2, "cardToken": "test-card-1"}' | jq .

curl -s -X POST http://purchase-service:3001/purchases \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" \
  -d '{"purchaseId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "userId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "eventId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "quantity": 2, "cardToken": "test-card-1"}' | jq .
*/
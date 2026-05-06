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
const CHECK_PURCHASE_URL = process.env.CHECK_PURCHASE_URL || 'http://purchase-service:3001/purchases/'
const REVERSE_PAYMENT_URL = process.env.REVERSE_PAYMENT_URL || 'http://payment-service:3001/payments/reverse'
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

  // edit database
  const result = await pool.query(
    'INSERT INTO refunds (refundRequestId, purchaseId, success, failureReason) VALUES ($1, $2, $3, $4) RETURNING *',
    [refundRequestId, purchaseId, true, ""]
  );
  const post = result.rows[0];

  // contact POST http://payment-service:3001/payments/reverse with purchaseId
  await axios.post(REVERSE_PAYMENT_URL, {
    purchase_id:purchaseId,
    refund_id:refundRequestId //in case you need it
  }).then(response => {
    if (response.status === 404) {
      console.error(`Purchase ${purchaseId} not found in payment service`)
      return;
    }
    console.log("purchase ", purchaseId, " payment reversed!");
  }).catch(error => {
    console.error('Error in refunds: error signalling for payment reversal', error);
  });

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
  console.log("received refund request")
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
    return res.status(404).json({
      refundRequestId:refundRequestId, 
      purchaseId:purchaseId, 
      success:false,
      failureReason:"idempotency_skip"
    });
  }

  //Check with ticket purchase to see if purchaseId exists and if is complete 
  let purchaseExists = false
  await axios.get(CHECK_PURCHASE_URL+purchaseId).then(response => {
    console.log("got data:", response.data);
    purchaseExists = true;
  }).catch(error => {
    if (error.status==404) {
      purchaseExists = false;
    }
    else{
      purchaseExists = false;
      console.error('Error in refunds: error fetching purchase data:', error);
    }
  });
  if (!purchaseExists) {
    console.log(`pipeline=${pipeline} job=${refundRequestId} purchase not found`)
    const result = await pool.query(
      'INSERT INTO refunds (refundRequestId, purchaseId, success, failureReason) VALUES ($1, $2, $3, $4) RETURNING *',
      [refundRequestId, purchaseId, false, "purchase_missing"]
    );
    return res.status(400).json({
      refundRequestId:refundRequestId, 
      purchaseId:purchaseId, 
      success:false,
      failureReason:"purchase_missing"
    });
  }

  // Check refund database to see if this purchase has been reversed already by someone else
  const exists = await pool.query(
    'SELECT 1 FROM refunds WHERE purchaseId = $1',
    [purchaseId]
  );
  if (exists.rows.length > 0) {
    console.log(`refund service already refunded purchase ${purchaseId}, skipping`);
    return res.status(202).json({
      refundRequestId:refundRequestId, 
      purchaseId:purchaseId, 
      success:false,
      failureReason:"already_refunded"
    });
  }

  // All OK! go through with refund
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

await pool.query(`
  CREATE TABLE IF NOT EXISTS refunds (
    refundRequestId TEXT NOT NULL,
    purchaseId TEXT NOT NULL, 
    success BOOLEAN NOT NULL,
    failureReason TEXT NOT NULL
  );
`);

/*
docker compose exec holmes bash

k6 run /workspace/k6/sprint-3-poison.js
curl http://fraud-worker:3000/health | jq .

psql postgres://user:pass@refund-db:5432/refunddb
psql postgres://user:pass@purchase-db:5432/purchasedb

SELECT table_name
  FROM information_schema.tables
 WHERE table_schema='public'
   AND table_type='BASE TABLE';

SELECT * FROM refunds;

mkdir -p results
k6 run --summary-export results/k6-sprint-4-scale-output-summary.json /workspace/k6/sprint-4-scale.js | tee results/k6-sprint-4-scale-output.txt

healthcheck http://purchase-service:3001/health
curl http://purchase-service:3001/health | jq .
curl http://analytics-worker:3001/health | jq
redis-cli -h redis RPUSH analytics-queue '{"this": "is malformed"}'

curl -s -X GET http://event-cat-service:3001/events/0e350ac0-a8f1-4a7a-9191-806716cc6181 \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" \

curl -s -X POST http://refund-service:3001/refund-request \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: -9c0b-4ef8-bb6d-6bb9bd386666" \
  -d '{"refundRequestId": "a0eebc99--4ef8-bb6d-6bb9bd387776", "purchaseId": "df33337e-9fac-4854-9ad8-3af18d822cfc"}' | jq .

curl -s -X POST http://payment-service:3001/payments \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" \
  -d '{"purchase_id": "test-purchase-idem-1", "amount": 2, "cardToken": "test-card-1"}' | jq .

curl -s -X POST http://purchase-service:3001/purchases \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: aaaaaaaa-0000-0000-0000-000000000001" \
  -d '{"userId": "bbbbbbbb-0000-0000-0000-000000000001", "eventId": "cccccccc-0000-0000-0000-000000000001", "cardToken": "test-card", "seats": ["A-1"]}' | jq .
*/
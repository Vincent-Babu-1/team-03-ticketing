import express from 'express';
import crypto from 'crypto';
import pool, { checkDb } from './db.js';
import redis, { checkRedis } from './redis.js';

const app = express();
app.use(express.json());

const PORT = 3001;
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3001';

// ── GET /health ──────────────────────────────────────────────────────────────
// Returns 200 if DB and Redis are both reachable, 503 if either is down
app.get('/health', async (req, res) => {
  const health = { db: 'ok', redis: 'ok' };
  let allGood = true;

  try {
    await checkDb();
  } catch {
    health.db = 'unavailable';
    allGood = false;
  }

  try {
    await checkRedis();
  } catch {
    health.redis = 'unavailable';
    allGood = false;
  }

  if (allGood) {
  res.status(200).json({
    status: 'ok',
    ...health
  });
  } else {
  res.status(503).json({
    status: 'degraded',
    ...health
  });
  }
});

// ── POST /purchases ──────────────────────────────────────────────────────────
// Creates a new ticket purchase
app.post('/purchases', async (req, res) => {
  // Check for idempotency key in the request header
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header is required' });
  }

  // Gets the fields from the request body & checks if anything missing
  const { userId, eventId, quantity, cardToken } = req.body;
  if (!userId || !eventId || !quantity || !cardToken) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Checks if purchased already (if same idempotency key was used before) return the original purchase 
  const existing = await pool.query(
    'SELECT * FROM purchases WHERE idempotency_key = $1',
    [idempotencyKey]
  );
  if (existing.rows.length > 0) {
    return res.status(200).json(existing.rows[0]);
  }

  // Call the Payment Service to process payment
  let paymentResult;
  try {
    const payRes = await fetch(`${PAYMENT_SERVICE_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: quantity * 102, cardToken }),
    });
    paymentResult = await payRes.json();
  } catch (err) {
    return res.status(503).json({ error: 'Payment Service unavailable' });
  }

  // Save the purchase to our database
  let status;
  if (paymentResult.status === 'success') {
    status = 'confirmed';
  } else {
    status = 'failed';
  }
  const totalUsd = (quantity * 102).toFixed(2);
  const purchaseId = crypto.randomUUID();

  await pool.query(
    `INSERT INTO purchases (id, idempotency_key, user_id, event_id, quantity, total_usd, card_token, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [purchaseId, idempotencyKey, userId, eventId, quantity, totalUsd, cardToken, status]
  );

  // If payment succeeded, notify other services via Redis
  if (status === 'confirmed') {
    await redis.publish('confirmed-purchases', JSON.stringify({ purchaseId, userId, eventId }));
    await redis.rPush('analytics-queue', JSON.stringify({ event: 'ticket_purchased', purchaseId }));
  }

  if (status === 'confirmed') {
    return res.status(201).json({
      purchaseId,
      userId,
      eventId,
      quantity,
      totalUsd: parseFloat(totalUsd),
      status,
      createdAt: new Date().toISOString()
    });
  } else {
    return res.status(402).json({
      purchaseId,
      userId,
      eventId,
      quantity,
      totalUsd: parseFloat(totalUsd),
      status,
      createdAt: new Date().toISOString()
    });
  }
});

// ── GET /purchases/:id ───────────────────────────────────────────────────────
// Look up a single purchase by its ID
app.get('/purchases/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM purchases WHERE id = $1',
    [req.params.id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Purchase not found' });
  }

  res.json(rows[0]);
});

// ── Start the server ─────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`ticket-purchase-service running on port ${PORT}`);
});

// Create the purchases table if it doesn't exist
await pool.query(`
  CREATE TABLE IF NOT EXISTS purchases (
    id              UUID PRIMARY KEY,
    idempotency_key UUID UNIQUE NOT NULL,
    user_id         UUID NOT NULL,
    event_id        UUID NOT NULL,
    quantity        INTEGER NOT NULL,
    total_usd       NUMERIC(10,2) NOT NULL,
    card_token      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);
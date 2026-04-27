import express from 'express';
import crypto from 'crypto';
import pool, { checkDb } from './db.js';
import redis, { checkRedis } from './redis.js';

const app = express();
app.use(express.json());

const PORT = 3001;
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3001';

// http://localhost:3002/
app.get("/", (req, res) => {
  res.send("Hello World FROM purchase-service");
});

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
    service: 'purchase',
    status: 'ok',
    ...health
  });
  } else {
  res.status(503).json({
    service: 'purchase',
    status: 'degraded',
    ...health
  });
  }
});

// ── POST /purchases ──────────────────────────────────────────────────────────
// Creates a new ticket purchase
app.post('/purchases', async (req, res) => {
  console.log("called purchases");
  // Check for idempotency key in the request header
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header is required' });
  }

  // Gets the fields from the request body & checks if anything missing
  const { userId, eventId, quantity, cardToken } = req.body;
  if (!userId || !eventId || !quantity || !cardToken) {
    console.log(`purchase ${idempotencyKey} is not valid (missing fields)`);
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Checks if purchased already (if same idempotency key was used before) return the original purchase 
  const existing = await pool.query(
    'SELECT * FROM purchases WHERE idempotency_key = $1',
    [idempotencyKey]
  );
  if (existing.rows.length > 0) {
    const existingPurchase = existing.rows[0]
    if (existingPurchase.status === "confirmed" || existingPurchase.status === "failed") {
      console.log(`purchase ${idempotencyKey} is valid but not unique, returning purchase`);
      return res.status(200).json(existingPurchase);
    } else if (existingPurchase.status === "pending") {
      console.log(`purchase ${idempotencyKey} is valid but not unique, still processing`);
      return res.status(202).json(existingPurchase)
    }
  }

  console.log(`purchase ${idempotencyKey} is valid and unique`);

  // Call the Payment Service to process payment
  let paymentResult;
  const purchaseId = crypto.randomUUID();
  try {
    const payRes = await fetch(`${PAYMENT_SERVICE_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purchase_id: purchaseId, amount: quantity * 102, cardToken }),
    });
    paymentResult = await payRes.json();
  } catch (err) {
    console.log(`Payment Service unavailable`);
    return res.status(503).json({ error: 'Payment Service unavailable' });
  }

  // Save the purchase to our database
  let status;
  if (paymentResult.status === 'success') {
    status = 'confirmed';
  } else {
    status = 'failed';
  }
  console.log(`purchase ${idempotencyKey} received payment message: ${status}`);
  const totalUsd = (quantity * 102).toFixed(2);

  // If payment succeeded, notify other services via Redis and create seat reservation
  if (status === 'confirmed') {
    const reservationId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO seat_reservations (id, event_id, user_id, quantity, status, idempotency_key)
       VALUES ($1, $2, $3, $4, 'confirmed', $5)`,
      [reservationId, eventId, userId, quantity, idempotencyKey]
    );
    console.log(`Seats confirmed - reservation id: ${reservationId}`);
    // Save the confirmed purchase to the database
    await pool.query(
      `INSERT INTO purchases
         (id, idempotency_key, user_id, event_id, quantity, total_usd, card_token, status, reservation_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [purchaseId, idempotencyKey, userId, eventId, quantity, totalUsd, cardToken, status, reservationId]
    );
    await redis.publish('confirmed-purchases', JSON.stringify({ purchaseId, userId, eventId }));
    await redis.rPush('analytics-queue', JSON.stringify({ event: 'ticket_purchased', purchaseId }));

    console.log(`purchase ${idempotencyKey} confirmed!`);
    return res.status(200).json({
      purchaseId,
      userId,
      eventId,
      quantity,
      totalUsd: parseFloat(totalUsd),
      status,
      reservationId,
      createdAt: new Date().toISOString()
    });
    
  } else{
    // Payment failed - saves the failed purchase, no seat reservation needed
    await pool.query(
      `INSERT INTO purchases
         (id, idempotency_key, user_id, event_id, quantity, total_usd, card_token, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [purchaseId, idempotencyKey, userId, eventId, quantity, totalUsd, cardToken, status]
    );
    console.log(`purchase ${idempotencyKey} failed (due to payment error)!`);
    return res.status(402).json({
      purchaseId,
      userId,
      eventId,
      quantity,
      totalUsd: parseFloat(totalUsd),
      status,
      reservationId,
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

// GET /reservations/:id
// Look up a seat reservation by its ID
app.get('/reservations/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM seat_reservations WHERE id = $1',
    [req.params.id]
  );
 
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Reservation not found' });
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
    reservation_id  UUID, 
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

// Create the seat reservations table if it doesn't exist
await pool.query(`
  CREATE TABLE IF NOT EXISTS seat_reservations (
    id              UUID PRIMARY KEY,
    event_id        UUID NOT NULL,
    user_id         UUID NOT NULL,
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    status          TEXT NOT NULL DEFAULT 'confirmed',
    idempotency_key UUID NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY, -- maybe serial?
    purchase_id UUID NOT NULL,
    event_id UUID NOT NULL,
    seat_id UUID NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('released', 'pending', 'confirmed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`);
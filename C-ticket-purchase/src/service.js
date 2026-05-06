import express from 'express';
import crypto from 'crypto';
import pool, { checkDb } from './db.js';
import redis, { checkRedis } from './redis.js';

const app = express();
app.use(express.json());

const PORT = 3001;
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3001';
const EVENT_CATALOG_URL = process.env.EVENT_CATALOG_URL || 'http://event-cat-service:3001';

function parseSeatLabel(label) {
  const [row, seatNumberText] = String(label).split('-');
  return {
    row,
    seatNumber: Number(seatNumberText)
  };
}

async function syncSeatStatuses(eventId, seatLabels, newStatus) {
  const sectionsRes = await fetch(`${EVENT_CATALOG_URL}/events/${eventId}/sections`);
  if (!sectionsRes.ok) {
    throw new Error(`Failed to load event sections: ${sectionsRes.status}`);
  }

  const sections = await sectionsRes.json();

  for (const label of seatLabels) {
    const { row, seatNumber } = parseSeatLabel(label);
    if (!row || Number.isNaN(seatNumber)) {
      throw new Error(`Invalid seat label format: ${label}`);
    }

    const section = sections.find((item) => item.section_name === row);
    if (!section) {
      throw new Error(`Could not find section for seat label ${label}`);
    }

    const seatsRes = await fetch(`${EVENT_CATALOG_URL}/events/${eventId}/sections/${section.id}/seats`);
    if (!seatsRes.ok) {
      throw new Error(`Failed to load seats for section ${section.id}: ${seatsRes.status}`);
    }

    const seats = await seatsRes.json();
    const seat = seats.find((item) => item.row === row && Number(item.seat_number) === seatNumber);
    if (!seat) {
      throw new Error(`Could not find seat ${label} in event catalog`);
    }

    const updateRes = await fetch(`${EVENT_CATALOG_URL}/events/${eventId}/sections/${section.id}/seats/${seat.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    if (!updateRes.ok) {
      throw new Error(`Failed to update seat ${label} to ${newStatus}: ${updateRes.status}`);
    }
  }
}

const isValidUUID = (id) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

// http://localhost:3002/ -- Checking that its up on port 3002.
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
// Creates a new ticket purchase, idempotency key in header
// {userId, eventId, seats: [A1,A2,A3], cardToken}
app.post('/purchases', async (req, res) => {
  console.log("called purchases");
  // Check for idempotency key in the request header
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header is required' });
  }
  if (!isValidUUID(idempotencyKey)){
    return res.status(400).json({ error: 'Idempotency-Key header is wrong format (expected UUID)' });
  }

  // Gets the fields from the request body & checks if anything missing
  const { userId, eventId, cardToken, seats } = req.body;
  if (!userId || !eventId || !cardToken || !seats || !Array.isArray(seats) || seats.length === 0) {
    console.log(`purchase ${idempotencyKey} is not valid (missing fields)`);
    return res.status(400).json({ error: 'Missing required fields or seats invalid, bad format or length' });
  }

  // Checks if purchased already (if same idempotency key was used before) return the original purchase 
  const existing = await pool.query(
    'SELECT * FROM purchases WHERE idempotency_key = $1',
    [idempotencyKey]
  );
  if (existing.rows.length > 0) {
    console.log(`purchase ${idempotencyKey} is valid but not unique`);
    return res.status(200).json(existing.rows[0]);
  }

  console.log(`purchase ${idempotencyKey} is valid and unique`);

  // Check that nobody has tried to take this seat already
  // if even one wanted seat is taken, reject it.
  const takenSeatsCheck = await pool.query(
  `SELECT seats FROM reservations WHERE event_id = $1 AND seats && $2::TEXT[] 
   AND status IN ('pending', 'confirmed')`,
  [eventId, seats]
);
  if (takenSeatsCheck.rows.length > 0) {
    console.log(`purchase ${idempotencyKey}: seat(s) already taken.`);
    return res.status(400).json({error: `purchase ${idempotencyKey}: seat(s) already taken.`})
  }

  
  // Call the Payment Service to process payment
  let paymentResult;
  const purchaseId = crypto.randomUUID();
  const reservationId = crypto.randomUUID();
  const quantity = seats.length;
  // made a randomized function for the pricing -- EVENTUALLY WILL NEED AN API CALL FROM THE UI? ASK FRANCO.
  // TODO:
  const totalUsd = ((55 + Math.floor(Math.random() * 210 )) * quantity).toFixed(2);

  // Reserve seat, so people do not try to buy the same seat.
  await pool.query(`
    INSERT INTO reservations (id, purchase_id, event_id, seats, quantity, status)
    VALUES ($1,$2,$3,$4,$5,$6)`, [reservationId, purchaseId, eventId, seats, quantity, 'pending']
  );
  console.log(`purchase ${idempotencyKey}: seat(s) reserved.`);

  try {
    const payRes = await fetch(`${PAYMENT_SERVICE_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purchase_id: purchaseId, amount: totalUsd, cardToken }),
    });
    paymentResult = await payRes.json();
  } catch (err) {
    // Payment service unreachable — release seats immediately, no dangling reservation
    await pool.query(
      `UPDATE reservations SET status = 'released', updated_at = NOW() WHERE id = $1`,
      [reservationId]
    );
    await redis.rPush('waitlist-queue', JSON.stringify({ eventId, seats, userId }));
    console.log(`purchase ${idempotencyKey}: payment service unavailable, seats released`);
    return res.status(503).json({ error: 'Payment Service unavailable' });
  }
 
  // handling response from payment
  if (paymentResult.status === 'success') {
    // Confirm reservation
    await pool.query(
      `UPDATE reservations SET status = 'confirmed', updated_at = NOW() WHERE id = $1`,
      [reservationId]
    );

    try {
      await syncSeatStatuses(eventId, seats, 'sold');
    } catch (err) {
      console.log(`purchase ${idempotencyKey}: failed to sync sold seats with event catalog`, err);
    }

    // Save confirmed purchase
    await pool.query(
      `INSERT INTO purchases (id, idempotency_key, user_id, event_id, seats, quantity, total_usd, card_token, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed')`,
      [purchaseId, idempotencyKey, userId, eventId, seats, quantity, totalUsd, cardToken]
    );
 
    await redis.publish('confirmed-purchases', JSON.stringify({ purchaseId, userId, eventId, seats }));
    await redis.rPush('analytics-queue', JSON.stringify({ event: 'ticket_purchased', purchaseId, eventId, quantity }));
    await redis.rPush('purchase-events', JSON.stringify({ purchaseId, userId, eventId, paymentToken: cardToken }));
    console.log(`purchase ${idempotencyKey} confirmed!`);
    return res.status(200).json({
      purchaseId,
      userId,
      eventId,
      seats,
      quantity,
      totalUsd: parseFloat(totalUsd),
      status: 'confirmed',
      createdAt: new Date().toISOString()
    });
 
  } else {
    // Payment failed — release seats immediately so no dangling reservation
    await pool.query(
      `UPDATE reservations SET status = 'released', updated_at = NOW() WHERE id = $1`,
      [reservationId]
    );

    try {
      await syncSeatStatuses(eventId, seats, 'available');
    } catch (err) {
      console.log(`purchase ${idempotencyKey}: failed to sync released seats with event catalog`, err);
    }

    // Push released seats to waitlist so Waitlist Worker can promote next user
    await redis.rPush('waitlist-queue', JSON.stringify({ eventId, seats, userId }));
 
    // Save failed purchase
    await pool.query(
      `INSERT INTO purchases (id, idempotency_key, user_id, event_id, seats, quantity, total_usd, card_token, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'failed')`,
      [purchaseId, idempotencyKey, userId, eventId, seats, quantity, totalUsd, cardToken]
    );
 
    console.log(`purchase ${idempotencyKey} failed (payment declined), seats released`);
    return res.status(402).json({
      purchaseId,
      userId,
      eventId,
      seats,
      quantity,
      totalUsd: parseFloat(totalUsd),
      status: 'failed',
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
    'SELECT * FROM reservations WHERE id = $1',
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

await pool.query(`
  CREATE TABLE IF NOT EXISTS purchases (
    id              UUID PRIMARY KEY,
    idempotency_key UUID UNIQUE NOT NULL,
    user_id         UUID NOT NULL,
    event_id        UUID NOT NULL,
    seats           TEXT[] NOT NULL,
    quantity        INTEGER NOT NULL,
    total_usd       NUMERIC(10,2) NOT NULL,
    card_token      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS reservations (
    id          UUID PRIMARY KEY,
    purchase_id UUID NOT NULL,
    event_id    UUID NOT NULL,
    seats       TEXT[] NOT NULL,
    quantity    INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'released')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

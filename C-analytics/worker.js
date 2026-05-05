// worker.js — Analytics Worker (Sprint 1)
// Consumes purchase and browse events from the Redis analytics_queue and writes aggregate stats to the analytics DB

import express from 'express';
import { popFromQueue, pushToQueue, redis} from './redis.js';
import pg from 'pg';

const { Pool } = pg;

// Connect to the analytics DB using environment variables
const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://user:pass@analytics-db:5432/analyticsdb',
});

const QUEUE = 'analytics-queue';
const DLQ   = 'analytics-queue:dlq';
const PORT  = 3001;

let lastJobAt = null;   // ISO timestamp of last successfully processed event

// ── HTTP server ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// GET /health
// Checks DB and Redis connectivity. Returns queue depth, DLQ depth, and
// last successfully processed job timestamp.
app.get('/health', async (req, res) => {
  const health = {};
  let allGood = true;
 
  try {
    await db.query('SELECT 1');
    health.db = 'ok';
  } catch (err) {
    health.db = 'unavailable';
    allGood = false;
  }
 
  try {
    await redis.ping();
    health.redis = 'ok';
  } catch (err) {
    health.redis = 'unavailable';
    allGood = false;
  }
 
  let queueDepth = 0;
  let dlqDepth   = 0;
  try {
    queueDepth = await redis.lLen(QUEUE);
    dlqDepth   = await redis.lLen(DLQ);
  } catch {
    // non-fatal — health.redis already captures Redis reachability
  }
 
  res.status(allGood ? 200 : 503).json({
    service:    'analytics-worker',
    status:     allGood ? 'ok' : 'degraded',
    queueDepth,
    dlqDepth,
    lastJobAt,
    ...health,
  });
});
 
// GET /analytics
app.get('/analytics', async (req, res) => {
  console.log('[analytics-worker] GET /analytics hit');
  try {
    const { rows } = await db.query(
      'SELECT event_id, tickets_sold, browse_count, updated_at FROM event_stats ORDER BY updated_at DESC'
    );
    res.status(200).json({ events: rows });
  } catch (err) {
    res.status(503).json({ error: 'Database unavailable' });
  }
});

// ── Consumer loop ─────────────────────────────────────────────────────────────
async function run() {
  console.log('[analytics-worker] listening on', QUEUE);

  // Loop forever so worker stays on always
  while (true) {
    try {
      // popFromQueue calls redis BRPOP, which blocks until an event is available
      const event = await popFromQueue(QUEUE);

      
      if (!event) continue;

      await handleEvent(event);

    } catch (err) {
      // If the DB or Redis has an error, wait 1 second and retry
      console.error('[analytics-worker] error:', err.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function handleEvent(event) {
  const { event: type, purchaseId, eventId } = event;
 
  // ── Purchase event ────────────────────────────────────────────────────────
  if (type === 'ticket_purchased') {
 
    // Route to DLQ if required fields are missing
    if (!purchaseId || !eventId) {
      const raw = JSON.stringify(event);
      console.warn('[analytics-worker] purchase event missing fields, routing to DLQ:', raw);
      await pushToQueue(DLQ, event);
      return;
    }
 
    // Idempotency check — skip if this purchase has already been counted
    const exists = await db.query(
      'SELECT 1 FROM processed_purchases WHERE purchase_id = $1',
      [purchaseId]
    );
    if (exists.rows.length > 0) {
      console.log(`[analytics-worker] duplicate purchase ${purchaseId}, skipping`);
      return;
    }
 
    // Record that we have processed this purchase
    await db.query(
      'INSERT INTO processed_purchases (purchase_id) VALUES ($1)',
      [purchaseId]
    );
 
    // Upsert event_stats: increment tickets_sold for this event
    await db.query(
      `INSERT INTO event_stats (event_id, tickets_sold, browse_count, updated_at)
       VALUES ($1, 1, 0, NOW())
       ON CONFLICT (event_id) DO UPDATE
         SET tickets_sold = event_stats.tickets_sold + 1,
             updated_at   = NOW()`,
      [eventId]
    );
 
    lastJobAt = new Date().toISOString();
    console.log(`[analytics-worker] purchase recorded — event=${eventId} purchase=${purchaseId}`);
 
  // ── Browse event ──────────────────────────────────────────────────────────
  } else if (type === 'browse') {
 
    // Route to DLQ if eventId is missing
    if (!eventId) {
      const raw = JSON.stringify(event);
      console.warn('[analytics-worker] browse event missing eventId, routing to DLQ:', raw);
      await pushToQueue(DLQ, event);
      return;
    }
 
    // Browse events have no unique ID — approximate counts are acceptable
    await db.query(
      `INSERT INTO event_stats (event_id, tickets_sold, browse_count, updated_at)
       VALUES ($1, 0, 1, NOW())
       ON CONFLICT (event_id) DO UPDATE
         SET browse_count = event_stats.browse_count + 1,
             updated_at   = NOW()`,
      [eventId]
    );
 
    lastJobAt = new Date().toISOString();
    console.log(`[analytics-worker] browse recorded — event=${eventId}`);
 
  // ── Unknown or malformed event ────────────────────────────────────────────
  } else {
    console.warn('[analytics-worker] unknown event type, routing to DLQ:', event);
    await pushToQueue(DLQ, event);
  }
}

app.listen(PORT, () => {
  console.log(`[analytics-worker] health server listening on port ${PORT}`);
});

run();
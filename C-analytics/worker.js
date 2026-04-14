// worker.js — Analytics Worker (Sprint 1)
// Consumes purchase and browse events from the Redis analytics_queue and writes aggregate stats to the analytics DB

import { popFromQueue } from './redis.js';
import pg from 'pg';

const { Pool } = pg;

// Connect to the analytics DB using environment variables
// set in compose.yml. The defaults match the compose.yml values
const db = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const QUEUE = 'analytics_queue';

async function run() {
  console.log('[analytics-worker] listening on', QUEUE);

  // Loop forever so worker stays on always
  while (true) {
    try {
      // popFromQueue calls redis BRPOP, which blocks until an event is available
      const event = await popFromQueue(QUEUE);
      if (!event) continue;

      const { type, event_id, purchase_id } = event;

      if (type === 'purchase' && event_id && purchase_id) {

        // Idempotency check --> if we've already processed this purchase_id, skip it
        const exists = await db.query(
          'SELECT 1 FROM processed_purchases WHERE purchase_id = $1',
          [purchase_id]
        );
        if (exists.rows.length > 0) {
          console.log(`[analytics-worker] duplicate purchase ${purchase_id}, skipping`);
          continue;
        }

        // Mark this purchase as processed so future duplicates are skipped
        await db.query(
          'INSERT INTO processed_purchases (purchase_id) VALUES ($1)',
          [purchase_id]
        );

        // Upsert event_stats: if a row for this event_id exists, increment tickets_sold. If not, create a new row starting at 1
        await db.query(
          `INSERT INTO event_stats (event_id, tickets_sold, browse_count, updated_at)
           VALUES ($1, 1, 0, NOW())
           ON CONFLICT (event_id) DO UPDATE
             SET tickets_sold = event_stats.tickets_sold + 1,
                 updated_at   = NOW()`,
          [event_id]
        );
        console.log(`[analytics-worker] purchase recorded — event=${event_id}`);

      } else if (type === 'browse' && event_id) {

        // Browse events have no unique ID (The spec says approximate counts are acceptable for browse stats)
        await db.query(
          `INSERT INTO event_stats (event_id, tickets_sold, browse_count, updated_at)
           VALUES ($1, 0, 1, NOW())
           ON CONFLICT (event_id) DO UPDATE
             SET browse_count = event_stats.browse_count + 1,
                 updated_at   = NOW()`,
          [event_id]
        );
        console.log(`[analytics-worker] browse recorded — event=${event_id}`);

      } else {
        // Missing required fields or unknown type of event
        // Log and drop event rather than crashing the worker
        console.warn('[analytics-worker] malformed event, dropping:', event);
      }

    } catch (err) {
      // If the DB or Redis has an error, wait 1 second and retry
      console.error('[analytics-worker] error:', err.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

run();
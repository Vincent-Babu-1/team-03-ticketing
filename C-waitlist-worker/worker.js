import { createClient } from 'redis';
import express from 'express';

const QUEUE = 'waitlist-queue';
const DLQ = 'waitlist-queue:dlq';
const PORT = 3000;

// Connect to Redis
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

const subscriber = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

await redis.connect();
await subscriber.connect();
console.log('waitlist-worker connected to Redis');
console.log('waitlist-worker listening on waitlist-queue...');

// Track some stats for the health endpoint
let lastJobAt = null;
let jobsProcessed = 0;

// Process one message from the queue
async function processEntry(raw) {

  // Try to parse the message as JSON
  let entry;
  try {
    entry = JSON.parse(raw);
  } catch {
    console.log('Bad message (invalid JSON), moving to DLQ:', raw);
    await redis.rPush(DLQ, raw);
    return;
  }

  // Check that required fields are present
  if (!entry.userId || !entry.eventId) {
    console.log('Bad message (missing fields), moving to DLQ:', raw);
    await redis.rPush(DLQ, raw);
    return;
  }

  // Valid entry — promote the user by publishing to confirmed-purchases
  // The Notification Service is subscribed to this channel
  const message = JSON.stringify({
    type: 'waitlist-promotion',
    userId: entry.userId,
    eventId: entry.eventId,
    promotedAt: new Date().toISOString(),
  });
  await redis.publish('confirmed-purchases', message);

  // Update stats
  jobsProcessed = jobsProcessed + 1;
  lastJobAt = new Date().toISOString();

  console.log('Promoted waitlisted user:', { userId: entry.userId, eventId: entry.eventId });
}

// Health endpoint so docker compose ps shows (healthy)
const app = express();

app.get('/health', async (req, res) => {
  try {
    await redis.ping();

    const depth = await redis.lLen(QUEUE);
    const dlqDepth = await redis.lLen(DLQ);

    res.status(200).json({
      status: 'ok',
      redis: 'ok',
      depth: depth,
      dlq_depth: dlqDepth,
      last_job_at: lastJobAt,
      jobs_processed: jobsProcessed,
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      redis: 'unavailable',
      error: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log('waitlist-worker health endpoint listening on port', PORT);
});

// Keep listening for messages forever
async function startWorker() {
  while (true) {
    try {
      const result = await subscriber.blPop(QUEUE, 5);
      if (result) {
        await processEntry(result.element);
      }
    } catch (err) {
      console.log('Error:', err.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

startWorker();
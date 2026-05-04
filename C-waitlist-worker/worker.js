import { createClient } from 'redis';
import express from 'express';

const QUEUE = 'waitlist-queue';
const DLQ = 'waitlist-queue:dlq';
const PORT = 3000;

// The pub/sub channel the Refund Service publishes to when a seat is released
const SEAT_RELEASED_CHANNEL = 'seat-released';

// Connect to Redis
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

//Connect to subscriber
const subscriber = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

redis.on('error', (err) => console.error('[redis] error:', err.message));
subscriber.on('error', (err) => console.error('Subscriber error:', err.message));


await redis.connect();
await subscriber.connect();
console.log('waitlist-worker connected to Redis');

// Refund Service publishes to seat-released, then push to waitlist-queue
await subscriber.subscribe(SEAT_RELEASED_CHANNEL, (message) => {
  console.log('Seat released event received - pushing to waitlist-queue:', message);
  redis.rPush(QUEUE, message).catch((err) => {
    console.error('Failed to push seat-released message to waitlist-queue:', err.message);
  });
});
console.log('Subscribed to', SEAT_RELEASED_CHANNEL);
console.log('Listening for messages on', QUEUE);

// Track stats for the health endpoint
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
  try{
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

  } catch (err) {
    // Something unexpected went wrong (like Redis being temporarily down).
    // Send to DLQ instead of retrying forever.
    console.error('Unexpected error, moving message to DLQ:', err.message);
    await redis.rPush(DLQ, raw);
  }
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
      const result = await redis.blPop(QUEUE, 1);
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
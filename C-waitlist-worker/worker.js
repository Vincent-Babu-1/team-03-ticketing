import { createClient } from 'redis';

const QUEUE = 'waitlist-queue';
const DLQ = 'waitlist-queue:dlq';

// Connect to Redis
const redis = createClient({ 
  url: process.env.REDIS_URL || 'redis://redis:6379' 
});

await redis.connect();
console.log('waitlist-worker connected to Redis');

// Create a second client for listening to the queue
const subscriber = createClient({ 
  url: process.env.REDIS_URL || 'redis://redis:6379' 
});

await subscriber.connect();
console.log('waitlist-worker listening on waitlist-queue...');

// Process one entry from the queue
async function processEntry(raw) {

  // Try to parse the message
  let entry;
  try {
    entry = JSON.parse(raw);
  } catch {
    // Bad message — move to dead letter queue
    console.log('Bad message, moving to DLQ:', raw);
    await redis.rPush(DLQ, raw);
    return;
  }

  // Check required fields
  const { userId, eventId } = entry;
  if (!userId || !eventId) {
    // Missing fields — move to dead letter queue
    console.log('Missing fields, moving to DLQ:', raw);
    await redis.rPush(DLQ, raw);
    return;
  }

  // Valid entry — log it
  console.log('Promoting waitlisted user:', { userId, eventId });
}

// Keep listening for messages forever
while (true) {
  try {
    // wait for 5 seconds
    const result = await subscriber.blPop(QUEUE, 5);

    if (result) {
      await processEntry(result.element);
    }

  } catch (err) {
    console.log('Error:', err.message);
    await new Promise(r => setTimeout(r, 1000));
  }
}
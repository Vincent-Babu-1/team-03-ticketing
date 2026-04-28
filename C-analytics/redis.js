// redis.js — Analytics Worker Redis client

import { createClient } from 'redis';

export const redis = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379',
});

await redis.connect();
console.log('[analytics-worker] connected to Redis');

// Blocking pop — waits until an item is available on the queue
export async function popFromQueue(queue) {
  const result = await redis.brPop(queue, 1); // unblock every second 
  if (!result) return null;
  return JSON.parse(result.element);
}

// Push to a queue — used to send events to the DLQ
export async function pushToQueue(queue, data) {
  await redis.lPush(queue, JSON.stringify(data));
}
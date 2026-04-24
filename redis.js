// redis.js (or lib/redis.js)

import { createClient } from "redis";

// ---------- Clients ----------
export const redis = createClient({
  url: process.env.REDIS_URL,
});

export default redis;

export const redisPublisher = createClient({
  url: process.env.REDIS_URL,
});

export const redisSubscriber = createClient({
  url: process.env.REDIS_URL,
});

// ---------- Connect ----------
const connectClient = async (client) => {
  if (!client.isOpen) {
    await client.connect();
  }
};

// connect all clients once on import
await connectClient(redis);
await connectClient(redisPublisher);
await connectClient(redisSubscriber);

// ---------- Queue (FIFO via Redis list) ----------

// push to queue (LPUSH)
export const pushToQueue = async (queue, data) => {
  await redis.lPush(queue, JSON.stringify(data));
};

// blocking pop from queue (BRPOP)
export const popFromQueue = async (queue) => {
  const result = await redis.brPop(queue, 0); // 0 = wait forever

  if (!result) return null;

  // node-redis returns: { key, element }
  return JSON.parse(result.element);
};

// ---------- Pub/Sub ----------

// publish message
export const publish = async (channel, message) => {
  await redisPublisher.publish(channel, JSON.stringify(message));
};

// subscribe helper (you usually call this in a worker)
export const subscribe = async (channel, handler) => {
  await redisSubscriber.subscribe(channel, (message) => {
    try {
      handler(JSON.parse(message));
    } catch (err) {
      console.error("Invalid pub/sub message:", err);
    }
  });
};

// ---------- Cache ----------

// set cache with TTL
export const setCache = async (key, value, ttlSeconds = 300) => {
  await redis.set(key, JSON.stringify(value), {
    EX: ttlSeconds,
  });
};

// get cache
export const getCache = async (key) => {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
};
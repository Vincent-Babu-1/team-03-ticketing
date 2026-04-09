import Redis from "redis";

// ---------- Connections ----------
export const redis = new Redis(process.env.REDIS_URL);          // general use / queues
export const redisPublisher = new Redis(process.env.REDIS_URL); // pub/sub publisher
export const redisSubscriber = new Redis(process.env.REDIS_URL);// pub/sub subscriber

// ---------- Queues ----------
export const pushToQueue = async (queue, data) => {
  await redis.lpush(queue, JSON.stringify(data));
};

export const popFromQueue = async (queue) => {
  const result = await redis.brpop(queue, 0);
  return result ? JSON.parse(result[1]) : null;
};

// ---------- Pub/Sub ----------
export const publish = (channel, message) =>
  redisPublisher.publish(channel, JSON.stringify(message));

// ---------- Cache ----------
export const setCache = async (key, value, ttlSeconds = 300) => {
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
};

export const getCache = async (key) => {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
};
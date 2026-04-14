import { createClient } from 'redis';

// Connects to the shared Redis container using the URL from compose.yml
const redis = createClient({ 
  url: process.env.REDIS_URL || 'redis://redis:6379' 
});

// Connect when this file is first imported
await redis.connect();

// Used by health check to test if Redis is reachable
export async function checkRedis() {
  await redis.ping();
}

export default redis;
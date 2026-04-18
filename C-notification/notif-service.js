import express from 'express';
import { waitForPg, waitForRedis } from './wait.js';
import { createClient } from 'redis';
const redis = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
await waitForRedis(redis, 'posts');

const app = express();
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await redis.ping()
    res.status(200).json({ ok: true, status: 'ok', service: 'notif-service' })
  } catch {
    console.log("no redis ping");
    res.status(503).json({ ok: false, status: 'redis-not-ready', service: 'notif-service' })
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Refund service listening on :${port}`);
});
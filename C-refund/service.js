import express from 'express';
import pg from 'pg';
import { createClient } from 'redis';
import { waitForPg, waitForRedis } from './wait.js';

const app = express();
app.use(express.json());

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const redis = createClient({ url: process.env.REDIS_URL });
await waitForPg(pool, 'posts');
await waitForRedis(redis, 'posts');

app.get('/healthz', async (req, res) => {
  await pool.query('SELECT 1');
  console.log("received health check")
  res.json({ ok: true, service: 'refund' });
});

const port = process.env.PORT || 3005;
app.listen(port, () => {
  console.log(`Refund service listening on :${port}`);
});
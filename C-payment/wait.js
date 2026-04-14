import pg from "pg"
import { createClient } from "redis"

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || "postgres://user:pass@purchase-db:5432/purchasedb"});
export const redis = createClient({url: process.env.REDIS_URL || "redis://redis:6379"});

export async function checkDb() {
  const client = await pool.connect();
  await client.query('SELECT 1');
  console.log(`payment-service: payment database connected`);
  client.release();
}

export async function checkRedis() {
    await redis.ping();
    console.log(`payment-service: redis connected`);
}

await redis.connect();
import redis from "redis";
import pkg from "pg";
import express from "express";

const app = express();
const PORT = 3000;

const { Client } = pkg;

// ENV
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://user:pass@fraud-db:5432/frauddb";

const QUEUE_NAME = "purchase-events";
const DLQ_NAME = "fraud-dlq";
const PUBSUB_CHANNEL = "fraud-flagged";

// Clients
const redisClient = redis.createClient({ url: REDIS_URL });
const db = new Client({ connectionString: DATABASE_URL });

// Tracking
let lastJobAt = null;
const recentPurchases = new Map();
const paymentTokenMap = new Map();

// ---------------------------
// FRAUD RULES
// ---------------------------
function suspicious_activity(event) {
  const { userId, paymentToken } = event;

  // Rule 1: payment token reuse
  const tokenCount = (paymentTokenMap.get(paymentToken) || 0) + 1;
  paymentTokenMap.set(paymentToken, tokenCount);

  if (tokenCount > 3) return "payment_token_reuse";

  // Rule 2: rapid purchases
  const now = Date.now();
  const userHistory = recentPurchases.get(userId) || [];

  const updated = userHistory.filter(t => now - t < 10000);
  updated.push(now);
  recentPurchases.set(userId, updated);

  if (updated.length > 5) return "rapid_purchases";

  return null;
}

// ---------------------------
// MAIN WORKER LOOP
// ---------------------------
async function start() {
  await redisClient.connect();
  await db.connect();

  console.log("Fraud worker started");

  while (true) {
    try {
      const result = await redisClient.brPop(QUEUE_NAME, 0);
      const raw = result.element;

      let event;
      try {
        event = JSON.parse(raw);
      } catch {
        console.error("Poison pill");
        await redisClient.lPush(DLQ_NAME, raw);
        continue;
      }

      const reason = suspicious_activity(event);

      if (reason) {
        console.log("FRAUD DETECTED:", reason);

        await db.query(
          "INSERT INTO fraud_flags(user_id, reason, created_at) VALUES($1,$2,NOW())",
          [event.userId, reason]
        );

        await redisClient.publish(
          PUBSUB_CHANNEL,
          JSON.stringify({ ...event, reason })
        );
      } else {
        console.log("Normal purchase:", event.userId);
      }
      lastJobAt = new Date().toISOString();

    } catch (err) {
      console.error("Worker error:", err);
    }
  }
}

// ---------------------------
// HEALTH ENDPOINT
// ---------------------------
app.get("/health", async (req, res) => {
  try {
    await redisClient.ping();
    await db.query("SELECT 1");

    const queueDepth = await redisClient.lLen(QUEUE_NAME);
    const dlqDepth = await redisClient.lLen(DLQ_NAME);

    res.status(200).json({
      status: "ok",
      checks: {
        redis: "ok",
        database: "ok"
      },
      queueDepth,
      dlqDepth,
      lastJobAt
    });

  } catch (err) {
    res.status(503).json({
      status: "error",
      error: err.message
    });
  }
});

// start server + worker
app.listen(PORT, () => {
  console.log("Health server running on port", PORT);
});

start();
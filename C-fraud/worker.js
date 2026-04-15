import redis from "redis";
import pkg from "pg";
import express from "express";

const app = express();
const PORT = 3000;

let lastJobAt = null;
const { Client } = pkg;

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://user:pass@fraud-db:5432/frauddb";

const QUEUE_NAME = "purchase-events";      
const DLQ_NAME = "fraud-dlq";              
const PUBSUB_CHANNEL = "fraud-flagged";    

// Clients
const redisClient = redis.createClient({ url: REDIS_URL });
const subscriber = redis.createClient({ url: REDIS_URL });

const db = new Client({ connectionString: DATABASE_URL });

const recentPurchases = new Map(); // userId -> timestamps
const paymentTokenMap = new Map(); // token -> count

// ---------------------------
// FRAUD RULES
// ---------------------------

function suspicious_activity(event) {
  const { userId, paymentToken, timestamp } = event;

  // Rule 1: same payment token used too often
  const tokenCount = (paymentTokenMap.get(paymentToken) || 0) + 1;
  paymentTokenMap.set(paymentToken, tokenCount);

  if (tokenCount > 3) {
    return "payment_token_reuse";
  }

  // Rule 2: too many purchases quickly
  const now = Date.now();
  const userHistory = recentPurchases.get(userId) || [];

  const updated = userHistory.filter(t => now - t < 10000); // last 10 sec
  updated.push(now);
  recentPurchases.set(userId, updated);

  if (updated.length > 5) {
    return "rapid_purchases";
  }

  return null;
}

// ---------------------------
// MAIN WORKER LOOP
// ---------------------------

async function start() {
  await redisClient.connect();
  await subscriber.connect();
  await db.connect();

  console.log("Fraud worker started");

  while (true) {
    try {
      // Blocking pop from Redis queue
      const result = await redisClient.brPop(QUEUE_NAME, 0);
      const raw = result.element;

      let event;
      try {
        event = JSON.parse(raw);
      } catch (err) {
        console.error("Poison pill (bad JSON)");
        await redisClient.lPush(DLQ_NAME, raw);
        continue;
      }

      const reason = suspicious_activity(event);

      if (reason) {
        console.log("FRAUD DETECTED:", reason, event);

        // Store in DB
        await db.query(
          "INSERT INTO fraud_flags(user_id, reason, created_at) VALUES($1,$2,NOW())",
          [event.userId, reason]
        );

        // Publish alert
        await redisClient.publish(
          PUBSUB_CHANNEL,
          JSON.stringify({ ...event, reason })
        );
      } else {
        console.log("Normal purchase:", event.userId);
      }

    } catch (err) {
      console.error("Worker error:", err);
    }
  }
}

// health endpoint
app.get("/health", async (req, res) => {
  try {
    const queueDepth = await redisClient.lLen("purchase-events");
    const dlqDepth = await redisClient.lLen("fraud-dlq");

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
  } catch {
    res.status(503).json({ status: "error" });
  }
});

app.listen(PORT, () => {
  console.log("Health server running on port", PORT);
});

start();
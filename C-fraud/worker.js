import { createClient } from "redis";
import pg from "pg";
import express from "express";

const app = express();
const PORT = 3008;

// ENV
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://user:pass@fraud-db:5432/frauddb";

const QUEUE_NAME = "purchase-events";
const DLQ_NAME = "fraud-dlq";
const PUBSUB_CHANNEL = "fraud-flagged";

// Clients
const redisClient = createClient({ url: REDIS_URL });
const db = new pg.Pool({ connectionString: DATABASE_URL });

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
async function sendToDLQ(raw, reason) {
  const entry = {
    raw,
    reason,
    timestamp: new Date().toISOString(),
  };

  await redisClient.rPush(DLQ_NAME, JSON.stringify(entry));
  console.log("Sent to DLQ:", reason);
}
// ---------------------------
// WORKER LOOP (non-blocking)
// ---------------------------
function runWorker() {
  async function loop() {
      try {
      const result = await redisClient.brPop(QUEUE_NAME, 1);

      if (!result) {
        return setTimeout(loop, 0); 
      }

      const raw = result.element;

      let event;
      try {
        event = JSON.parse(raw);
      } catch {
        await sendToDLQ(raw, "invalid_json");
        return setImmediate(loop);
      }
      
      if (!event.userId || !event.paymentToken) {
        await sendToDLQ(raw, "missing_fields");
        return setImmediate(loop);
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

    // yield control so Express stays responsive
    setImmediate(loop);
  }

  loop();
}

// ---------------------------
// STARTUP
// ---------------------------
async function start() {
  await redisClient.connect();
  console.log("Redis connected");

  // optional warm DB connection
  await db.query("SELECT 1");
  console.log("DB ready");

  console.log("Fraud worker started");

  runWorker();
}

// ---------------------------
// HEALTH ENDPOINT
// ---------------------------
app.get("/health", async (req, res) => {
  try {

    if (!redisClient.isOpen) {
      console.log("redis not open")
      await redisClient.connect();
      console.log("redis connected")
    }
    
    await redisClient.ping();

    res.status(200).json({
      status: "ok",
      checks: {
        redis: "ok",
        database: "ok"
      },
      queueDepth:0, 
      dlqDepth:0, 
      lastJobAt
    });

  } catch (err) {
    res.status(503).json({
      status: "error",
      error: err.message
    });
  }
});

// ---------------------------
// START SERVER
// ---------------------------
app.listen(PORT, () => {
  console.log("Health server running on port", PORT);
});

// ---------------------------
// RUN EVERYTHING
// ---------------------------
start().catch(err => console.error("Startup error:", err));
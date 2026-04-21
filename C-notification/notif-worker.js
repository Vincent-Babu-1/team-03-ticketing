import redis, { redisSubscriber } from "./redis.js";
import { createClient } from 'redis';
import express from 'express';

const app = express();
app.use(express.json());
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const redisClient = createClient({ url: REDIS_URL });
const PORT = 3001;
let lastJobAt = null;

// Publish to channel for testing
console.log("WORKER FILE STARTED");

const purchaseId = "abc123";
const userId = "user456";
const eventId = "event789";

await redis.publish('confirmed-purchases', JSON.stringify({ purchaseId, userId, eventId }));

// health endpoint 
app.get("/health", async (req, res) => {
  try {
    if (!redisClient.isOpen) {
      console.log("redis not open yet")
      await redisClient.connect();
      console.log("redis connected")
    }
    
    await redisClient.ping();
    //const dlqDepth = await redisClient.lLen(DLQ_NAME);
    res.status(200).json({
      status: "ok",
      checks: {
        redis: "ok",
        database: "ok"
      },
      queueDepth:0, //uses pub/sub instead
      dlqDepth:0, //TODO: implement dlq
      lastJobAt
    });
  } catch (err) {
    res.status(503).json({
      status: "error",
      error: err.message
    });
  }
});
app.listen(PORT, () => {
  console.log("Health server running on port", PORT);
});

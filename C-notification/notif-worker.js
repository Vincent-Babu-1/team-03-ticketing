import { redisSubscriber } from "./redis.js";
import { createClient } from 'redis';
import express from 'express';

const app = express();
app.use(express.json());
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const redisClient = createClient({ url: REDIS_URL });

console.log("🔥 WORKER FILE STARTED");
const CHANNEL = "confirmed-purchases";

const PORT = 3001;
let lastJobAt = null;

async function startWorker() {
  console.log("📡 Notification worker starting...");


  // 2. subscribe AFTER connection
  await redisSubscriber.subscribe(CHANNEL, (message) => {
    try {
      const data = JSON.parse(message);

      console.log("📩 Received confirmed purchase:");
      console.log(data);

      // simulate email sending
      const emailLog = `
        === EMAIL SENT ===
        To: ${data.userId}
        Subject: Purchase Confirmation
        Body: Your purchase of ${data.purchaseId} for event ${data.eventId} is confirmed.
        ==================
      `;

      console.log(emailLog);
      lastJobAt = new Date().toISOString();
      // optional file log
      // fs.appendFileSync("emails.log", emailLog);

    } catch (err) {
      console.error("❌ Failed to process message:", err);
    }
  });

  console.log(`👂 Listening on ${CHANNEL}...`);

  // keep process alive (important for Docker)
  process.stdin.resume();
}

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

// startup safety
startWorker().catch((err) => {
  console.error("🔥 Worker failed to start:", err);
  process.exit(1);
});
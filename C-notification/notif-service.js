import express from 'express';
import { waitForPg, waitForRedis } from './wait.js';
import { createClient } from 'redis';

const CHANNEL = "confirmed-purchases";

const app = express();
app.use(express.json());

const redis = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
await waitForRedis(redis, 'posts');
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const redisClient = createClient({ url: REDIS_URL });
const PORT = 3001;
let lastJobAt = null;


async function startWorker() {
  console.log("Notification worker starting...");

  // subscribe AFTER connection
  await redisSubscriber.subscribe(CHANNEL, (message) => {
    try {
      const data = JSON.parse(message);

      console.log("Received confirmed purchase:");
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
      console.error("Failed to process message:", err);
    }
  });

  console.log(`Listening on ${CHANNEL}...`);

  // keep process alive (important for Docker)
  process.stdin.resume();
}

app.get('/health', async (req, res) => {
  try {
    await redis.ping()
    res.status(200).json({ ok: true, status: 'ok', service: 'notif-service' })
  } catch {
    console.log("no redis ping");
    res.status(503).json({ ok: false, status: 'redis-not-ready', service: 'notif-service' })
  }
});

// startup safety
startWorker().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Refund service listening on :${port}`);
});
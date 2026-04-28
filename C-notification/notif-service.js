import express from 'express';
import { waitForRedis } from './wait.js';
import redis, { redisSubscriber } from "./redis.js";

const CHANNEL = "confirmed-purchases";
const DLQ = `${CHANNEL}:dlq`;
const MAX_RETRIES = 3;

const app = express();
app.use(express.json());

await waitForRedis(redis, 'posts');

let lastJobAt = null;

// ── Core processor ────────────────────────────────────────────────────────────

async function processMessage(data) {
  const emailLog = `
     === EMAIL SENT ===
    To: ${data.userId}
    Subject: Purchase Confirmation
    Body: Your purchase of ${data.purchaseId} for event ${data.eventId} is confirmed.
    ==================
  `;
  console.log(emailLog);
  lastJobAt = new Date().toISOString();
}

// ── DLQ helper ────────────────────────────────────────────────────────────────

async function sendToDLQ(data, reason) {
  const entry = JSON.stringify({ data, reason, failedAt: new Date().toISOString() });
  await redis.rPush(DLQ, entry);
  console.error(`[DLQ] Dead-lettered purchaseId=${data.purchaseId} — reason: ${reason}`);
}

// ── Pub/sub subscriber ────────────────────────────────────────────────────────

async function startWorker() {
  console.log("Notification worker starting...");

  await redisSubscriber.subscribe(CHANNEL, async (message) => {
    let data;
    try {
       data = JSON.parse(message);

      //Checks if the data is valid
      if (!data.userId || !data.purchaseId || !data.eventId) {
        throw new Error("INVALID_FORMAT");
      }
      
      console.log("Received confirmed purchase:", data.purchaseId);

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
      console.error("[PARSE ERROR] Dropping unparseable message:", message);
      let lastErr;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await processMessage(data);
        if (attempt > 1) console.log(`[RETRY] ✓ Succeeded on attempt ${attempt}`);
        return;
      } catch (err) {
        lastErr = err;
        console.warn(`[RETRY] Attempt ${attempt}/${MAX_RETRIES} failed for purchaseId=${data.purchaseId}: ${err.message}`);
      }
    }

    await sendToDLQ(data, lastErr.message);
  }
  });

  console.log(`Listening on ${CHANNEL}...`);
  process.stdin.resume();
}

// ── HTTP endpoints ────────────────────────────────────────────────────────────

app.get('/health', async (req, res) => {
  try {
    await redis.ping();
    res.status(200).json({ ok: true, status: 'ok', service: 'notif-service' });
  } catch {
    res.status(503).json({ ok: false, status: 'redis-not-ready', service: 'notif-service' });
  }
});

app.get('/dlq', async (req, res) => {
  const items = await redis.lRange(DLQ, 0, -1);
  res.json({ count: items.length, items: items.map(i => JSON.parse(i)) });
});

app.post('/dlq/requeue', async (req, res) => {
  const items = await redis.lRange(DLQ, 0, -1);
  await redis.del(DLQ);
  for (const raw of items) {
    const { data } = JSON.parse(raw);
    // re-drives through the same retry logic by re-publishing
    await redis.publish(CHANNEL, JSON.stringify(data));
  }
  res.json({ requeued: items.length });
});

// ── Start ─────────────────────────────────────────────────────────────────────

startWorker().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Notif service listening on :${port}`));
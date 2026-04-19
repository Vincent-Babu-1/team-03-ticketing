import { redisSubscriber } from "./redis.js";

console.log("WORKER FILE STARTED");
const CHANNEL = "confirmed-purchases";

async function startWorker() {
  console.log("Notification worker starting...");


  // 2. subscribe AFTER connection
  await redisSubscriber.subscribe(CHANNEL, (message) => {
    try {
      const data = JSON.parse(message);

      console.log("Received confirmed purchase:");
      console.log(data);

      // simulate email sending
      const emailLog = `
=== EMAIL SENT ===
To: ${data.email}
Subject: Purchase Confirmation
Body: Your purchase of ${data.item} is confirmed.
==================
`;

      console.log(emailLog);

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

// startup safety
startWorker().catch((err) => {
  console.error("🔥 Worker failed to start:", err);
  process.exit(1);
});
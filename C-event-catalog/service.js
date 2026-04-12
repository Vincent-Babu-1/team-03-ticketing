import express from "express"
import pg from "pg";
import { createClient } from "redis";

const { Pool } = pg;

const pool = new Pool({
  host: "event-cat-db",
  port: 5432,
  user: "user",
  password: "pass",
  database: "eventcatdb",
});

const redis = createClient({
  url: "redis://redis:6379",
});

await redis.connect();
console.log("Connected to Redis");

await pool.query("SELECT 1");
console.log("Connected to Postgres");

const app = express();

const PORT = 3001;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    const pong = await redis.ping();

    if (pong !== "PONG") {
      throw new Error("Redis ping failed");
    }

    res.status(200).json({
      status: "ok",
      postgres: "up",
      redis: "up",
    });
  } catch (err) {
    console.error("Health check failed:", err.message);

    res.status(503).json({
      status: "unhealthy",
      error: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
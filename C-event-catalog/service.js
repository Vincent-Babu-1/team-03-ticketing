import express from "express"
import pg from "pg";
import { createClient } from "redis";

const startTime = Date.now();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const redis = createClient({ url: process.env.REDIS_URL });

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

app.get("/events", (req, res) => {
    const body = [
        {
            "id": 1,
            "name": "Drake Concert",
            "venueId": 2,
            "date": "2026-05-10",
            "time": "20:00:00",
            "description": "Live concert",
            "category": "music"
        }
    ]
    return res.status(200).json(body)
});

app.get("/health", async (req, res) => {
    const checks = {}
    let healthy = true

    const dbStart = Date.now()
    try {
        await pool.query("SELECT 1");
        checks.database = { status: 'healthy', latency_ms: Date.now() - dbStart }
    }
    catch (err) {
        checks.database = { status: 'unhealthy', error: err.message }
        healthy = false
    }

    const redisStart = Date.now()
    try{
        const pong = await redis.ping();

        if (pong !== "PONG") {
            throw new Error("Redis ping failed");
        }

        checks.redis = { status: 'healthy', latency_ms: Date.now() - redisStart }

    } catch (err) {
        checks.redis = { status: 'unhealthy', error: err.message }
        healthy = false
    }

    const body = {
        status: healthy ? 'healthy' : 'unhealthy',
        service: "event-catalog",
        timestamp: new Date().toISOString(),
        uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
        checks,
    }

    res.status(healthy ? 200 : 503).json(body)
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
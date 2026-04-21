import express from "express"
import pg from "pg";
import { createClient } from "redis";

const data = [
        {
            "id": "00000000-0000-0000-0000-000000000101",
            "name": "Drake Concert",
            "price": 102,
            "dateTime": "2026-05-10T20:00:00Z",
            "description": "Live arena concert with opening acts.",
            "category": "music"
        },
        {
            "id": "00000000-0000-0000-0000-000000000102",
            "name": "Wolverines Home Game",
            "price": 68,
            "dateTime": "2026-05-14T18:30:00Z",
            "description": "Big game night with student section seating.",
            "category": "sports"
        },
        {
            "id": "00000000-0000-0000-0000-000000000103",
            "name": "Spring Comedy Fest",
            "price": 45,
            "dateTime": "2026-05-21T19:30:00Z",
            "description": "Stand-up showcase featuring national touring comics.",
            "category": "comedy"
        }
    ]

const EVENTS_LIST_KEY = "events:all";
const EVENTS_LIST_TTL = 60;
const EVENT_TTL = 300;

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

app.get("/events", async (req, res) => {
    try{
        const cached = await redis.get(EVENTS_LIST_KEY);
    }catch(err){

    }
    const body = data;
    return res.status(200).json(body);
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

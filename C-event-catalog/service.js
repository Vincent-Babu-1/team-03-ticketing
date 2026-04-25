import express from "express"
import pg from "pg";
import { createClient } from "redis";

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
  res.send("You've reached the event catalog server");
});

//seats
app.get("/events/:eventId/seats", async (req, res) => {
  const { eventId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT s.*
      FROM seats s
      JOIN event_sections es ON s.section_id = es.id
      WHERE s.event_id = $1
      ORDER BY es.section_name ASC, s.row ASC, s.seat_number ASC
      `,
      [eventId]
    );

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("Failed to fetch seats:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/events/:eventId/sections/:sectionId/seats", async (req, res) => {
  const { eventId, sectionId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM seats
      WHERE event_id = $1 AND section_id = $2
      ORDER BY row ASC, seat_number ASC
      `,
      [eventId, sectionId]
    );

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("Failed to fetch section seats:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/events/:eventId/sections/:sectionId/seats/:seatId", async (req, res) => {
  const { eventId, sectionId, seatId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM seats
      WHERE id = $1 AND event_id = $2 AND section_id = $3
      `,
      [seatId, eventId, sectionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Seat not found" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Failed to fetch seat:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/events/:eventId/sections/:sectionId/seats", async (req, res) => {
  const { eventId, sectionId } = req.params;
  const { row, seat_number, status } = req.body;

  try {
    if (!row || seat_number == null || !status) {
      return res.status(400).json({
        error: "row, seat_number, and status are required"
      });
    }

    if (!["available", "reserved", "sold"].includes(status)) {
      return res.status(400).json({
        error: "status must be available, reserved, or sold"
      });
    }

    const sectionResult = await pool.query(
      `
      SELECT id
      FROM event_sections
      WHERE id = $1 AND event_id = $2
      `,
      [sectionId, eventId]
    );

    if (sectionResult.rows.length === 0) {
      return res.status(404).json({ error: "Section not found for this event" });
    }

    const result = await pool.query(
      `
      INSERT INTO seats (
        event_id,
        section_id,
        row,
        seat_number,
        status
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [eventId, sectionId, row, seat_number, status]
    );

    await redis.del(`events:${eventId}`);
    await redis.del(EVENTS_LIST_KEY);

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Failed to create seat:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/events/:eventId/sections/:sectionId/seats/:seatId", async (req, res) => {
  const { eventId, sectionId, seatId } = req.params;
  const { row, seat_number, status } = req.body;

  try {
    const existingResult = await pool.query(
      `
      SELECT *
      FROM seats
      WHERE id = $1 AND event_id = $2 AND section_id = $3
      `,
      [seatId, eventId, sectionId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Seat not found" });
    }

    const existing = existingResult.rows[0];

    const updatedRow = row ?? existing.row;
    const updatedSeatNumber = seat_number ?? existing.seat_number;
    const updatedStatus = status ?? existing.status;

    if (!["available", "reserved", "sold"].includes(updatedStatus)) {
      return res.status(400).json({
        error: "status must be available, reserved, or sold"
      });
    }

    const result = await pool.query(
      `
      UPDATE seats
      SET
        row = $1,
        seat_number = $2,
        status = $3
      WHERE id = $4 AND event_id = $5 AND section_id = $6
      RETURNING *
      `,
      [
        updatedRow,
        updatedSeatNumber,
        updatedStatus,
        seatId,
        eventId,
        sectionId
      ]
    );

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Failed to update seat:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/events/:eventId/sections/:sectionId/seats/:seatId", async (req, res) => {
  const { eventId, sectionId, seatId } = req.params;

  try {
    const result = await pool.query(
      `
      DELETE FROM seats
      WHERE id = $1 AND event_id = $2 AND section_id = $3
      RETURNING *
      `,
      [seatId, eventId, sectionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Seat not found" });
    }

    return res.status(200).json({
      message: "Seat deleted successfully",
      deletedSeat: result.rows[0]
    });
  } catch (err) {
    console.error("Failed to delete seat:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

//event sections
app.get("/events/:eventId/sections", async (req, res) => {
  const { eventId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM event_sections
      WHERE event_id = $1
      ORDER BY section_name ASC
      `,
      [eventId]
    );

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("Failed to fetch event sections:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/events/:eventId/sections/:sectionId", async (req, res) => {
  const { eventId, sectionId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM event_sections
      WHERE id = $1 AND event_id = $2
      `,
      [sectionId, eventId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Section not found for this event" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Failed to fetch section:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/events/:eventId/sections", async (req, res) => {
  const { eventId } = req.params;
  const { section_name, price, capacity } = req.body;

  try {
    if (!section_name || price == null) {
      return res.status(400).json({
        error: "section_name and price are required"
      });
    }

    const eventResult = await pool.query(
      `
      SELECT id
      FROM events
      WHERE id = $1
      `,
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const result = await pool.query(
      `
      INSERT INTO event_sections (
        event_id,
        section_name,
        price,
        capacity,
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [eventId, section_name, price, capacity]
    );

    await redis.del(`events:${eventId}`);
    await redis.del(EVENTS_LIST_KEY);

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Failed to create section:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/events/:eventId/sections/:sectionId", async (req, res) => {
  const { eventId, sectionId } = req.params;
  const { section_name, price, capacity } = req.body;

  try {
    const existingResult = await pool.query(
      `
      SELECT *
      FROM event_sections
      WHERE id = $1 AND event_id = $2
      `,
      [sectionId, eventId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Section not found for this event" });
    }

    const existing = existingResult.rows[0];

    const updatedSectionName = section_name ?? existing.section_name;
    const updatedPrice = price ?? existing.price;
    const updatedCapacity = capacity ?? existing.capacity;

    const result = await pool.query(
      `
      UPDATE event_sections
      SET
        section_name = $1,
        price = $2,
        capacity = $3,
      WHERE id = $5 AND event_id = $6
      RETURNING *
      `,
      [
        updatedSectionName,
        updatedPrice,
        updatedCapacity,
        sectionId,
        eventId
      ]
    );

    await redis.del(`events:${eventId}`);
    await redis.del(EVENTS_LIST_KEY);

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Failed to update section:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/events/:eventId/sections/:sectionId", async (req, res) => {
  const { eventId, sectionId } = req.params;

  try {
    const result = await pool.query(
      `
      DELETE FROM event_sections
      WHERE id = $1 AND event_id = $2
      RETURNING *
      `,
      [sectionId, eventId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Section not found for this event" });
    }

    await redis.del(`events:${eventId}`);
    await redis.del(EVENTS_LIST_KEY);

    return res.status(200).json({
      message: "Section deleted successfully",
      deletedSection: result.rows[0]
    });
  } catch (err) {
    console.error("Failed to delete section:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

//events
app.get("/events/:eventId", async (req, res) => {
    const { eventId } = req.params;
    const EVENT_KEY = `events:${eventId}`
    try{
        const cached = await redis.get(EVENT_KEY);
        if (cached) {
            return res.status(200).json(JSON.parse(cached));
        }
        const result = await pool.query(`
            SELECT *
            FROM events
            WHERE id = $1
        `, [eventId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Event not found" });
        }
        
        const event = result.rows[0];

        await redis.set(EVENT_KEY, JSON.stringify(event), {
            EX: EVENT_TTL
        });

        return res.status(200).json(event);
    }catch(err){
        return res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/events", async (req, res) => {
    try{
        const cached = await redis.get(EVENTS_LIST_KEY);
        if (cached) {
            return res.status(200).json(JSON.parse(cached));
        }
        const result = await pool.query(`
            SELECT *
            FROM events
            ORDER BY date_time ASC
        `);

        const events = result.rows;

        await redis.set(EVENTS_LIST_KEY, JSON.stringify(events), {
            EX: EVENTS_LIST_TTL
        });

        return res.status(200).json(events);
    }catch(err){
        return res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/events", async (req, res) => {
  const { name, venue, base_price, date_time, description, category } = req.body;

  try {
    if (!name || !venue || base_price == null || !date_time) {
      return res.status(400).json({
        error: "name, venue, base_price, and date_time are required"
      });
    }

    const result = await pool.query(
      `
      INSERT INTO events (
        name,
        venue,
        base_price,
        date_time,
        description,
        category
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [name, venue, base_price, date_time, description, category]
    );

    const newEvent = result.rows[0];

    const EVENT_KEY = `events:${newEvent.id}`;

    await redis.set(EVENT_KEY, JSON.stringify(newEvent), {
      EX: EVENT_TTL
    });

    await redis.del(EVENTS_LIST_KEY);

    return res.status(201).json(newEvent);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/events/:eventId", async (req, res) => {
  const { eventId } = req.params;
  const EVENT_KEY = `events:${eventId}`;

  try {
    const result = await pool.query(
      `
      DELETE FROM events
      WHERE id = $1
      RETURNING *
      `,
      [eventId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    await redis.del(EVENT_KEY);
    await redis.del(EVENTS_LIST_KEY);

    return res.status(200).json({
      message: "Event deleted successfully",
      deletedEvent: result.rows[0]
    });
  } catch (err) {
    console.error("Failed to delete event:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

//health check
app.get("/health", async (req, res) => {
  const checks = {};
  let healthy = true;

  const dbStart = Date.now();
  try {
    await pool.query("SELECT 1");
    checks.database = { status: "healthy", latency_ms: Date.now() - dbStart };
  } catch (err) {
    checks.database = { status: "unhealthy", error: err.message };
    healthy = false;
  }

  const redisStart = Date.now();
  try {
    const pong = await redis.ping();

    if (pong !== "PONG") {
      throw new Error("Redis ping failed");
    }

    checks.redis = { status: "healthy", latency_ms: Date.now() - redisStart };
  } catch (err) {
    checks.redis = { status: "unhealthy", error: err.message };
    healthy = false;
  }

  const body = {
    status: healthy ? "healthy" : "unhealthy",
    service: "event-catalog",
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    checks
  };

    res.status(healthy ? 200 : 503).json(body)
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

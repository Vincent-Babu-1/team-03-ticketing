import express from "express"
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host: "event-db",
  port: 5432,
  user: "user",
  password: "pass",
  database: "mydb",
});

try {
  const client = await pool.connect();
  console.log("Connected to Postgres");
  client.release();
} catch (err) {
  console.error("DB connection error:", err);
}

const app = express();

const PORT = 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.get("health", (req, res) => {

});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
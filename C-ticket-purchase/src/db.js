import pg from 'pg';

// Connects to Postgres database using the URL from compose.yml
const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL 
});

// Used by health check to test if DB is reachable
export async function checkDb() {
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
}

export default pool;


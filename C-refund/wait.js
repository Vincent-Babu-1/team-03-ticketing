const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const waitForPg = async (pool, label) => {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      console.log(`${label}: database connected`);
      return;
    } catch (error) {
      console.log(`${label}: waiting for database, attempt ${attempt}`);
      await delay(1000);
    }
  }
  throw new Error(`${label}: database never became ready`);
};

export const waitForRedis = async (client, label) => {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      if (!client.isOpen) {
        await client.connect();
      }
      await client.ping();
      console.log(`${label}: redis connected`);
      return;
    } catch (error) {
      console.log(`${label}: waiting for redis, attempt ${attempt}`);
      await delay(1000);
    }
  }
  throw new Error(`${label}: redis never became ready`);
};

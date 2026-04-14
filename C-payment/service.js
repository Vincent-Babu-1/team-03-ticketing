import express from 'express'
import crypto from 'crypto'
import { checkDb, checkRedis } from './wait.js'

const SIMULATED_SUCCESS_RATE = process.env.SIMULATED_SUCCESS_RATE || '0.95';
const PORT = 3001;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const app = express();
app.use(express.json());
console.log('payment-service: server initiated.')

// Health check: GET /health -- returns 200 if DB and Redis are both reachable, 503 if either is down.
app.get('/health', async (req, res) => {
    const health = {db: 'ok', redis: 'ok'};
    let allGood = true;

    try {
        await checkDb();
    } catch {
        health.db = 'unavailable';
        allGood = false;
    }
    try {
        await checkRedis();
    } catch {
        health.redis = 'unavailable';
        allGood = false;
    }

    res.status(allGood ? 200: 503).json({service: "payment-service", status: allGood ? 'ok' : 'degraded', ...health});
});

// POST /payments -- creates a new payment for a purchase.
app.post("/payments", async(req, res) => {
    const { purchase_id, amount, cardToken } = req.body;
    if (!purchase_id || amount == null || amount <= 0 || !cardToken) {
        return res.status(400).json({error: 'Missing required fields: purchase_id, amount, cardToken'});
    }

    // check if paid already (if purchase_id already is linked to a payment, return original payment)
    const existing = await pool.query(
        'SELECT * FROM payments WHERE purchase_id = $1',
        [purchase_id]
    );
    if (existing.rows.length > 0) {
        console.log(`payment-service: duplicate charge attempted for purchase: ${purchase_id}`)
        return res.status(200).json(existing.rows[0]);
    }

    // simulated payment processing: chance for failure of payment, chance of success.
    // I/O bound work is payment processing to respond
    await sleep(250);
    const status = Math.random() < SIMULATED_SUCCESS_RATE ? 'succeeded' : 'failed';
    const paymentId = crypto.randomUUID();
    const result = await pool.query(
        `INSERT INTO payments (id, purchase_id, total_usd, status)
        VALUES ($1, $2, $3, $4) RETURNING *`,
        [paymentId, purchase_id, amount, status]
    );
    const payment = result.rows[0];
    console.log(`payment-service: paymentId: ${payment.id} charge ${payment.total_usd} for ${payment.purchase_id} has ${payment.status} status.`)
    // 402: payment required: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status
    return res.status(payment.status === "succeeded" ? 200: 402).json({
        payment_id: payment.id,
        purchase_id: payment.purchase_id,
        status: payment.status === "succeeded" ? "success": "failed",
        amount: (payment.status === "succeeded" ? payment.total_usd : 0)
    });
});

app.get('/payments/:purchase_id', async(req,res) => {
    console.log("To Be Implemented, not done in Sprint 1");
});

// refunding:
// Refund Service:  'then calls the Payment Service to reverse the charge 
// and publishes a "seat released" event on Redis pub/sub so the Wait list 
// Worker can promote the next user.'
app.post("/payments/reverse", async(req, res) => {
    console.log("To Be Implemented, not done in Sprint 1");
});

app.listen(PORT, async () => {
  console.log(`ticket-payment-service running on port ${PORT}`);
});
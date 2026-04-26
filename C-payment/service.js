import express from 'express'
import crypto from 'crypto'
import { pool, checkDb, checkRedis, redis } from './wait.js'

const SIMULATED_SUCCESS_RATE = parseFloat(process.env.SIM_SUCCESS_RATE || '1.0');
const PORT = 3001;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const app = express();
app.use(express.json());
console.log('payment-service: server initiated.')

// http://localhost:3003/
app.get("/", (req, res) => {
  res.send("Hello World FROM payment-service");
});

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

    // if purchase already exists, return it. idempotency check
    const existing = await pool.query(
        'SELECT * FROM payments WHERE purchase_id = $1',
        [purchase_id]
    );
    if (existing.rows.length > 0) {
        console.log(`payment-service: duplicate charge attempted for purchase: ${purchase_id}`)
        const existingPayment = existing.rows[0]
        return res.status(200).json({
            payment_id: existingPayment.id,
            purchase_id: existingPayment.purchase_id,
            status: existingPayment.status === "succeeded" ? "success" : existingPayment.status,
            amount: (existingPayment.status === "succeeded" ? existingPayment.total_usd : 0)
        });
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

// Lookup a payment by purchase_id
app.get('/payments/:purchase_id', async(req,res) => {
    const id = req.params.purchase_id;
    const payment = await pool.query(
        ' SELECT * FROM payments WHERE purchase_id = $1',
        [id]
    );
    if (payment.rows.length === 0) {
        return res.status(404).json({error: `Payment with purchase_id ${id} not found.`})
    }
    return res.status(200).json(payment.rows[0]);
});

// refunding: Payment Service reverses charge, publishes a "seat released" event on Redis pub/sub
// so the Wait list Worker can promote the next user. 
app.post("/payments/reverse", async(req, res) => {
    const { purchase_id, refund_id } = req.body;
    if (!purchase_id || !refund_id) {
        return res.status(400).json({error: "Missing purchase_id to refund."})
    }
    const payment = await pool.query(
        'SELECT * FROM payments WHERE purchase_id = $1', [purchase_id]
    );
    if (payment.rows.length === 0) {
        return res.status(404).json({error: `No payment found of purchase id: ${purchase_id}`})
    }
    const paymentData = payment.rows[0];
    // Safety check -- did we already refund?
    if (paymentData.status === 'refunded') {
        console.log(`Already refunded purchase: ${purchase_id}`);
        return res.status(202).json({
            payment_id: paymentData.id,
            refund_id: paymentData.refund_id,
            purchase_id: paymentData.purchase_id,
            status: paymentData.status,
            total_usd: paymentData.total_usd
        });
    } // also if a payment failed, you should NOT be allowed to refund it.
    if (paymentData.status === 'failed') {
        return res.status(400).json({error: `Payment failed, nothing to refund for purchase: ${purchase_id}`})
    }
    // if there is a payment to refund:
    await sleep(250); // simulated refund payment work.
    const updated = await pool.query(
        `UPDATE payments SET status = 'refunded', updated_at = NOW(), refund_id = $1
        WHERE purchase_id = $2 RETURNING *`, [refund_id, purchase_id]
    );
    const reservation = await pool.query(
        `UPDATE reservations SET status = 'released', updated_at = NOW() 
        WHERE purchase_id = $1
        RETURNING *
        `, [purchase_id]
    ); // we release the seat(s) for the purchase as well, as refunded.
    await redis.publish('seat-released', JSON.stringify({ purchaseId: purchase_id, eventId: reservation.rows[0].event_id, seat: reservation.seat }))
    console.log("Published to seat-released pubsub that seat(s) have been released.")
    const refunded = updated.rows[0];
    console.log(`refunded purchase ${purchase_id} and released all associated seats.`)
    return res.status(200).json({
        payment_id: refunded.id,
        purchase_id: refunded.purchase_id,
        refund_id: refunded.refund_id,
        status: refunded.status,
        total_usd: refunded.total_usd
    })
});

app.listen(PORT, async () => {
  console.log(`ticket-payment-service running on port ${PORT}`);
});

await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY,
    purchase_id UUID NOT NULL,
    refund_id UUID UNIQUE,
    total_usd NUMERIC(10,2) NOT NULL CHECK (total_usd > 0),
    status TEXT NOT NULL CHECK (status IN ('failed', 'refunded', 'succeeded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);  
`);
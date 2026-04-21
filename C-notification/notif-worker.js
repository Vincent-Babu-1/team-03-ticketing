import { redisSubscriber } from "./redis.js";

console.log("WORKER FILE STARTED");

const purchaseId = "abc123";
const userId = "user456";
const eventId = "event789";

await redis.publish('confirmed-purchases', JSON.stringify({ purchaseId, userId, eventId }));

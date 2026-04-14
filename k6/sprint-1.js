// Sprint 1 — Baseline load test
//
// Run from inside the holmes container:
//   docker compose exec holmes bash
//   k6 run /workspace/k6/sprint-1.js
//
// Or from your host machine if k6 is installed:
//   k6 run k6/sprint-1.js
//
// Replace TARGET_URL with your main read endpoint.

import http from "k6/http";
import { check, sleep } from "k6";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js"
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

// ── Configuration ─────────────────────────────────────────────────────────────
// Update this URL to point to your main read endpoint.
// From inside the holmes container, use the service name (not localhost).
//const TARGET_URL = "http://refund-service:3005/health"; // OLD
const TARGET_URL = "http://purchase-service:3002/purchases"; // NEW

function newUUID(){ 
  //return crypto.randomUUID(); 
  return uuidv4();
}

export const options = {
  stages: [
    { duration: "30s", target: 20 }, // ramp up to 20 VUs
    { duration: "30s", target: 20 }, // sustain
    { duration: "10s", target: 0  }, // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests under 500ms
    errors: ["rate<0.01"],            // less than 1% error rate
  },
};

export default function () {
  // NEW
  // /* 
  const data = {
    purchaseId: newUUID(),
    userId: "test-user-1",
    eventId: "test-event-1",
    quantity: 2,
    cardToken: "test-card-1"
  }

  let res = http.post(TARGET_URL, JSON.stringify(data), {
    headers: { 
      'Content-Type': 'application/json',
      'Idempotency-Key': newUUID()
    },
  });

  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  errorRate.add(!ok);
  sleep(0.5);

  // */

  // OLD
  /*
  const res = http.get(TARGET_URL);
  
  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });
  
  errorRate.add(!ok);
  sleep(0.5);
  */
}

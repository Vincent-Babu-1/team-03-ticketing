// Sprint 2 — Comparison load test
//
// Run from inside the holmes container:
//   docker compose exec holmes bash
//   k6 run /workspace/k6/sprint-2-cache.js
//
// Or from your host machine if k6 is installed:
//   k6 run k6/sprint-2-cache.js
//



import http from "k6/http";
import { check, sleep } from "k6";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js"
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

// ── Configuration ─────────────────────────────────────────────────────────────
// Update this URL to point to your main read endpoint.
// From inside the holmes container, use the service name (not localhost).
const TARGET_URL = "http://purchase-service:3001/purchases"; // NEW
const TARGET_URL1 = "http://purchase-service:3001/purchases/"; // NEW

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

// Literally exactly the same as sprint 1's k6 test, except also get the inputted information;
// comparison between the two will be done by hand afterwards

export default function () {
  
  const data = {
    userId: newUUID(),
    eventId: newUUID(),
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
  
  sleep(0.5);

  const getURL = TARGET_URL1 + res.json().purchaseId
  const res1 = http.get(getURL);
  
  const ok1 = check(res1, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });
  
  errorRate.add((!ok) || (!ok1));
  sleep(0.5);

}

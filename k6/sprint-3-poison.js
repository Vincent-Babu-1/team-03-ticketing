import http from 'k6/http'
import { check, sleep } from 'k6'
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js"

const TARGET_URL = 'http://purchase-service:3001/purchases'

function newUUID(){ 
  //return crypto.randomUUID(); 
  return uuidv4();
}

// 80% valid requests, 20% poison pills
export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '30s', target: 20 },
    { duration: '10s', target: 0 },
  ],
}

const poison1 = { //deformed purchaseId
    purchaseId: "haha-poison-purchase",
    userId: newUUID(),
    eventId: newUUID(),
    quantity: 2,
    cardToken: "test-card-X"
}

const poison2 = { //missing fields
    purchaseId: newUUID(),
    eventId: newUUID(),
    cardToken: "test-card-X"
}

export default function () {
  const isPoisonPill = Math.random() < 0.2

  if (isPoisonPill) {
    // Send a deliberately malformed request: 1 of 3 types

    const poisonTypeChoice = Math.random()

    if (poisonTypeChoice < 0.33){ //deformed purchaseId
        let res = http.post(TARGET_URL, JSON.stringify(poison1), {
        headers: { 
            'Content-Type': 'application/json',
            'Idempotency-Key': newUUID()
          },
        });
        const ok = check(res, {
          "status is 200": (r) => r.status === 202,
          "response time < 500ms": (r) => r.timings.duration < 500,
        });
    }
    else if (poisonTypeChoice < 0.66) { //missing fields
        let res = http.post(TARGET_URL, JSON.stringify(poison2), {
        headers: { 
            'Content-Type': 'application/json',
            'Idempotency-Key': newUUID()
          },
        });
        const ok = check(res, {
          "status is 200": (r) => r.status === 202,
          "response time < 500ms": (r) => r.timings.duration < 500,
        });
    } else {
        let res = http.post(TARGET_URL, JSON.stringify(poison1), {
        headers: { 
            'Content-Type': 'application/json',
            'Idempotency-Key': "haha-poison-idem"
          },
        });
        const ok = check(res, {
          "status is 200": (r) => r.status === 202,
          "response time < 500ms": (r) => r.timings.duration < 500,
        });
    }

    const data = {
      purchaseId: newUUID(),
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
      "status is 202": (r) => r.status === 202,
      "response time < 500ms": (r) => r.timings.duration < 500,
    });
    
    sleep(0.5);
    // We expect this to be accepted (HTTP 202) and routed to the DLQ by the worker
  } else {
    // Send a normal, valid request
    const data = {
      purchaseId: newUUID(),
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
  }

  sleep(0.5)
}
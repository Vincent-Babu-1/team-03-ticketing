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

function getNewGoodData(testCardName = "test-card-0"){
  return {
        purchaseId: newUUID(),
        userId: newUUID(),
        eventId: newUUID(),
        //quantity: 2, //deprecated
        cardToken: testCardName,
        seats: ["B1", "B2", "B3"]
      };
}

function getPoison1(){
  const retTable = getNewGoodData("test-card-X") 
  retTable.purchaseId = "haha-poison-purchase"
  return retTable
}

function getPoison2(){
  const retTable = getNewGoodData("test-card-Y") 
  retTable.seats = null
  return retTable
}

const printExtra = false;

export default function () {
  const isPoisonPill = Math.random() < 0.2

  if (isPoisonPill) {
    // Send a deliberately malformed request: 1 of 3 types

    const poisonTypeChoice = Math.random()

    if (poisonTypeChoice < 0.33){ //deformed purchaseId
      //console.log("poison: purchaseId")
      let res = http.post(TARGET_URL, JSON.stringify(getPoison1()), {
      headers: { 
          'Content-Type': 'application/json',
          'Idempotency-Key': newUUID()
        },
      });
      const ok = check(res, {
        "status is 200": (r) => {if (printExtra){console.log("1: ",r.status);}return r.status === 200;},
        "response time < 500ms": (r) => r.timings.duration < 500,
      });
    }
    else if (poisonTypeChoice < 0.66) { //missing fields
      //console.log("poison: missing fields")
      let res = http.post(TARGET_URL, JSON.stringify(getPoison2()), {
      headers: { 
          'Content-Type': 'application/json',
          'Idempotency-Key': newUUID()
        },
      });
      const ok = check(res, {
        "status is 400": (r) => {if (printExtra){console.log("2: ",r.status);}return r.status === 400;},
        "response time < 500ms": (r) => r.timings.duration < 500,
      });
    } else { // bad idempotency key
      //console.log("poison: idempotency key")
      let res = http.post(TARGET_URL, JSON.stringify(getNewGoodData("test-card-Z")), {
      headers: { 
          'Content-Type': 'application/json',
          'Idempotency-Key': "haha-poison-idem"
        },
      });
      const ok = check(res, {
        "status is 400": (r) => {if (printExtra){console.log("3: ",r.status);}return r.status === 400;},
        "response time < 500ms": (r) => r.timings.duration < 500,
      });
    }
    
    // We expect this to be accepted (HTTP 202) and routed to the DLQ by the worker
  } else {
    // Send a normal, valid request

    let res = http.post(TARGET_URL, JSON.stringify(getNewGoodData("test-card-1")), {
      headers: { 
        'Content-Type': 'application/json',
        'Idempotency-Key': newUUID()
      },
    });

    const ok = check(res, {
      "status is 200": (r) => {if (printExtra){console.log("4: ",r.status);}return r.status === 200;},
      "response time < 500ms": (r) => r.timings.duration < 500,
    });
    
    sleep(0.5);
  }

  sleep(0.5)
}
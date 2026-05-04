// Sprint 4 — 
//
// Run from inside the holmes container
// First test with normal worker counts:
//   docker compose up --build -d
//   docker compose exec holmes bash
//   k6 run /workspace/k6/sprint-4-scale.js

// First test with normal worker counts:
//   docker compose down
//   docker compose up --build --scale analytics-worker=3 -d //!!needs editing in Caddyfile and compose.yml!!
//   docker compose exec holmes bash
//   k6 run /workspace/k6/sprint-4-scale.js


import http from 'k6/http'
import redis from 'k6/x/redis';
import { check, sleep } from 'k6'
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js"
import { Rate } from "k6/metrics";

function newUUID(){ 
  return uuidv4();
}

const BASE_URL = 'http://analytics-worker:3001/analytics' // remove when Caddy updated
//const BASE_URL = 'http://analytics-worker-1:3001/analytics' // add when Caddy updated to test only one replica
//const BASE_URL = 'http://analytics-worker:80/analytics' // add when Caddy updated to INSTEAD test all replicas

const numQueuePushesPerRound = 3

const errorRate = new Rate("errors");

const redisClient = new redis.Client('redis://redis:6379');

function getNewQueueData(){
  return '{"event":"ticket_purchased","purchaseId":"' + newUUID() + '","eventId":"cccccccc-0000-0000-0000-000000000001","quantity":2}' ;
} 

async function pushNewQueueData(){
  await redisClient.rpush('analytics-queue', getNewQueueData());
  return true;
} 

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '60s', target: 50 }, // push harder than Sprint 1 to show scaling benefit
    { duration: '10s', target: 0 },
  ],
  
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests under 500ms
    errors: ["rate<0.01"],            // less than 1% error rate
  },
}

export default function () {
  for (let i=0; i<numQueuePushesPerRound; i++) {
    pushNewQueueData()
  }

  const res = http.get(BASE_URL)
  check(res, { 'status is 200': r => r.status === 200 })
  sleep(0.5)
}
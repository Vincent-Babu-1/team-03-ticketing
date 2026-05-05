// Sprint 4 — 

// Open TWO terminals

// First test with normal worker counts:
//   docker compose down
//   docker compose up --scale analytics-worker=3  --build -d
//   docker compose exec holmes bash
//   k6 run /workspace/k6/sprint-4-replica.js

// Then, while that is running, in the 2nd terminal run:
//   docker compose ps analytics-worker -q (to get the container ids of the replicas)
// 029b2a2629ce8145f05462ce90a710419e60c1380d16cfefa3952d61b608a172
// eea38b9e6b164d10b298fa450949976b0b239a27f330b27d7275f1fd4aa20fc8
// 91894f7daf265202aaafc54f15fe972341dc4d37d55fcd5769401c8a5f0f9367
//   docker stop eea38b9e6b164d10b298fa450949976b0b239a27f330b27d7275f1fd4aa20fc8
//   docker compose ps (to show that this service is unhealthy)

//   docker compose up --scale analytics-worker=3 --scale fraud-worker=3 --scale waitlist-worker=3 -d --build
//   docker compose ps (to show that this service is healthy)

//   no k6 queries should fail, and nothing extraordinary should happen when the replica rejoins the system.


import http from 'k6/http'
import redis from 'k6/x/redis';
import { check, sleep } from 'k6'
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js"
import { Rate } from "k6/metrics";

function newUUID(){ 
  return uuidv4();
}

const BASE_URL = 'http://analytics-worker:3001/analytics' 

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
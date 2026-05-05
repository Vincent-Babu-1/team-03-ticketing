
import http from 'k6/http'
import redis from 'k6/x/redis';
import { check, sleep } from 'k6'
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js"
//import { uuidv4 } from 'https://k6.io';
import { Rate } from "k6/metrics";

const BASE_URL = 'http://analytics-worker:3001/health'

export default function () {
  const res = http.get(BASE_URL)
  check(res, { 'status is 200': r => r.status === 200 })
}
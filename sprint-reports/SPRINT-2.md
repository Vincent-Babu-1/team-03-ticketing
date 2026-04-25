# Sprint 2 Report — [Team Name]

**Sprint:** 2 — Async Pipelines and Caching  
**Tag:** `sprint-2`  
**Submitted:** [date, before 04.21 class]

---

## What We Built

[What cache did you add? What queue and worker are running? What does the async pipeline do?]

---

## Individual Contributions

| Team Member | What They Delivered | Key Commits |
| ----------- | ------------------- | ----------- |
| Vincent Babu | k6 async + cache test, Sprint 2 Report | 94dd0de58b951e2a666f22779372121b2f736a40 |
|              |                                        | 5a647981c1f7238c9050c4db43d03eb7aee925bd |
|              |                                        | (this commit)                            |
| Tien Nguyen  | fraud worker health endpoint beginning  | 6a4291f017122231289a425812c4ea4b32468f33 |
|              |                                         | 97335a5894e5cf5fafe6b73dd4d80f15625b73a3 |
|  Benson Zheng    |  implement Redis cache for event catalog          | dc6d4973cb7a962f569ed20f79cabf6a12c0743d |
| Helektra Katsoulakis  |   analytics worker /health, but only on personal branch |3411132faa394be66221700bf05626d7c7e8bae2 |
| Julia Farber          | idempotency in purchase and payment services       | 7cbf41e2ba66a3e32b20be440294313f2739e32c |
|                       |                                                    | 90ef03a1c6d385586424d09f25cd7ebbcbc460fa |
| Katelyn Leung         | Sprint 2 plan  |  561ba0f57118183c4b4177893145a718b9e775fc |
| Maria Mechery         | user waitlist worker /health        | 36d7dd96e568f19cfad143d12af973663e313b34 |
|                       |                                     | f3a1580a21880703a43be38240050b17ed4dfded |
| Franco Htet           | initial UI for event catalog (`http://localhost`)  | 1f22e0029033b50a6413f114474a5add5248972a |
| Rihui Lu           | notification service and worker work, but only on personal branch  |  |

---

## What Is Working

- [X] Redis cache in use — repeated reads do not hit the database
- [X] Async pipeline works end-to-end (message published → worker consumes → action taken)
- [X] At least one write path is idempotent (same request twice produces same result)
- [X] Worker logs show pipeline activity in `docker compose logs`
- [ ] Worker `GET /health` returns queue depth, DLQ depth, and last-job-at

---

## What Is Not Working / Cut

The fraud worker's health endpoint currently waits forever, without returning a result. Attempts to resolve this issue are ongoing.

---

## k6 Results

### Test 1: Caching Comparison (`k6/sprint-2-cache.js`)

| Metric | Sprint 1 Baseline | Sprint 2 Cached | Change |
| ------ | ----------------- | --------------- | ------ |
| p50 (avg) | 134.21ms       | 4.04ms          | -130.17ms |
| p95       | 270.74ms       | 7.02ms          | -263.72ms |
| p99       | --------       | ---------       | --------- |
| RPS       | 22.508643      | 28.423493       | +5.91485  |

Response times significantly improved for requests that retrieved information that was just put into databases. This is because the information was searched in the cache first, and only if not found was the database queried (a slower operation). So for all of these tested requests, the cache would find the information and return it immediately. This drastically reduced the time it took to complete the GET /events endpoint call.

### Test 2: Async Pipeline Burst (`k6/sprint-2-async.js`)

```
THRESHOLDS 

    errors
    ✓ 'rate<0.01' rate=0.00%

    http_req_duration
    ✓ 'p(95)<500' p(95)=272.64ms

  █ TOTAL RESULTS 

    checks_total.......: 5880    83.018543/s
    checks_succeeded...: 100.00% 5880 out of 5880
    checks_failed......: 0.00%   0 out of 5880

    ✓ status is 200
    ✓ response time < 500ms

    CUSTOM
    errors.........................: 0.00%  0 out of 980

    HTTP
    http_req_duration..............: avg=178.53ms min=2.23ms med=263.2ms max=377.73ms p(90)=269.67ms p(95)=272.64ms
      { expected_response:true }...: avg=178.53ms min=2.23ms med=263.2ms max=377.73ms p(90)=269.67ms p(95)=272.64ms
    http_req_failed................: 0.00%  0 out of 2940
    http_reqs......................: 2940   41.509271/s

    EXECUTION
    iteration_duration.............: avg=1.03s    min=1.02s  med=1.03s   max=1.16s    p(90)=1.04s    p(95)=1.05s   
    iterations.....................: 980    13.836424/s
    vus............................: 2      min=1         max=20
    vus_max........................: 20     min=20        max=20

    NETWORK
    data_received..................: 1.3 MB 18 kB/s
    data_sent......................: 732 kB 10 kB/s

running (1m10.8s), 00/20 VUs, 980 complete and 0 interrupted iterations
default ✓ [ 100% ] 00/20 VUs  1m10s
```

Worker health during the burst (hit `/health` while k6 is running):

```json
{
  "status": "ok",
  "checks": {
    "redis": "ok",
    "database": "ok"
  },
  "queueDepth": 2,
  "dlqDepth": 0,
  "lastJobAt": "2026-04-21T13:09:10.654Z"
}
```

Idempotency check: 

Idempotency is present in the refund service. The following request was sent into the holmes shell twice:

```bash
curl -s -X POST http://refund-service:3005/refund-request \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" \
  -d '{"refundRequestId": "refund-004", "purchaseId": "purchase-001"}' | jq .
```
The first attempt returns the following json:
```json
{
  "refundRequestId": "refund-004",
  "purchaseId": "purchase-001",
  "success": true
}
```
Following attempts return the following json:
```json
{
  "refundRequestId": "refund-004",
  "purchaseId": "purchase-001",
  "success": false,
  "duplicate": true
}
```
The return message tells us that this request was a duplicate of a previously sent request; it was ignored (no side effect occurred).

---

## Blockers and Lessons Learned

We must do our best to complete work earlier than the night before sprint is due. Putting importance on timeliness leaves time to fix issues, collect test results, and log sprint report information. For filling out k6 test results, nearly every other task is a blocking one.
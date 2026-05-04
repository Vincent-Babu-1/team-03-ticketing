# Sprint 3 Report — Team 3

**Sprint:** 3 — Reliability and Poison Pills  
**Tag:** `sprint-3`  
**Submitted:** 04.27

---

## What We Built

The Event Catalog service now has frequent regex checks to determine if the inputted event, seat, or section ID is a valid UUID-formatted string, each attached to Error 400 messages if the checks fail. The Purchase and Payment services now coordinate to not leave seats hanging if payment fails; seats are momentarily reserved while waiting on payment, then become available if payment fails. Those are the failure scenarios our group specifically planned for, but every worker handles poison pills via dead letter queues when appropriate, and there are many more checks throughout the system validating input variable types, database input format, idempotency, and more.

The analytics worker, the fraud worker, the notification service, and the waitlist worker have DLQ handling. In all tested cases, a poison pill injection moves to the associated dead-letter queue, where it will stay. The notification service has a GET /dlq endpoint to present the current notification DLQ and a POST /dlq/requeue endpoint to retry all of the requests in that DLQ. No other service has structures in place to service a DLQ.

---

## Individual Contributions

| Team Member | What They Delivered | Key Commits |
| ----------- | ------------------- | ----------- |
| Vincent Babu | k6 poison test, Sprint 3 Report, refund service + README update | 37bf21cb7e56552b655815af597aa2867dcfb795 |
|                       |                                                        | 6bbd853bd9dc78ae8da6fb858ad8fc4f2bf03874 |
|                       |                                                        | 77b6c1d90b37d0f29ea42a47a12034980644a3e6 |
|                       |                                                        | b3a2d2dbf0cce22e6a0cefd133d7e176597107bf |
|                       |                                                        | 5e3117078619a963146bc878761e41ca91e17ff6 |
| Tien Nguyen  | fraud worker + database complete                + README update | d7f5b0f06855076ec1b133698266102e9b2217ef |
|                       |                                                        | 5134dc3368bc5610eae7485990df2bcf554af3ff |
|                       |                                                        | 4d99e6395152efe11d47ce57550c5cb1bc79cb8d |
| Benson Zheng | event catalog service + database complete       + README update | c4b7a1177219c7099fada09de373912615145e71 |
|                       |                                                        | 22f74f4cca5e097ac6cf4f11e0b40dfc60a7d9fa |
| Helektra Katsoulakis  | analytics worker + database complete   + README update | e295a2ee39ef249e841fafdd16d625d8cf6365f4 |
|                       |                                                        | 280cfb35287f8d46e7b8ba149e4b47355d6a2d53 |
|                       |                                                        | bb62cceacc8cc2b3fa77e04ad2090333ebb0886d |
|                       |                                                        | 6bd147d268ec73980c75d564934792ef353afdc2 |
|                       |                                                        | d50784d665af5fc51ade97a82fab6cfa6b82ff9a |
|                       |                                                        | c3dfab5662da97ecfb6e81583eca6775e5640f32 |
| Julia Farber          | payment service + refund compatibility + README update | e2b533b387f55367ffb17dba644912d5c4f096ab |
|                       |                                                        | b8615fe7728d40b6e8487b2ac40fd35b02a49276 |
|                       |                                                        | 3b0586fcfd03efcbf6972e9c2a0fe8f1f1b53cf1 |
|                       |                                                        | 9af5d8e7a0987e2496a5f826b206558a3b3b54db |
| Katelyn Leung         | Sprint 3 plan                                          | 563361e7f06daba5894e43836bf8a36e017073cc |
|                       |                                                        | ac06d0eb6441d167bba6118725496487053ea126 |
|                       |                                                        | 6af146da741c9cd732a34e333fcc6ae0ba9065bf |
|                       |                                                        | fe23b49b68509d00fcde17606dc97f39aff09a92 |
|                       |                                                        | b6f11753bae6f43e799f9e6abdffcfa2b1ec8973 |
| Maria Mechery         | purchase service + waitlist worker     + README update | daa01def02a5bc95259a5735a58aa28df6a97969 |
|                       |                                                        | f7d8fff63bbd6dfc5aacbb91838f1cebc9e0d3ff |
| Franco Htet           | UI progress                            + README update | fec3603b3fc3b451780b00ca7d4448014821137b |
|                       |                                                        | b26a17304c51afdf7bb10f3ad61173897f6e3950 |
|                       |                                                        | 310594b415ca4247fc692355edd7989476ac73f5 |
|                       |                                                        | 3761fb367291cb33d5a96f26e2e4d324f348a3df |
| Rihui Lu              | notification service complete          + README update | 808da2ad842892abf59c52f8824761a6abceef53 |
|                       |                                                        | 0e38ae0a521db98ec17ce6adae348f5cf21a5842 |
|                       |                                                        | fd22674bf009cc20bd749c2e79f47915d9cfb026 |
|                       |                                                        | 68c5a99f2bdb05dc78533dd8974846067f74692d |

---

## What Is Working

- [X] Poison pill handling: malformed messages go to DLQ, worker keeps running
- [X] Worker `GET /health` shows non-zero `dlq_depth` after poison pills are injected
- [X] Worker status remains `healthy` while DLQ fills
- [X] System handles failure scenarios gracefully (no dangling state, no crash loops)
- [X] All services/workers required for team size are implemented

---

## What Is Not Working / Cut

We were not able to plan for a third specific failure scenario before our deadline. While our system is very robust, we did not have a concise enough plan for work to be motivated against any individual component of our system. 

---

## Poison Pill Demonstration

How to inject a poison pill:

```bash
# From inside holmes:
docker compose exec holmes bash

# Example — publish a malformed message directly to the queue:
redis-cli -h redis RPUSH analytics-queue '{"this": "is malformed"}'
```

Worker health before injection:

```json
{
  "service": "analytics-worker",
  "status": "ok",
  "queueDepth": 0,
  "dlqDepth": 0,
  "lastJobAt": null,
  "db": "ok",
  "redis": "ok"
}
```

Worker health after injection:

```json
{
  "service": "analytics-worker",
  "status": "ok",
  "queueDepth": 0,
  "dlqDepth": 1,
  "lastJobAt": null,
  "db": "ok",
  "redis": "ok"
}
```

---

## k6 Results: Poison Pill Resilience (`k6/sprint-3-poison.js`)

```
█ TOTAL RESULTS 

  checks_total.......: 1770    25.178071/s
  checks_succeeded...: 100.00% 1770 out of 1770
  checks_failed......: 0.00%   0 out of 1770
  ✓ status is 400
  ✓ response time < 500ms
  ✓ status is 200

  HTTP
  http_req_duration..............: avg=240.84ms min=1.28ms   med=273.09ms max=385.41ms p(90)=278.03ms p(95)=280.26ms
    { expected_response:true }...: avg=274.37ms min=267.78ms med=273.49ms max=385.41ms p(90)=278.77ms p(95)=280.55ms
  http_req_failed................: 12.31% 109 out of 885
  http_reqs......................: 885    12.589035/s

  EXECUTION
  iteration_duration.............: avg=1.14s    min=501.95ms med=1.27s    max=1.38s    p(90)=1.27s    p(95)=1.28s   
  iterations.....................: 885    12.589035/s
  vus............................: 1      min=1          max=20
  vus_max........................: 20     min=20         max=20

  NETWORK
  data_received..................: 422 kB 6.0 kB/s
  data_sent......................: 348 kB 4.9 kB/s
```

| Metric | Normal-only run | Mixed with poison pills | Change |
| ------ | --------------- | ----------------------- | ------ |
| p95    | 315.46ms        | 280.26ms                | -35.20ms    |
| RPS    | 11.208466/s     | 12.589035/s             | +1.380569/s |
| Error rate | 0.00%       | 12.31%                  | +12.31%     |

Throughput remained relatively stable throughout the poison pill test. While the requests per second suffered slightly, the 95th percentile statistic improved slightly. This suggests that the performance is about the same when running the test with only normal requests and when running with poison pills. When running the command `curl http://purchase-service:3001/health | jq .`, the purchase service stayed healthy throughout the test.

---

## Blockers and Lessons Learned

We did not communicate clearly enough on what our three failures scenarios were going to be; we merely assigned them to certain members, and they worked out what failure scenarios to choose based on what services they were already working on. Our plan lacked the specificity required to maintain accountability. In the future, we will all agree on the sprint start day not only who is in charge of what responsibility, but also exactly what those responsibilities are. That way, group members can also keep each other accountable by monitoring their progress via repository commits.
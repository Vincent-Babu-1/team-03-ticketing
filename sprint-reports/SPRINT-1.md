# Sprint 1 Report — [Team 3]

**Sprint:** 1 — Foundation  
**Tag:** `sprint-1`  
**Submitted:** [date, before 04.14 class]

---

## What We Built

All core services and their databases are running. Remaining databases and notification service + worker are also implemented. `docker compose up` produces a running system that be accessed via the holmes shell with either `curl` or the k6 tests. All implemented services have a health endpoint, and all implemented services report "(health)" via `docker compose ps`. The refund service has working but unfinished /refunds endpoint that logs a refund request. The purchase service has a working /purchases POST endpoint (which simulates a ticket purchase) that synchronously calls the /payments endpoint from the payment service (which simulates sending payment via a time delay). Additionally, the purchases service has a GET /purchases endpoint which returns the purchase specified by a given id.

---

## Individual Contributions

| Team Member | What They Delivered                                     | Key Commits            |
| ----------- | ------------------------------------------------------- | ---------------------- |
| Benson Zheng      | event-cat-service, related compose.yml                  | 02a14ebe1ff32de149dd80a575e7710fb9c289d3 |
|                   |                                                         | 4c4bde5027603e820a6e4c0b15a06eaf66421856 |
|                   |                                                         | a75e14bd3a5ee374dcd338049836d72d9899e03c |
| Helektra Katsoulakis| analytics db + service                                | bfb54465a6f6f24000b7002fecee69206759b973 |
|                   |                                                         | 448fbb0a89c3cb55113863d06b2eb2994fb4fb6c |
|                   |                                                         | a75e14bd3a5ee374dcd338049836d72d9899e03c |
| Julia Farber      | analytics db + service                                | 534d0bed48a8da1e92ad5c2549469806f5481f13 |
|                   |                                                         | 3b926929abc3e96a293ad6eab2352d2aa3890dfc |
|                   |                                                         | 5edfb45b92111adfde2e0db2a0e1d2d5ebcb1403 |
| Katelyn Leung     | notification service, event catalog db                   |a258dfb768386abc0fcb3e906dca42a99da39ae6|
|                   |                                                          |8340c03bbebdb2a78b19cb87dce157dac6128251|
| Maria Mechery     | user waitlist, ticket purchase service                   |cd9b9161da0c63cad1b79b475897c7879a94a729|
|                   |                                                          |fa72749fdf49f44cc1ec25b132791e93ded1e483|
|                   |                                                          |04a881c627d7ccd41c4ff83976bbc10a5f1b16a6|
| Tien Nguyen       | compose.yml and README                                   |5e3a993778e5f11fd290b056d491f0da81444a0a|
|                   |                                                          |7d42f38b29eacb4a2b065885869f2e9b9e0882f9|
| Vincent Babu      | compose.yml, README, k6, refund service+db, misc fixes   |b6ccb3279a3fdca6f6088c38eb3da4fc557bd71c|
|                   |                                                          |5fd66a47f6143de89851b0f3415cc408e812ef8d|
|                   |                                                          |5aa3d3c21a5b028092fd8ec4fdc383c9dc06b24b|
|                   |                                                          |ab47346ea63874b10be6b67c9ae603a48fb8aee7|
|                   |                                                          |87342c2aa63d951971a90e15a9f3f1c3644bcb5e|
|                   |                                                          |96c94a9ea929e088b1e4984861bd7c9f999d2cf8|
|                   |                                                          |1a79e3b1814e38de89162a4b1d0ef994d8606000|
|                   |                                                          |fecd356b9bc6005e21651057b387b3c7d0cb4320|

Verify with:

```bash
git log --author="Name" --oneline -- path/to/directory/
```

---

## What Is Working

- [X] `docker compose up` starts all services without errors
- [X] `docker compose ps` shows every service as `(healthy)`
- [X] `GET /health` on every service returns `200` with DB and Redis status
- [X] At least one synchronous service-to-service call works end-to-end
- [X] k6 baseline test runs successfully

---

## What Is Not Working / Cut

We managed to get everything working correctly for this sprint. We will aim to continue this progress for future sprints. However, some issues were addressd at the last second, and we will aim to improve this by spotting problems earlier.


---

## k6 Baseline Results

Script: `k6/sprint-1.js`  
Run: `docker compose exec holmes k6 run /workspace/k6/sprint-1.js`

```
    checks_total.......: 2556    36.246554/s
    checks_succeeded...: 100.00% 2556 out of 2556
    checks_failed......: 0.00%   0 out of 2556

    ✓ status is 200
    ✓ response time < 500ms

    CUSTOM
    errors.........................: 0.00%  0 out of 1278

    HTTP
    http_req_duration..............: avg=291.61ms min=263.45ms med=288.34ms max=372.9ms p(90)=318.64ms p(95)=331.4ms 
      { expected_response:true }...: avg=291.61ms min=263.45ms med=288.34ms max=372.9ms p(90)=318.64ms p(95)=331.4ms 
    http_req_failed................: 0.00%  0 out of 1278
    http_reqs......................: 1278   18.123277/s

    EXECUTION
    iteration_duration.............: avg=793.13ms min=764.48ms med=789.61ms max=874.5ms p(90)=820.19ms p(95)=833.08ms
    iterations.....................: 1278   18.123277/s
    vus............................: 1      min=1         max=20
    vus_max........................: 20     min=20        max=20

    NETWORK
    data_received..................: 606 kB 8.6 kB/s
    data_sent......................: 491 kB 7.0 kB/s
```

| Metric             | Value |
| ------------------ | ----- |
| p50 response time  (average) |   291.61ms    |
| p95 response time  | 331.4ms  |
| p99 response time  | ----- |
| Requests/sec (avg) |   18.123277/s    |
| Error rate         | %0.00 |

These numbers are your baseline. Sprint 2 caching should improve them measurably.

---

## Blockers and Lessons Learned
Even though Docker is supposed to prevent them, there were still a few errors that were different between our devices, such as node modules not being the same between devices, volumes containing different data that causes errors, etc. Whenever these strange changes occur, we probably need to ask for help if rebuilding with new volumes via `docker compose down -v` does not yield better results.

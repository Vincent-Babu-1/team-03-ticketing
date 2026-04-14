# Sprint 1 Report — [Team 3]

**Sprint:** 1 — Foundation  
**Tag:** `sprint-1`  
**Submitted:** [date, before 04.14 class]

---

## What We Built

[One or two paragraphs. What is running? What does `docker compose up` produce? What endpoints are live?]

---

## Individual Contributions

| Team Member | What They Delivered                                     | Key Commits            |
| ----------- | ------------------------------------------------------- | ---------------------- |
| [Name]      | [e.g. order-service with DB schema, health endpoint]    | [short SHA or PR link] |
| [Name]      | [e.g. restaurant-service, synchronous call integration] |                        |
| [Name]      | [e.g. compose.yml wiring, k6 baseline script]           |                        |

Verify with:

```bash
git log --author="Name" --oneline -- path/to/directory/
```

---

## What Is Working

- [ ] `docker compose up` starts all services without errors
- [ ] `docker compose ps` shows every service as `(healthy)`
- [ ] `GET /health` on every service returns `200` with DB and Redis status
- [ ] At least one synchronous service-to-service call works end-to-end
- [ ] k6 baseline test runs successfully

---

## What Is Not Working / Cut

[Be honest. What did you not finish? What did you cut from the sprint plan and why? How will you address it in Sprint 2?]
Our event catalog serrvice has an error that prevents it from starting. We were barely not able to address this in time for submission. However, we did not intentionally cut any features from our sprint plan for this week. The event catalog is the first issue we will address for Sprint 2


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
| p50 response time  |       |
| p95 response time  | 331.4ms  |
| p99 response time  |       |
| Requests/sec (avg) |   18.123277/s    |
| Error rate         | %0.00 |

These numbers are your baseline. Sprint 2 caching should improve them measurably.

---

## Blockers and Lessons Learned

[What slowed you down? What would you do differently? What surprised you?]

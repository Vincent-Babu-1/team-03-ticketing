# Sprint 3 Report — Team 3

**Sprint:** 3 — Reliability and Poison Pills  
**Tag:** `sprint-3`  
**Submitted:** 04.27

---

## What We Built

[What failure scenarios does the system now handle? Which queues have DLQ handling? What happens when a poison pill is injected?]

---

## Individual Contributions

| Team Member | What They Delivered | Key Commits |
| ----------- | ------------------- | ----------- |
| Vincent Babu | k6 poison test, Sprint 3 Report, refund service |  |
| Tien Nguyen  |  |  |
| Benson Zheng |          |  |
| Helektra Katsoulakis  |    | |
| Julia Farber          |        |  |
|                       |                                                    |  |
| Katelyn Leung         |   |   |
| Maria Mechery         |         |  |
|                       |                                     |  |
| Franco Htet           |   |  |
| Rihui Lu           |   |  |

---

## What Is Working

- [X] Poison pill handling: malformed messages go to DLQ, worker keeps running
- [X] Worker `GET /health` shows non-zero `dlq_depth` after poison pills are injected
- [X] Worker status remains `healthy` while DLQ fills
- [X] System handles failure scenarios gracefully (no dangling state, no crash loops)
- [ ] All services/workers required for team size are implemented

---

## What Is Not Working / Cut

---

## Poison Pill Demonstration

How to inject a poison pill:

```bash
# From inside holmes:
docker compose exec holmes bash

# Example — publish a malformed message directly to the queue:
redis-cli -h redis RPUSH your-queue '{"this": "is malformed"}'
```

Worker health before injection:

```json
{
  "status": "healthy",
  "queue_depth": 0,
  "dlq_depth": 0,
  "last_job_at": "2025-04-24T..."
}
```

Worker health after injection:

```json
{
  "status": "healthy",
  "queue_depth": 0,
  "dlq_depth": 3,
  "last_job_at": "2025-04-24T..."
}
```

---

## k6 Results: Poison Pill Resilience (`k6/sprint-3-poison.js`)

```
[Paste k6 summary output here]
```

| Metric | Normal-only run | Mixed with poison pills | Change |
| ------ | --------------- | ----------------------- | ------ |
| p95    | 315.46ms        | 280.26ms                | -35.20ms    |
| RPS    | 11.208466/s     | 12.589035/s             | +1.380569/s |
| Error rate | 0.00%       | 12.31%                  | +12.31%     |

Throughput remained relatively stable throughout the poison pill test. While the requests per second suffered slightly, the 95th percentile statistic improved slightly. This suggests that the performance is about the same when running the test with only normal requests and when running with poison pills. When running the command `curl http://purchase-service:3001/health | jq .`, the purchase service stayed healthy throughout the test.

---

## Blockers and Lessons Learned

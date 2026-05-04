# Sprint 4 Report — Team 3

**Sprint:** 4 — Replication, Scaling, and Polish  
**Tag:** `sprint-4`  
**Submitted:** 05.05

---

## What We Built

[Which services are replicated? How does load balancing work? What polish work was completed?]

The three workers that consume from queues (the analytics worker, the fraud worker, and the waitlist worker) are the services that are replicable. Load balancing is implemented via Caddy, which takes requests and routes them to workers first by weight, then by round robin sorting. 

---

## Individual Contributions

| Team Member | What They Delivered | Key Commits |
| ----------- | ------------------- | ----------- |
| Vincent Babu | k6 scale + replica test, Sprint 4 report           + README update if needed | 37bf21cb7e56552b655815af597aa2867dcfb795 |
| Tien Nguyen  | fraud worker replication accomodation              + README update if needed | de2b43f5ae8abfdc63e0393508e1aff6bd776678 |
|              |                                                                              | 6793e383a66d08d415e54c1e7c30afe9b6701571 |
| Benson Zheng |                                                      README update if needed | 23b5f91d80dd5b5e8fc9a7dbb1b25198c606f158 |
| Helektra Katsoulakis  | analytics worker replication accomodation + README update if needed |                                          |
| Julia Farber          | payment service + refund compatibility    + README update if needed | 8f8be41ccac57745c168187fc28476378c7b40b7 |
|                       |                                                                     | 2967909ff6b0321d007c38844fc55681681506c3 |
|                       |                                                                     | 5822df06bc8c85f207a3bc0fa82e2bf3788a0fe0 |
| Katelyn Leung         | Sprint 4 plan; ensure resilient workers   + README update if needed | 360f7bb4504229cdd39a72b008c57abd530326a0 |
| Maria Mechery         | waitlist worker replication accomodation  + README update if needed |                                          |
| Franco Htet           | UI finish + Caddyfile scaling             + README update if needed |                                          |
| Rihui Lu              |                                             README update if needed |                                          |

---

## Starting the System with Replicas

```bash
docker compose up --scale analytics-worker=3 --scale fraud-worker=3 --scale waitlist-worker=3 -d
```

After startup:

```

NAME                                       IMAGE                                    COMMAND                  SERVICE                CREATED          STATUS                             PORTS
analytics-db                               postgres:16                              "docker-entrypoint.s…"   analytics-db           34 seconds ago   Up 30 seconds (healthy)            0.0.0.0:5436->5432/tcp, [::]:5436->5432/tcp
event-cat-db                               postgres:16                              "docker-entrypoint.s…"   event-cat-db           34 seconds ago   Up 30 seconds (healthy)            0.0.0.0:5433->5432/tcp, [::]:5433->5432/tcp
fraud-db                                   postgres:16                              "docker-entrypoint.s…"   fraud-db               34 seconds ago   Up 30 seconds (healthy)            0.0.0.0:5434->5432/tcp, [::]:5434->5432/tcp
holmes                                     team-03-ticketing-holmes                 "sleep infinity"         holmes                 34 seconds ago   Up 30 seconds                      
payment-service                            team-03-ticketing-payment-service        "docker-entrypoint.s…"   payment-service        33 seconds ago   Up 23 seconds (healthy)            0.0.0.0:3003->3001/tcp, [::]:3003->3001/tcp
purchase-db                                postgres:16                              "docker-entrypoint.s…"   purchase-db            34 seconds ago   Up 30 seconds (healthy)            0.0.0.0:5437->5432/tcp, [::]:5437->5432/tcp
purchase-service                           team-03-ticketing-purchase-service       "docker-entrypoint.s…"   purchase-service       33 seconds ago   Up 23 seconds (healthy)            0.0.0.0:3002->3001/tcp, [::]:3002->3001/tcp
redis                                      redis:7                                  "docker-entrypoint.s…"   redis                  34 seconds ago   Up 30 seconds (healthy)            0.0.0.0:6379->6379/tcp, [::]:6379->6379/tcp
refund-db                                  postgres:16                              "docker-entrypoint.s…"   refund-db              33 seconds ago   Up 30 seconds (healthy)            0.0.0.0:5435->5432/tcp, [::]:5435->5432/tcp
refund-service                             team-03-ticketing-refund-service         "docker-entrypoint.s…"   refund-service         33 seconds ago   Up 23 seconds (healthy)            0.0.0.0:3005->3001/tcp, [::]:3005->3001/tcp
team-03-ticketing-analytics-worker-1       team-03-ticketing-analytics-worker       "docker-entrypoint.s…"   analytics-worker       33 seconds ago   Up 22 seconds (healthy)            
team-03-ticketing-analytics-worker-2       team-03-ticketing-analytics-worker       "docker-entrypoint.s…"   analytics-worker       33 seconds ago   Up 22 seconds (healthy)            
team-03-ticketing-analytics-worker-3       team-03-ticketing-analytics-worker       "docker-entrypoint.s…"   analytics-worker       33 seconds ago   Up 23 seconds (healthy)            
team-03-ticketing-caddy-1                  caddy:2-alpine                           "caddy run --config …"   caddy                  31 seconds ago   Up 22 seconds                      0.0.0.0:80->80/tcp, [::]:80->80/tcp
team-03-ticketing-event-cat-service-1      team-03-ticketing-event-cat-service      "docker-entrypoint.s…"   event-cat-service      33 seconds ago   Up 23 seconds (healthy)            0.0.0.0:3006->3001/tcp, [::]:3006->3001/tcp
team-03-ticketing-fraud-worker-1           team-03-ticketing-fraud-worker           "docker-entrypoint.s…"   fraud-worker           33 seconds ago   Up 23 seconds (health: starting)   
team-03-ticketing-fraud-worker-2           team-03-ticketing-fraud-worker           "docker-entrypoint.s…"   fraud-worker           33 seconds ago   Up 22 seconds (health: starting)   
team-03-ticketing-fraud-worker-3           team-03-ticketing-fraud-worker           "docker-entrypoint.s…"   fraud-worker           33 seconds ago   Up 23 seconds (health: starting)   
team-03-ticketing-notification-service-1   team-03-ticketing-notification-service   "docker-entrypoint.s…"   notification-service   33 seconds ago   Up 23 seconds (healthy)            0.0.0.0:3004->3001/tcp, [::]:3004->3001/tcp
team-03-ticketing-notification-worker-1    team-03-ticketing-notification-worker    "docker-entrypoint.s…"   notification-worker    33 seconds ago   Up 17 seconds (healthy)            
team-03-ticketing-waitlist-worker-1        team-03-ticketing-waitlist-worker        "docker-entrypoint.s…"   waitlist-worker        33 seconds ago   Up 22 seconds (healthy)            
team-03-ticketing-waitlist-worker-2        team-03-ticketing-waitlist-worker        "docker-entrypoint.s…"   waitlist-worker        33 seconds ago   Up 22 seconds (healthy)            
team-03-ticketing-waitlist-worker-3        team-03-ticketing-waitlist-worker        "docker-entrypoint.s…"   waitlist-worker        33 seconds ago   Up 23 seconds (healthy)      
```

---

## What Is Working

- [X] At least [N] services replicated via `--scale`
- [X] Load balancer distributes traffic across replicas (visible in logs)
- [ ] Services are stateless — multiple instances run without conflicts
- [X] `docker compose ps` shows all replicas as `(healthy)`
- [ ] System is fully complete for team size

---

## What Is Not Working / Cut

---

## k6 Results

### Test 1: Scaling Comparison (`k6/sprint-4-scale.js`)

| Metric | 1 replica | 3 replicas | Change |
| ------ | --------- | ---------- | ------ |
| p50    | 2.8ms     | 2.3ms      | -0.5ms |
| p95    | 4.33ms    | 2.87ms     | -1.46ms |
| p99    | --------- | -----------| |
| RPS    | 52.062339/s | 52.220958/s | +0.158619/s |

Every statistic improved slightly with the introduction of two more replicas. The 3-replica count was able to accept incoming requests slightly faster because when one worker is busy with a request, another can accpet a different request. With a base average of 2.8ms, however, the improvement in the above statistics is slight.

Importantly, though, the maximum observed request duration decreased from 58.26ms to 24.6ms from the single to triple replica tests. That's an improvement of 33.66ms, or 57%. This improvement is more significant, which demonstrates that the replicas are helpful in taking the edge off of the most extreme cases.

### Test 2: Replica Failure (`k6/sprint-4-replica.js`)

Timeline:

| Time | Event |
| ---- | ----- |
| 0s   | k6 started, 3 replicas running |
| [t]s | Killed replica: `docker stop [container-id]` |
| [t]s | Surviving replicas absorbed traffic |
| [t]s | Replica restarted: `docker compose up -d` |
| [t]s | Traffic redistributed, back to normal |

```
[Paste k6 output showing before / during / after the failure — annotate with timestamps]
```

During failure — `docker compose ps`:

```
[Paste output showing stopped/unhealthy replica alongside healthy survivors]
```

After restart — `docker compose ps`:

```
[Paste output showing all replicas back to (healthy)]
```

---

## Blockers and Lessons Learned

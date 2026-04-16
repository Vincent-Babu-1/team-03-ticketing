# Sprint 2 Plan — [Team Name]

**Sprint:** 2 — Async Pipelines and Caching  
**Dates:** 04.14 → 04.21  
**Written:** 04.14 in class

---

## Goal

By the end of Spring 2, the Redis cache will be in use by event catalog service. In addition, Notification service will work as an Async pipeline from end-to-end (message published → worker consumes → action taken. Also, the payment service has one write path is idempotent, Worker logs show pipeline activity in docker compose logs, Worker GET /health returns queue depth, DLQ depth, and last-job-at. 

---

## Ownership

| Team Member           | Files / Directories Owned This Sprint                  |
| --------------------- | -----------------------------------------------------  |
| Benson Zheng          | `[/C-event-catalog/service, DB-events-catalog.sql]`              |
| Helektra Katsoulakis  | `C-analytics/worker.js`, `DB-folder/DB-analytics.sql`            |
| Julia Farber          | `DB-folder/DB-purchase.sql`, `C-payment/service.js`              |
| Katelyn Leung         | `DB-folder/DB-events.sql`, `C-ticket-purchase/notif-service.js`  |
| Maria Mechery         | `[/C-ticket-purchase,/C-ticket-purchase, ]`                        |
| Tien Nguyen           | `C-fraud/worker.js`, `DB-folder/DB-fraud.sql`                    |
| Vincent Babu          | `[k6/sprint-2-cache.js, k6/sprint-2-async.js, sprint-reports/SPRINT-2.md]`    |
| Franco Htet           |                                                                  |
| Ri Lu                 | `C-ticket-purchase/notif-worker.js, Redis`                       |
---

## Tasks

### [Julia]

- [ ] Determine if caching is needed for purchase-service and payment-service. If so, implement. IF YES:
    - At least one service reads from Redis before querying the database
    - Cache misses populate Redis with a TTL
    - The cached service's GET /health includes a Redis check
- [ ]Responsible for implementing idempotency for payment service and composing a curl command to demonstrate (key = purchase_id in DB)
- [ ]Responsible for implementing Idempotency for purchase service and composing a curl command to demonstrate (key = idempotency_key in DB)


### [Katelyn]

- [ ] Responsible for working on the full pipeline works end-to-end and can be demonstrated live 
- [ ] Notification Service worker exposes GET /health
- [ ] docker compose ps shows Notification service worker as (healthy)

### [Ri]

- [ ] At least one worker consumes those messages and does something useful (logs output, writes to a database, calls another service) – Ri
- [ ] Workers log structured output visible in docker compose logs – Ri
- [ ] The full pipeline works end-to-end and can be demonstrated live →Katelyn + Ri 

### [Helektra]

- [ ] Implement GET /health with Redis check and DB check for analytics worker
- [ ] Implement GET /analytics — stub returning placeholder data
- [ ] Track last successfully processed job timestamp in memory 
- [ ] Push events with missing fields to a dead queue instead of dropping them 

### [Maria]

- [ ] Every worker exposes GET /health
    - The response includes Redis status, queue depth, DLQ depth (even if 0), and last job timestamp
- [ ] docker compose ps shows every worker as (healthy)


### [Tien]

- [ ] docker compose ps shows every worker as (healthy)
- [ ] Implement worker to consume purchase events from Redis queue
- [ ] Track queue depth, DLQ depth, and job timestamps
- [ ] Implement GET /health with Redis check and DB check for fraud worker


### [Benson]

- [ ] Read event data from Redis first, and if the requested events are not already cached, fetch them from the primary database and store them in Redis for future requests.

### [Franco]
- [ ] Work on UI, touching core services, and database visualization.

---

## Risks

---

## Definition of Done

A TA can trigger an action, watch the queue flow in Docker Compose logs, hit the worker's `/health` to see queue depth and last-job-at, and review k6 results showing the caching improvement.

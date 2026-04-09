# Sprint 1 Plan — [Team 3]

**Sprint:** 1 — Foundation  
**Dates:** 04.07 → 04.14  
**Written:** 04.07 in class

---

## Goal

Event Catalog Service, Ticket Purchase Service, Payment Service, all start via compose.yml along with their associated Postgres databases. The Redis service starts, and a synchronous HTTP call from Ticket Purchase Service to Payment Service can be performed.

---

## Ownership

| Team Member           | Files / Directories Owned This Sprint                  |
| --------------------- | -----------------------------------------------------  |
| Benson Zheng          | `C-event-catalog/service.js`                                     |
| Helektra Katsoulakis  | `C-analytics/worker.js`, `DB-folder/DB-analytics.sql`            |
| Julia Farber          | `DB-folder/DB-purchase.sql`, `C-payment/service.js`              |
| Katelyn Leung         | `DB-folder/DB-events.sql`, `C-ticket-purchase/notif-service.js`  |
| Maria Mechery         | `C-payment/waitlist.js`, `C-ticket-purchase/service.js`          |
| Tien Nguyen           | `C-fraud/worker.js`, `DB-folder/DB-fraud.sql`                    |
| Vincent Babu          | `k6/sprint-1.js`, `Caddyfile`, `README.md`,                      |
|                       | `DB-folder/DB-refund.sql`, `C-refund/service.js`                 |
| Ri Lu                 | `C-ticket-purchase/notif-worker.js`                              |

Each person must have meaningful commits in the paths they claim. Ownership is verified by:

```bash
git log --author="Name" --oneline -- path/to/directory/
```

---

## Tasks

### Benson Zheng

- [ ] Set up `C-event-catalog/` with Express and Postgres connection
- [ ] Implement `GET /health` with DB check for event service
- [ ] Add `healthcheck` directive to `compose.yml` for event service

### Helektra Katsoulakis

- [ ] Write `DB-analytics.sql` and seed script
- [ ] Set up `C-analytics/` with Express and Postgres connection
- [ ] Implement `GET /health` with Redis check and DB check for analytics worker
- [ ] Implement `GET /analytics` — stub returning placeholder data

### Julia Farber

- [ ] Set up `C-payment/` with Express
- [ ] Write `DB-purchase.sql` and seed script
- [ ] Implement `GET /health` with Redis check for payment service
- [ ] Implement reception of `POST /process-purchase-payment` return from ticketing request service
- [ ] Add healthcheck directive to compose.yml for payment service

### Katelyn Leung

- [ ] Write `DB-events.sql` and seed script
- [ ] Set up `C-ticket-purchase/notif-service.js` dependent on notif. worker health
- [ ] Implement `GET /health` with Redis check for notif. service

### Maria Mechery

- [ ] Set up `C-ticket-purchase/` with Express and Postgres connection
- [ ] Set up `C-payment/waitlist.js` worker
- [ ] Implement `GET /health` with Redis check for user-waitlist worker
- [ ] Add healthcheck directive to compose.yml for user-waitlist worker

### Tien Nguyen

- [ ] Implement `GET /health` with Redis check for primary ticket purchase service
- [ ] Implement `GET /[resource]` — stub returning placeholder data
- [ ] send `POST /process-purchase-payment` synchronous HTTP call to payment service


### Vincent Babu

- [ ] Wire `depends_on: condition: service_healthy` in `compose.yml`
- [ ] Write `k6/sprint-1.js` baseline load test
- [ ] Test synchronous call from Ticket Purchase to Payment 
- [X] Write `README.md` startup instructions and endpoint list
- [X] Write `SPRINT-1-PLAN.md` information and work breakdown
- [X] Write `Caddyfile` stub

### Ri Lu

- [ ] Set up `C-ticket-purchase/notif-worker.js` worker stub with Redis check
- [ ] Implement `GET /health` with Redis check for notif. worker
- [ ] Plan locations for various Redis publish/subscribe events

---

## Risks

If a task takes longer than expected, we must contact the group as soon as we know we need help. In a project like this, almost every service depends on every other service in some small way, so every group member is depended upon. We currently plan to check in on Sunday to see if anyone needs extra help.

---

## Definition of Done

A TA can clone this repo, check out `sprint-1`, run `docker compose up`, and:

- `docker compose ps` shows every service as `(healthy)`
- `GET /health` on each service returns `200` with DB and Redis status
- The synchronous service-to-service call works end-to-end
- k6 baseline results are included in `SPRINT-1.md`

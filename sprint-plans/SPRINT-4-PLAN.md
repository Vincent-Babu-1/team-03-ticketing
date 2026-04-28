# Sprint 4 Plan — [Team 3]

**Sprint:** 4 — Replication, Scaling, and Polish  
**Dates:** 04.28 → 05.07  
**Written:** 04.28 in class

---

## Goal

You will scale at least three services using docker compose up --scale, put Caddy in front of them as a load balancer, prove that traffic distributes across replicas, and show that your system survives a replica failure without dropping requests.

---

## Ownership

| Team Member           | Files / Directories Owned This Sprint                  |
| --------------------- | -----------------------------------------------------  |
| Benson Zheng          | `[/C-event-catalog/service, DB-events-catalog.sql]`              |
| Helektra Katsoulakis  | `C-analytics/worker.js`, `DB-folder/DB-analytics.sql`            |
| Julia Farber          | `DB-folder/DB-purchase.sql`, `C-payment/service.js`              |
| Katelyn Leung         | `DB-folder/DB-events.sql`, `C-ticket-purchase/notif-service.js`  |
| Maria Mechery         | `[/C-ticket-purchase,/C-ticket-purchase, ]`                      |
| Tien Nguyen           | `C-fraud/worker.js`, `DB-folder/DB-fraud.sql`                    |
| Vincent Babu          | `[k6/sprint-2-cache.js, k6/sprint-2-async.js, sprint-reports/SPRINT-2.md]`|
| Franco Htet           |`[Caddyfile, ui/dev/dev.js, ui/dev/index.html, ui/user/app.js, ui/user/index.html]`|
| Ri Lu                 | `C-ticket-purchase/notif-worker.js, Redis`                       |
---

## Tasks

### [Julia]

- [ ] Look into replication for the payment service IF needed.
- [ ] Update README.md with purchase-service and payment-service details. 

### [Katelyn]

- [ ] Test Replica Workers and make sure the workers are resilient 
- [ ]Check/Update the ReadMe 

### [Ri]

- [ ] Help Update ReadMe  

### [Helektra]

- [ ] Implement replica on analytics worker 
- [ ]Check README

### [Maria]

- [ ] Implement replication in waitlist worker
- [ ] Update readme.md

### [Tien]

- [ ] Update readme.md 
- [ ] Implement replication on fraud worker

### Vinnie 
- [ ]Check readme.md 
- [ ]Sprint 4 Report
- [ ]Make K6 scale test
- [ ]Make K6 replica mid-failure test

### Benson 
- [ ]Check readme.md 

###Franco 
- [ ]Update dev UI to fix changes that reflect replicating
- [ ]Set up Caddy and run with --scale 3

---

## Risks

---

## Definition of Done

`docker compose up --scale [service]=3` starts successfully. `docker compose ps` shows all replicas as `(healthy)`. k6 scaling comparison shows measurable improvement. Replica failure test shows no dropped requests.

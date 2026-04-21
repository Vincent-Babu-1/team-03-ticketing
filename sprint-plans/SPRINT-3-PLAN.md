# Sprint 3 Plan — [Team Name]

**Sprint:** 3 — Reliability and Poison Pills  
**Dates:** 04.21 → 04.28  
**Written:** 04.21 in class

---

## Goal

Every worker will have a dead letter queue by the end of the sprint. The worker will continue working even after the poison pills. All components from your chosen system description are implemented and running and they all need a health endpoint. The Payment service, Event Catalog Service, Notification Service will be the three failure scenarios. 
---

## Ownership

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

- [ ] Finish full implementation of payment-service endpoint calls (enabling refund etc)
- [ ] Implement failure prevention of seats hanging when refunding.
- [ ] Ensure no seat dangling if payment fails in purchase-service (test or help maria implement)
- [ ] Update readme.md


### [Katelyn]

- [ ] Add the failure scenario and log it 
- [ ] These are documented in your sprint report and can be demonstrated live
- [ ] Update the README.md for the notification service


### [Ri]

- [ ] Implement dead letter queue for notification worker
- [ ] Update ReadMe for notification worker
- [ ] Move worker functions to service 

### [Helektra]
- [ ] Update readme.md 
- [ ] Implement DLQ
- [ ] Implement GET /analytics querying real data from event_stats
- [ ] Verify docker compose ps 

### [Maria]
- [ ] Implement DLQ 
- [ ] Update ReadMe
- [ ] Implement seat reservations in ticket-purchase-service

### [Tien]
- [ ] Update readme.md 
- [ ] Implement DLP
- [ ] Debug so that health endpoint is working

### [Vinnie]
- [ ] K6 poison pill test
- [ ] Refund service request fully implemented
- [ ] Check purchase to make sure it exists
- [ ] Actually write to database
- [ ] Call to payment’s /reverse endpoint
- [ ] Update readme.md 
- [ ] Sprint 3 Report

### [Benson]
- [ ] Update readme.md 
- [ ] FInish up event-catalog services
- [ ]W ork on a failure case for event-catalog

### [Franco]
-[ ] Update readme.md 
-[ ] Continue UI work and testing of the UI, update user ticket-booking UI to reflect event-catalog DB changes
-[ ] Add a dev UI dashboard for testing endpoints/core services

---

## Risks

---

## Definition of Done

After injecting poison pills, the worker's `/health` shows non-zero `dlq_depth` while status remains `healthy`. Good messages keep flowing. k6 results show throughput does not collapse.

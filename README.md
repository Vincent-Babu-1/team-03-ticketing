# Team 3 — Event Ticketing Platform

**Course:** COMPSCI 426

**Team:** Benson Zheng, Helektra Katsoulakis, Julia Farber, Katelyn Leung, Maria Mechery, Tien Nguyen, Vincent Babu, Ri Lu, Franco Htet

**System:** Event Ticketing Platform

**Repository:** https://github.com/Vincent-Babu-1/team-03-ticketing

---

## Team and Service Ownership

| Team Member          | Files / Directories Owned This Sprint                         |
| -------------------- | ------------------------------------------------------------- |
| Benson Zheng         | event catalog service                                         |
| Helektra Katsoulakis | analytics worker + analytics db                               |
| Julia Farber         | purchase db + payment service + purchase service partially    |
| Katelyn Leung        | events db + notif. service                                    |
| Maria Mechery        | ticket purchase service + user waitlist worker                |
| Tien Nguyen          | fraud detection service + worker                              |
| Vincent Babu         | k6 testing + Caddy; initial skeleton; README.md + Sprint Plan |
| Ri Lu                | notif. worker + Redis pub/sub definitions                     |
| Franco Htet          | User/dev UI pages(ui/)                                        |

> Ownership is verified by `git log --author`. Each person must have meaningful commits in the directories they claim.

---

## How to Start the System

```bash
# Start everything (builds images on first run)
docker compose up --build

# Start with service replicas (Sprint 4)
docker compose up --scale your-service=3

# Verify all services are healthy
docker compose ps

# Stream logs
docker compose logs -f

# Open a shell in the holmes investigation container
docker compose exec holmes bash
```

### Frontend URLs

```text
Customer demo UI        http://localhost
Developer dashboard     http://localhost/dev/
```

The customer-facing UI lives in `ui/user/`.
The developer dashboard lives in `ui/dev/`.
Both are served through Caddy on port 80.

### Base URLs (development)

```
refund-service         http://refund-service:3001, health endpoint: http://refund-service:3001/health
purchase-service       http://purchase-service:3002, health endpoint: http://purchase-service:3001/health
payment-service        http://payment-service:3003, health endpoint: http://payment-service:3001/health
[your-service-name]    http://localhost:[port]
[worker-name]          http://localhost:[port]   (health endpoint only)
holmes                 (no port — access via exec)
```

> From inside holmes, services are reachable by name:
> `curl http://your-service:3000/health`
>
> See [holmes/README.md](holmes/README.md) for a full tool reference.

---

## System Overview

[One paragraph describing what your system does and how the services interact.
Include which service calls which, what queues exist, and how data flows.]

[Each of us can add to this paragraph with our section of the system.]

Purchases are sent to purchase-request which then reserves a seat, then calls payment service to process payment, and then will confirm the purchase if successful. If the purchase fails, the seat is released back and notifies the waitlist worker. Upon success, the notification system is notified, analytics is notified, fraud is notified so it can gather data to notice patterns. Payment service is called by purchase service. Payment service is also called by refund service to refund a purchase, which validates if it exists and if it is refundable, and updates the seat reservation database and calls waitlist worker that there is avaliable seating, so the waitlist worker can allow waitlisted to make purchases on now availiable tickets.

Refund requests are sent to the Refund service, which checks the Refund database and synchronously calls the Purchase service to determine whether the request is valid. If the request is valid, then the request is noted in the Refund database as successful and the Payment service is contacted to reverse the charge.

## Frontend Overview

The repository now includes two static frontend surfaces under `ui/`:

1. `ui/user/`
The customer-facing ticket purchase demo. It loads events from the event catalog service, lets a user choose a section and quantity, and submits purchases through the purchase service.

2. `ui/dev/`
The developer dashboard. It provides a lightweight system overview for service and worker health, queue backlog visibility when a service reports it, and a quick visual reference for how the ticketing flow moves through the system.

Caddy serves both frontends. It rewrites `/` to the customer UI and serves the developer dashboard at `/dev/`. It also proxies same-origin health endpoints for the developer dashboard under `/api/system/...`.


---

## API Reference

<!--
  Document every endpoint for every service.
  Follow the format described in the project documentation: compact code block notation, then an example curl and an example response. Add a level-2 heading per service, level-3 per endpoint.
-->

---

### Event Ticketing Platform

---

## Purchase Service

### GET /health 
Returns 200 if healthy, 503 if unhealthy/down.
```bash curl http://purchase-service:3001/health```
{"service":"purchase","status":"ok","db":"ok","redis":"ok"}

### POST /purchases
Creates a new ticket purchase. Reserves a seat, calls payment service, confirms if successful payment or 
releases the seat if unsuccessful payment. Idempotent on Idempotency-Key header.
curl -X POST http://purchase-service:3001/purchases \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: aaaaaaaa-0000-0000-0000-000000000001" \
  -d '{"userId": "bbbbbbbb-0000-0000-0000-000000000001", "eventId": "cccccccc-0000-0000-0000-000000000001", "cardToken": "test-card", "seats": ["A1", "A2"]}' | jq .
{
  "purchaseId": "d0f2426b-20c7-4fbf-90cb-743d0ae00a5e",
  "userId": "bbbbbbbb-0000-0000-0000-000000000001",
  "eventId": "cccccccc-0000-0000-0000-000000000001",
  "seats": [
    "A1",
    "A2"
  ],
  "quantity": 2,
  "totalUsd": 446,
  "status": "confirmed",
  "createdAt": "2026-04-26T22:39:18.092Z"
}

### GET /purchases/:id
Looks up and returns a single purchase by its id (purchase id)
curl http://purchase-service:3001/purchases/d0f2426b-20c7-4fbf-90cb-743d0ae00a5e
{"error":"Purchase not found"} if not found.
{"id":"d0f2426b-20c7-4fbf-90cb-743d0ae00a5e","idempotency_key":"aaaaaaaa-0000-0000-0000-000000000001","user_id":"bbbbbbbb-0000-0000-0000-000000000001","event_id":"cccccccc-0000-0000-0000-000000000001","seats":["A1","A2"],"quantity":2,"total_usd":"446.00","card_token":"test-card","status":"confirmed","created_at":"2026-04-26T22:39:18.087Z"} if found.

### GET /reservations/:id
Looks up and returns a single reservation by its id (reservation id, but id in the reservations table)
curl http://purchase-service:3001/reservations/aaaaaaaa-0000-0000-0000-000000000001
{"error":"Reservation not found"} or 
{
  "id": "uuid",
  "purchase_id": "uuid",
  "event_id": "uuid",
  "seats": ["A1", "A2"],
  "quantity": 2,
  "status": "confirmed",
  "created_at": "2026-04-26T21:46:00.139Z",
  "updated_at": "2026-04-26T21:46:00.139Z"
}

---

## Payment Service

### GET /health 
curl http://payment-service:3001/health
{"service":"payment-service","status":"ok","db":"ok","redis":"ok"}
Returns 200 if healthy, 503 if unhealthy/down.

### POST /payments
Called by purchase-service only to trigger a payment. Processes a simulated (I/O simulation) payment for a purchase. 
Idempotent on purchase_id, preventing duplicate charging.
curl -X POST http://payment-service:3001/payments \
  -H "Content-Type: application/json" \
  -d '{"purchase_id": "aaaaaaaa-0000-0000-0000-000000000001", "amount": 204.00, "cardToken": "test-card"}'
{"payment_id":"cc34f7bc-9033-44e7-b5d4-423e65b08732","purchase_id":"aaaaaaaa-0000-0000-0000-000000000001","status":"success","amount":"204.00"}

### GET /payments/:purchase_id
Look up and return a payment record by its purchase_id.
curl http://payment-service:3001/payments/aaaaaaaa-0000-0000-0000-000000000001
{"id":"cc34f7bc-9033-44e7-b5d4-423e65b08732","purchase_id":"aaaaaaaa-0000-0000-0000-000000000001",
"refund_id":null,"total_usd":"204.00","status":"succeeded","created_at":"2026-04-26T22:45:52.305Z",
"updated_at":"2026-04-26T22:45:52.305Z"}

### POST /payments/reverse
Reverses a payment (refunds). Called by refund service only to trigger payment-service to refund. Idempotent on purchase_id,
and ensures that there exists a successful payment so no fraud occurs.
curl -X POST http://payment-service:3001/payments/reverse \
  -H "Content-Type: application/json" \
  -d '{"purchase_id": "aaaaaaaa-0000-0000-0000-000000000001", "refund_id": "dddddddd-0000-0000-0000-000000000001"}'
{"payment_id":"cc34f7bc-9033-44e7-b5d4-423e65b08732","refund_id":"dddddddd-0000-0000-0000-000000000001",
"purchase_id":"aaaaaaaa-0000-0000-0000-000000000001","status":"refunded","total_usd":"204.00"}
---

## Refund Service

### GET /health
```
GET /health
  Returns the health status of this service and its dependencies.
  Responses:
    200  Service and all dependencies healthy
    503  One or more dependencies unreachable
```

**Example request:**

```bash
curl http://refund-service:3001/health | jq .
```

**Example response (200):**

```json
{
  "status": "healthy",
  "db": "ok",
  "redis": "ok"
}
```

**Example response (503):**

```json
{
  "status": "unhealthy",
  "db": "ok",
  "redis": "error: connection refused"
}
```

### POST /refund-request

```
POST /refund-request
  Attempts to refund the given purchase.
  Parameters:
    refundRequestId [UUID]: used to check idempotency for refund requests.
    purchaseId [UUID]: the id of the purchase asking to be refunded.
  Responses:
    200  Refund successful, payment reversal request sent
    202  This purchase already refunded; no action taken
    400  Purchase does not exist, refund marked as failed in database
    404  Duplicate refund request, ignored
```

**Example request:**

```bash
curl -s -X POST http://refund-service:3001/refund-request \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: a0eebc99--4ef8-bb6d-6bb9bd387776" \
  -d '{"refundRequestId": "a0eebc99--4ef8-bb6d-6bb9bd387776", "purchaseId": "df33337e-9fac-4854-9ad8-3af18d822cfc"}' | jq .
```
**Example response (200):**
```json
{
  "refundRequestId": "a0eebc99--4ef8-bb6d-6bb9bd387776",
  "purchaseId": "df33337e-9fac-4854-9ad8-3af18d822cfc",
  "success": true
}
```
**Example response (202):**
```json
{
  "refundRequestId": "a0eebc99--4ef8-bb6d-6bb9bd387776",
  "purchaseId": "df33337e-9fac-4854-9ad8-3af18d822cfc",
  "success": false,
  "failureReason": "already_refunded"
}
```

**Example response (400):**
```json
{
  "refundRequestId": "a0eebc99--4ef8-bb6d-6bb9bd387776",
  "purchaseId": "df33337e-9fac-4854-9ad8-3af18d822cfc",
  "success": false,
  "failureReason": "purchase_missing"
}
```
**Example response (404):**
```json
{
  "refundRequestId": "a0eebc99--4ef8-bb6d-6bb9bd387776",
  "purchaseId": "df33337e-9fac-4854-9ad8-3af18d822cfc",
  "success": false,
  "failureReason": "idempotency_skip"
}
```


---

## Sprint History

| Sprint | Tag        | Plan                                              | Report                                    |
| ------ | ---------- | ------------------------------------------------- | ----------------------------------------- |
| 1      | `sprint-1` | [SPRINT-1-PLAN.md](sprint-plans/SPRINT-1-PLAN.md) | [SPRINT-1.md](sprint-reports/SPRINT-1.md) |
| 2      | `sprint-2` | [SPRINT-2-PLAN.md](sprint-plans/SPRINT-2-PLAN.md) | [SPRINT-2.md](sprint-reports/SPRINT-2.md) |
| 3      | `sprint-3` | [SPRINT-3-PLAN.md](sprint-plans/SPRINT-3-PLAN.md) | [SPRINT-3.md](sprint-reports/SPRINT-3.md) |
| 4      | `sprint-4` | [SPRINT-4-PLAN.md](sprint-plans/SPRINT-4-PLAN.md) | [SPRINT-4.md](sprint-reports/SPRINT-4.md) |

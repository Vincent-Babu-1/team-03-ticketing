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
purchase-service       http://purchase-service:3001, health endpoint: http://purchase-service:3001/health
payment-service        http://payment-service:3001, health endpoint: http://payment-service:3001/health
event-catalog-service  http://event-cat-service:3001, health endpoint: http://event-cat-service:3001/health
notification-service   http://notification-service:3001, health endpoint: http://notification-service:3001/health
notification-worker    http://notification-worker:3001, health endpoint: http://notification-worker:3001/health
waitlist-worker        http://waitlist-worker:3000, health endpoint: http://waitlist-worker:3000/health
fraud-worker           http://fraud-worker:3008, health endpoint: http://fraud-worker:3008/health
analytics-worker       http://analytics-worker:3001, health endpoint: http://analytics-worker:3001/health
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
### Notification Service 

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

### GET /dlq

```
GET /dlq
  Returns all messages currently sitting in the dead letter queue.
  Responses:
    200  DLQ contents returned (empty array if none)
```

**Example request:**

```bash
curl http://notif-service:3001/dlq | jq .
```

**Example response (200):**

```json
{
  "count": 1,
  "items": [
    {
      "data": {
        "userId": "user-123",
        "purchaseId": "df33337e-9fac-4854-9ad8-3af18d822cfc",
        "eventId": "evt-456"
      },
      "reason": "Email provider unreachable",
      "failedAt": "2024-11-01T12:34:56.000Z"
    }
  ]
}
```

---

### POST /dlq/requeue

```
POST /dlq/requeue
  Re-publishes all dead-lettered messages back onto the confirmed-purchases
  channel, clearing the DLQ. Each message will go through the full retry
  logic again.
  Responses:
    200  All dead letters requeued successfully
```

**Example request:**

```bash
curl -s -X POST http://notif-service:3001/dlq/requeue | jq .
```

**Example response (200):**

```json
{
  "requeued": 3
}
```

---

## Analytics Worker

The Analytics Worker takes purchase and browse events from the `analytics-queue` Redis queue and writes aggregate stats to the analytics DB. Invalid events are routed to the `analytics-queue:dlq` dead letter queue.

### GET /health
Returns 200 if DB and Redis are healthy, 503 if degraded. Also returns queue depth, DLQ depth, and last processed job timestamp.
```bash
curl http://analytics-worker:3001/health | jq .
```

**Example response (200):**
```json
{
  "service": "analytics-worker",
  "status": "ok",
  "queueDepth": 0,
  "dlqDepth": 0,
  "lastJobAt": "2026-04-27T12:00:00.000Z",
  "db": "ok",
  "redis": "ok"
}
```
### GET /analytics
Returns aggregate ticket sales and browse counts for all events from the analytics DB.
```bash
curl http://analytics-worker:3001/analytics | jq .
```

**Example response (200):**
```json
{
  "events": [
    {
      "event_id": "cccccccc-0000-0000-0000-000000000001",
      "tickets_sold": 1,
      "browse_count": 0,
      "updated_at": "2026-04-27T12:00:00.000Z"
    }
  ]
}
```
### Testing

Inject a valid purchase event directly into the queue:
```bash
redis-cli -h redis RPUSH analytics-queue '{"event":"ticket_purchased","purchaseId":"aaaaaaaa-0000-0000-0000-000000000001","eventId":"cccccccc-0000-0000-0000-000000000001","quantity":2}'
```

Then verify it was recorded:
```bash
curl http://analytics-worker:3001/analytics | jq .
```

Inject invalid data to test DLQ:
```bash
redis-cli -h redis RPUSH analytics-queue '{"event":"ticket_purchased","purchaseId":"missing-event-id"}'
```

Verify DLQ depth increased:
```bash
curl http://analytics-worker:3001/health | jq '{dlqDepth}'
```

---

### Event Catalog Service

The Event Catalog Service manages event listings, venues, dates, and seat maps. It owns the events database and caches popular event details in Redis.

### GET /health
Returns 200 if Postgres and Redis are healthy, 503 if one or more dependencies are unhealthy.
```bash
curl http://event-catalog-service:3006/health | jq .
```

**Example response (200):**
```json
{
  "status": "healthy",
  "service": "event-catalog",
  "timestamp": "2026-04-25T12:00:00.000Z",
  "uptime_seconds": 120,
  "checks": {
    "database": {
      "status": "healthy",
      "latency_ms": 2
    },
    "redis": {
      "status": "healthy",
      "latency_ms": 1
    }
  }
}
```

**Example response (503):**
```json
{
  "status": "unhealthy",
  "service": "event-catalog",
  "timestamp": "2026-04-25T12:00:00.000Z",
  "uptime_seconds": 120,
  "checks": {
    "database": {
      "status": "healthy",
      "latency_ms": 2
    },
    "redis": {
      "status": "unhealthy",
      "error": "Redis ping failed"
    }
  }
}
```

### GET /events
Returns all events ordered by `date_time`. Uses Redis cache key `events:all`.
```bash
curl http://event-catalog-service:3006/events | jq .
```

**Example response (200):**
```json
[
  {
    "id": "event-uuid",
    "name": "Concert Night",
    "venue": "TD Garden",
    "base_price": "100.00",
    "date_time": "2026-05-01T20:00:00.000Z",
    "description": "Live concert event",
    "category": "Music"
  }
]
```

**Example response (500):**
```json
{
  "error": "Internal server error"
}
```

### GET /events/:eventId
Returns one event by ID. Uses Redis cache key `events:{eventId}`.
```bash
curl http://event-catalog-service:3006/events/EVENT_ID | jq .
```

**Example response (200):**
```json
{
  "id": "event-uuid",
  "name": "Concert Night",
  "venue": "TD Garden",
  "base_price": "100.00",
  "date_time": "2026-05-01T20:00:00.000Z",
  "description": "Live concert event",
  "category": "Music"
}
```

**Example response (404):**
```json
{
  "error": "Event not found"
}
```

### POST /events
Creates a new event. Requires `name`, `venue`, `base_price`, and `date_time`; `description` and `category` are optional.
```bash
curl -X POST http://event-catalog-service:3006/events \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Concert Night",
    "venue": "TD Garden",
    "base_price": 100,
    "date_time": "2026-05-01T20:00:00Z",
    "description": "Live concert event",
    "category": "Music"
  }' | jq .
```

**Example response (201):**
```json
{
  "id": "event-uuid",
  "name": "Concert Night",
  "venue": "TD Garden",
  "base_price": "100.00",
  "date_time": "2026-05-01T20:00:00.000Z",
  "description": "Live concert event",
  "category": "Music"
}
```

**Example response (400):**
```json
{
  "error": "name, venue, base_price, and date_time are required"
}
```

### DELETE /events/:eventId
Deletes an event by ID. Deleting an event also deletes its sections and seats because of `ON DELETE CASCADE`.
```bash
curl -X DELETE http://event-catalog-service:3006/events/EVENT_ID | jq .
```

**Example response (200):**
```json
{
  "message": "Event deleted successfully",
  "deletedEvent": {
    "id": "event-uuid",
    "name": "Concert Night",
    "venue": "TD Garden",
    "base_price": "100.00",
    "date_time": "2026-05-01T20:00:00.000Z",
    "description": "Live concert event",
    "category": "Music"
  }
}
```

**Example response (404):**
```json
{
  "error": "Event not found"
}
```

### POST /events/:eventId/populate
Populates an existing event with sections and seats. Creates one section for each name in `sectionNames` and creates `capacity` seats for each section.
```bash
curl -X POST http://event-catalog-service:3006/events/EVENT_ID/populate \
  -H "Content-Type: application/json" \
  -d '{
    "basePrice": 100,
    "capacity": 10,
    "sectionNames": ["RowC", "RowB", "RowA"]
  }' | jq .
```

**Example response (201):**
```json
{
  "message": "Event populated successfully",
  "eventId": "event-uuid",
  "sections": [
    {
      "id": "section-uuid",
      "event_id": "event-uuid",
      "section_name": "RowC",
      "price": "100.00",
      "capacity": 10,
      "seats": [
        {
          "id": "seat-uuid",
          "section_id": "section-uuid",
          "row": "RowC",
          "seat_number": 1,
          "status": "available"
        }
      ]
    }
  ]
}
```

**Example response (400):**
```json
{
  "error": "basePrice and capacity are required"
}
```

**Example response (404):**
```json
{
  "error": "Event not found"
}
```

### GET /events/:eventId/sections
Returns all sections for an event, including `seats_available`, calculated from seats where `status = available`.
```bash
curl http://event-catalog-service:3006/events/EVENT_ID/sections | jq .
```

**Example response (200):**
```json
[
  {
    "id": "section-uuid",
    "event_id": "event-uuid",
    "section_name": "RowA",
    "price": "100.00",
    "capacity": 10,
    "seats_available": "10"
  }
]
```

**Example response (500):**
```json
{
  "error": "Internal server error"
}
```

### GET /events/:eventId/sections/:sectionId
Returns one section for an event, including `seats_available`, calculated from seats where `status = available`.
```bash
curl http://event-catalog-service:3006/events/EVENT_ID/sections/SECTION_ID | jq .
```

**Example response (200):**
```json
{
  "id": "section-uuid",
  "event_id": "event-uuid",
  "section_name": "RowA",
  "price": "100.00",
  "capacity": 10,
  "seats_available": "10"
}
```

**Example response (404):**
```json
{
  "error": "Section not found for this event"
}
```

### POST /events/:eventId/sections
Creates a new section for an event. Requires `section_name` and `price`; `capacity` is optional.
```bash
curl -X POST http://event-catalog-service:3006/events/EVENT_ID/sections \
  -H "Content-Type: application/json" \
  -d '{
    "section_name": "Balcony 101",
    "price": 75,
    "capacity": 120
  }' | jq .
```

**Example response (201):**
```json
{
  "id": "section-uuid",
  "event_id": "event-uuid",
  "section_name": "Balcony 101",
  "price": "75.00",
  "capacity": 120
}
```

**Example response (400):**
```json
{
  "error": "section_name and price are required"
}
```

**Example response (404):**
```json
{
  "error": "Event not found"
}
```

### PUT /events/:eventId/sections/:sectionId
Updates a section. Optional body fields are `section_name`, `price`, and `capacity`.
```bash
curl -X PUT http://event-catalog-service:3006/events/EVENT_ID/sections/SECTION_ID \
  -H "Content-Type: application/json" \
  -d '{
    "section_name": "Balcony 102",
    "price": 85,
    "capacity": 150
  }' | jq .
```

**Example response (200):**
```json
{
  "id": "section-uuid",
  "event_id": "event-uuid",
  "section_name": "Balcony 102",
  "price": "85.00",
  "capacity": 150
}
```

**Example response (404):**
```json
{
  "error": "Section not found for this event"
}
```

### DELETE /events/:eventId/sections/:sectionId
Deletes a section from an event. Deleting a section also deletes its seats because of `ON DELETE CASCADE`.
```bash
curl -X DELETE http://event-catalog-service:3006/events/EVENT_ID/sections/SECTION_ID | jq .
```

**Example response (200):**
```json
{
  "message": "Section deleted successfully",
  "deletedSection": {
    "id": "section-uuid",
    "event_id": "event-uuid",
    "section_name": "Balcony 102",
    "price": "85.00",
    "capacity": 150
  }
}
```

**Example response (404):**
```json
{
  "error": "Section not found for this event"
}
```

### GET /events/:eventId/seats
Returns all seats for an event. Seats are found by joining `seats.section_id` to `event_sections.id`.
```bash
curl http://event-catalog-service:3006/events/EVENT_ID/seats | jq .
```

**Example response (200):**
```json
[
  {
    "id": "seat-uuid",
    "section_id": "section-uuid",
    "row": "RowA",
    "seat_number": 1,
    "status": "available"
  }
]
```

**Example response (500):**
```json
{
  "error": "Internal server error"
}
```

### GET /events/:eventId/sections/:sectionId/seats
Returns all seats in a specific section and verifies that the section belongs to the event.
```bash
curl http://event-catalog-service:3006/events/EVENT_ID/sections/SECTION_ID/seats | jq .
```

**Example response (200):**
```json
[
  {
    "id": "seat-uuid",
    "section_id": "section-uuid",
    "row": "RowA",
    "seat_number": 1,
    "status": "available"
  },
  {
    "id": "seat-uuid",
    "section_id": "section-uuid",
    "row": "RowA",
    "seat_number": 2,
    "status": "reserved"
  }
]
```

**Example response (500):**
```json
{
  "error": "Internal server error"
}
```

### GET /events/:eventId/sections/:sectionId/seats/:seatId
Returns one seat and verifies that the seat belongs to the given section and event.
```bash
curl http://event-catalog-service:3006/events/EVENT_ID/sections/SECTION_ID/seats/SEAT_ID | jq .
```

**Example response (200):**
```json
{
  "id": "seat-uuid",
  "section_id": "section-uuid",
  "row": "RowA",
  "seat_number": 1,
  "status": "available"
}
```

**Example response (404):**
```json
{
  "error": "Seat not found"
}
```

### POST /events/:eventId/sections/:sectionId/seats
Creates one seat in a section. Requires `row` and `seat_number`; `status` is optional and defaults to `available`.
```bash
curl -X POST http://event-catalog-service:3006/events/EVENT_ID/sections/SECTION_ID/seats \
  -H "Content-Type: application/json" \
  -d '{
    "row": "A",
    "seat_number": 1,
    "status": "available"
  }' | jq .
```

**Example response (201):**
```json
{
  "id": "seat-uuid",
  "section_id": "section-uuid",
  "row": "A",
  "seat_number": 1,
  "status": "available"
}
```

**Example response (400):**
```json
{
  "error": "row and seat_number are required"
}
```

**Example response (404):**
```json
{
  "error": "Section not found for this event"
}
```

### PUT /events/:eventId/sections/:sectionId/seats/:seatId
Updates one seat. Optional body fields are `row`, `seat_number`, and `status`; status must be `available`, `reserved`, or `sold`.
```bash
curl -X PUT http://event-catalog-service:3006/events/EVENT_ID/sections/SECTION_ID/seats/SEAT_ID \
  -H "Content-Type: application/json" \
  -d '{
    "status": "reserved"
  }' | jq .
```

**Example response (200):**
```json
{
  "id": "seat-uuid",
  "section_id": "section-uuid",
  "row": "A",
  "seat_number": 1,
  "status": "reserved"
}
```

**Example response (400):**
```json
{
  "error": "status must be available, reserved, or sold"
}
```

**Example response (404):**
```json
{
  "error": "Seat not found"
}
```

### DELETE /events/:eventId/sections/:sectionId/seats/:seatId
Deletes one seat and verifies that the seat belongs to the given section and event.
```bash
curl -X DELETE http://event-catalog-service:3006/events/EVENT_ID/sections/SECTION_ID/seats/SEAT_ID | jq .
```

**Example response (200):**
```json
{
  "message": "Seat deleted successfully",
  "deletedSeat": {
    "id": "seat-uuid",
    "section_id": "section-uuid",
    "row": "A",
    "seat_number": 1,
    "status": "available"
  }
}
```

**Example response (404):**
```json
{
  "error": "Seat not found"
}
```

## Sprint History

| Sprint | Tag        | Plan                                              | Report                                    |
| ------ | ---------- | ------------------------------------------------- | ----------------------------------------- |
| 1      | `sprint-1` | [SPRINT-1-PLAN.md](sprint-plans/SPRINT-1-PLAN.md) | [SPRINT-1.md](sprint-reports/SPRINT-1.md) |
| 2      | `sprint-2` | [SPRINT-2-PLAN.md](sprint-plans/SPRINT-2-PLAN.md) | [SPRINT-2.md](sprint-reports/SPRINT-2.md) |
| 3      | `sprint-3` | [SPRINT-3-PLAN.md](sprint-plans/SPRINT-3-PLAN.md) | [SPRINT-3.md](sprint-reports/SPRINT-3.md) |
| 4      | `sprint-4` | [SPRINT-4-PLAN.md](sprint-plans/SPRINT-4-PLAN.md) | [SPRINT-4.md](sprint-reports/SPRINT-4.md) |

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
| Julia Farber         | purchase db + payment service                                 |
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

### Base URLs (development)

```
refund-service         http://refund-service:3001
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

Refund requests are sent to the Refund service, which checks the Refund database and synchronously calls the Purchase service to determine whether the request is valid. If the request is valid, then the request is noted in the database as successful and the Payment service is contacted to reverse the charge.


---

## API Reference

<!--
  Document every endpoint for every service.
  Follow the format described in the project documentation: compact code block notation, then an example curl and an example response. Add a level-2 heading per service, level-3 per endpoint.
-->

---

### Event Ticketing Platform

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

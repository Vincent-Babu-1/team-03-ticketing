# Event Catalog Service

The Event Catalog Service manages event listings, event sections, and seats. It owns the events database and caches event data in Redis.


# Database Setup

Before using the API endpoints, make sure the Postgres database has the required tables.

## Open the Postgres shell

Run:

```bash
docker exec -it event-cat-db psql -U user -d eventcatdb
````

This opens the `eventcatdb` database inside the `event-cat-db` container.

## Create the tables

Inside `psql`, run:

```sql
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  venue TEXT NOT NULL,
  base_price NUMERIC(10,2) NOT NULL,
  date_time TIMESTAMPTZ NOT NULL,
  description TEXT,
  category TEXT
);

CREATE TABLE IF NOT EXISTS event_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  section_name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  capacity INT
);

CREATE TABLE IF NOT EXISTS seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES event_sections(id) ON DELETE CASCADE,
  row TEXT NOT NULL,
  seat_number INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK(status IN ('available', 'reserved', 'sold')),
  CONSTRAINT unique_seat_in_section
    UNIQUE (section_id, row, seat_number)
);
```

## Table relationship

```text
events
  -> event_sections
      -> seats
```

An event can have many sections.
A section can have many seats.
A seat belongs to one section.

Deleting an event deletes its sections and seats because of `ON DELETE CASCADE`.

Deleting a section deletes its seats because of `ON DELETE CASCADE`.

## Seat status values

Each seat status must be one of:

```text
available
reserved
sold
```

If no status is provided when creating a seat, the default status is:

```text
available
```

---

## Base URL

```bash
http://event-catalog-service:3006
```

For local testing, you may use:

```bash
http://localhost:3006
```

---

## GET /

```
GET /
  Returns a simple message confirming that the service is reachable.
  Responses:
    200  Server reachable
```

**Example request:**

```bash
curl http://event-catalog-service:3006/
```

**Example response (200):**

```text
You've reached the event catalog server
```

---

## GET /health

```
GET /health
  Returns the health status of this service and its dependencies.
  Checks Postgres and Redis.
  Responses:
    200  Service and all dependencies healthy
    503  One or more dependencies unhealthy
```

**Example request:**

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

---

# Events

## GET /events

```
GET /events
  Returns all events ordered by date_time.
  Uses Redis cache key events:all.
  Responses:
    200  Events returned successfully
    500  Internal server error
```

**Example request:**

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

---

## GET /events/:eventId

```
GET /events/:eventId
  Returns one event by ID.
  Uses Redis cache key events:{eventId}.
  Responses:
    200  Event found
    404  Event not found
    500  Internal server error
```

**Example request:**

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

---

## POST /events

```
POST /events
  Creates a new event.
  Required body fields:
    name
    venue
    base_price
    date_time
  Optional body fields:
    description
    category
  Responses:
    201  Event created
    400  Missing required fields
    500  Internal server error
```

**Example request:**

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

---

## DELETE /events/:eventId

```
DELETE /events/:eventId
  Deletes an event by ID.
  Deleting an event also deletes its sections and seats because of ON DELETE CASCADE.
  Responses:
    200  Event deleted
    404  Event not found
    500  Internal server error
```

**Example request:**

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

---

# Populate Event

## POST /events/:eventId/populate

```
POST /events/:eventId/populate
  Populates an existing event with sections and seats.
  Creates one section for each name in sectionNames.
  Creates capacity number of seats for each section.
  Required body fields:
    basePrice
    capacity
    sectionNames
  Responses:
    201  Event populated successfully
    400  Missing required fields or invalid capacity
    404  Event not found
    500  Internal server error
```

**Example request:**

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

---

# Event Sections

## GET /events/:eventId/sections

```
GET /events/:eventId/sections
  Returns all sections for an event.
  Also returns seats_available, calculated from seats where status = available.
  Responses:
    200  Sections returned successfully
    500  Internal server error
```

**Example request:**

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

---

## GET /events/:eventId/sections/:sectionId

```
GET /events/:eventId/sections/:sectionId
  Returns one section for an event.
  Also returns seats_available, calculated from seats where status = available.
  Responses:
    200  Section found
    404  Section not found for this event
    500  Internal server error
```

**Example request:**

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

---

## POST /events/:eventId/sections

```
POST /events/:eventId/sections
  Creates a new section for an event.
  Required body fields:
    section_name
    price
  Optional body fields:
    capacity
  Responses:
    201  Section created
    400  Missing required fields
    404  Event not found
    500  Internal server error
```

**Example request:**

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

---

## PUT /events/:eventId/sections/:sectionId

```
PUT /events/:eventId/sections/:sectionId
  Updates a section.
  Optional body fields:
    section_name
    price
    capacity
  Responses:
    200  Section updated
    404  Section not found for this event
    500  Internal server error
```

**Example request:**

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

---

## DELETE /events/:eventId/sections/:sectionId

```
DELETE /events/:eventId/sections/:sectionId
  Deletes a section from an event.
  Deleting a section also deletes its seats because of ON DELETE CASCADE.
  Responses:
    200  Section deleted
    404  Section not found for this event
    500  Internal server error
```

**Example request:**

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

---

# Seats

## GET /events/:eventId/seats

```
GET /events/:eventId/seats
  Returns all seats for an event.
  Seats are found by joining seats.section_id to event_sections.id.
  Responses:
    200  Seats returned successfully
    500  Internal server error
```

**Example request:**

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

---

## GET /events/:eventId/sections/:sectionId/seats

```
GET /events/:eventId/sections/:sectionId/seats
  Returns all seats in a specific section.
  Also verifies that the section belongs to the event.
  Responses:
    200  Seats returned successfully
    500  Internal server error
```

**Example request:**

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

---

## GET /events/:eventId/sections/:sectionId/seats/:seatId

```
GET /events/:eventId/sections/:sectionId/seats/:seatId
  Returns one seat.
  Also verifies that the seat belongs to the given section and event.
  Responses:
    200  Seat found
    404  Seat not found
    500  Internal server error
```

**Example request:**

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

---

## POST /events/:eventId/sections/:sectionId/seats

```
POST /events/:eventId/sections/:sectionId/seats
  Creates one seat in a section.
  Required body fields:
    row
    seat_number
  Optional body fields:
    status
  Default status:
    available
  Allowed status values:
    available
    reserved
    sold
  Responses:
    201  Seat created
    400  Missing required fields or invalid status
    404  Section not found for this event
    500  Internal server error
```

**Example request:**

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

---

## PUT /events/:eventId/sections/:sectionId/seats/:seatId

```
PUT /events/:eventId/sections/:sectionId/seats/:seatId
  Updates one seat.
  Optional body fields:
    row
    seat_number
    status
  Allowed status values:
    available
    reserved
    sold
  Responses:
    200  Seat updated
    400  Invalid status
    404  Seat not found
    500  Internal server error
```

**Example request:**

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

---

## DELETE /events/:eventId/sections/:sectionId/seats/:seatId

```
DELETE /events/:eventId/sections/:sectionId/seats/:seatId
  Deletes one seat.
  Also verifies that the seat belongs to the given section and event.
  Responses:
    200  Seat deleted
    404  Seat not found
    500  Internal server error
```

**Example request:**

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

---

# Suggested Testing Flow

## 1. Create an event

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

Copy the returned event `id`.

## 2. Populate the event with sections and seats

```bash
curl -X POST http://event-catalog-service:3006/events/EVENT_ID/populate \
  -H "Content-Type: application/json" \
  -d '{
    "basePrice": 100,
    "capacity": 10,
    "sectionNames": ["RowC", "RowB", "RowA"]
  }' | jq .
```

## 3. Get event sections

```bash
curl http://event-catalog-service:3006/events/EVENT_ID/sections | jq .
```

Copy a section `id`.

## 4. Get seats in a section

```bash
curl http://event-catalog-service:3006/events/EVENT_ID/sections/SECTION_ID/seats | jq .
```

Copy a seat `id`.

## 5. Reserve a seat

```bash
curl -X PUT http://event-catalog-service:3006/events/EVENT_ID/sections/SECTION_ID/seats/SEAT_ID \
  -H "Content-Type: application/json" \
  -d '{
    "status": "reserved"
  }' | jq .
```

## 6. Check updated section availability

```bash
curl http://event-catalog-service:3006/events/EVENT_ID/sections | jq .
```

The `seats_available` count should decrease.

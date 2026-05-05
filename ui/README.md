## What This Is

This folder contains the static frontend assets for the Event Ticketing Platform project.

- `user/` contains the customer-facing ticket purchase demo
- `dev/` contains the developer system overview dashboard
- `styles.css` contains the shared stylesheet used by both pages

The customer UI is meant to demonstrate the main customer flow:

1. browse events
2. select an event
3. choose a section and quantity
4. submit a ticket purchase
5. see whether the purchase succeeded or failed

## How The UI Works

The UI is served by Caddy.

- Browser opens `http://localhost`
- Caddy rewrites `/` to `ui/user/index.html`
- Caddy serves the static files from this `ui/` folder
- The shared styling is loaded from `ui/styles.css`
- Frontend calls `/api/events` to load events
- Frontend calls `/api/events/:eventId/sections` and `/api/events/:eventId/sections/:sectionId/seats` to find available seats
- Frontend calls `/api/purchases` to submit purchases
- Caddy proxies those requests to the appropriate backend services

## Developer Dashboard

The developer dashboard is available at:

```text
http://localhost/dev/
```

It is intended for development-time visibility into:

1. service health
2. worker health
3. queue backlog and DLQ depth when exposed by a worker health endpoint
4. a quick reference view of the system flow

The dashboard reads same-origin health routes exposed by Caddy under `/api/system/...`.

## Current User Flow

1. Open `http://localhost`
2. View available events
3. Click `Book Tickets`
4. Enter:
   - name
   - section
   - quantity
   - card token
5. Click `Purchase Tickets`
6. Read the success or failure message

## How To Run

From the repository root:

```bash
docker compose up --build
```

Then open:

```text
http://localhost
```

## Verifying services work

```bash
docker compose logs -f caddy event-cat-service purchase-service payment-service
```

## Setting up databases for demo testing

docker compose down -v
docker compose up --build

docker exec -it event-cat-db psql -U user -d eventcatdb

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

curl -s -X POST http://localhost:3006/events \
 -H "Content-Type: application/json" \
 -d '{
"name": "Concert Night",
"venue": "TD Garden",
"base_price": 100,
"date_time": "2026-05-01T20:00:00Z",
"description": "Live concert event",
"category": "Music"
}'

Copy randomly generated ID from previous command into {EVENT_ID}
curl -s -X POST http://localhost:3006/events/EVENT_ID/populate
-H "Content-Type: application/json" \
 -d '{
"basePrice": 100,
"capacity": 10,
"sectionNames": ["RowC", "RowB", "RowA"]
}'

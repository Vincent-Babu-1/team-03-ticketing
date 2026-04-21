## What This Is

This folder contains a simple customer-facing website for the Event Ticketing Platform project. It is meant to demonstrate the main customer flow:

1. browse events
2. select an event
3. submit a ticket purchase
4. see whether the purchase succeeded or failed

## How The UI Works

The UI is served by Caddy.

- Browser opens `http://localhost`
- Caddy serves the static files from this `ui/` folder
- Frontend calls `/api/events` to load events
- Frontend calls `/api/purchases` to submit purchases
- Caddy proxies those requests to the appropriate backend services

## Current User Flow

1. Open `http://localhost`
2. View available events
3. Click `Book Tickets`
4. Enter:
   - name
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

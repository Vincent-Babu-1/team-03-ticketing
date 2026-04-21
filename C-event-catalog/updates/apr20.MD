### Database access

```bash
docker exec -it event-cat-db psql -U user -d eventcatdb
```

### POST `/events`

Creates a new event.

#### Expected JSON body

```json id="2m5k6u"
{
  "name": "Drake Concert",
  "venue": "Madison Square Garden",
  "base_price": 120.00,
  "date_time": "2026-05-10T20:00:00-04:00",
  "description": "Live concert",
  "category": "music"
}
```

#### Required fields

* `name` — string
* `venue` — string
* `base_price` — number
* `date_time` — ISO 8601 datetime string

#### Optional fields

* `description` — string
* `category` — string

#### Notes

* `date_time` should be in ISO 8601 format, for example:

  * `2026-05-10T20:00:00Z`
  * `2026-05-10T20:00:00-04:00`

#### Example

```bash id="f0z58m"
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Drake Concert",
    "venue": "Madison Square Garden",
    "base_price": 120.00,
    "date_time": "2026-05-10T20:00:00-04:00",
    "description": "Live concert",
    "category": "music"
  }'
```

### Implemented routes

* `DELETE /events/:eventId`
* `GET /events/:eventId`
* `GET /events`

### Caching behavior

* `GET /events` caches the full event list in Redis under `events:all` with a TTL of `60` seconds.
* `GET /events/:eventId` caches the individual event in Redis under `events:${eventId}` with a TTL of `300` seconds.
* Deleting an event invalidates both:

  * `events:all`
  * `events:${eventId}`


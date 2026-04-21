PUB-SUB TEST WITH A PURCHASE:

curl -s -X POST http://purchase-service:3001/purchases \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 77777777-7777-7777-7777-777777777777" \
  -d '{"userId":"22222222-2222-2222-2222-222222222222","eventId":"33333333-3333-3333-3333-333333333333","quantity":2,"cardToken":"tok_test"}' | jq .

and do:
docker compose logs -f notification-worker
docker compose logs -f purchase-service
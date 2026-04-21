READ ME ABOUT THE IDEMPOTENCY OF PAYMENT AND PURCHASE:
BELOW ARE THE CURL COMMANDS TO RUN TO PROVE IDEMPOTENCY OF PURCHASES AND IDEMPOTENCY OF PAYMENTS.
Payment has an idempotency key of purchase_id, as if a payment already exists and did not fail, then it must be paid for.
Purchases has idempotency based on the idempotency key that each purchase comes with, that is checked before creating a purchase.

Run both of these commands twice in: docker compose exec holmes bash

Purchase-service:
curl -s -X POST http://purchase-service:3001/purchases \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 11111111-1111-1111-1111-111111111111" \
  -d '{"userId":"22222222-2222-2222-2222-222222222222","eventId":"33333333-3333-3333-3333-333333333333","quantity":2,"cardToken":"tok_test"}' | jq .

Payment-service:
curl -s -X POST http://payment-service:3001/payments \
  -H "Content-Type: application/json" \
  -d '{"purchase_id":"44444444-4444-4444-4444-444444444444","amount":204,"cardToken":"tok_test"}' | jq .

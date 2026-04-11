CREATE TABLE IF NOT EXISTS events (
  refundRequestId TEXT NOT NULL,
  purchaseId TEXT NOT NULL, 
  success BOOLEAN NOT NULL,
);
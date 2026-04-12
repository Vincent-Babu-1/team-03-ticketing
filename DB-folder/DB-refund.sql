CREATE TABLE IF NOT EXISTS refunds (
  refundRequestId TEXT NOT NULL,
  purchaseId TEXT NOT NULL, 
  success BOOLEAN NOT NULL,
);
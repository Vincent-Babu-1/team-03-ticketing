CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  venue TEXT NOT NULL,
  base_price NUMERIC(10,2) NOT NULL,
  date_time TIMESTAMPTZ NOT NULL,
  description TEXT,
  category TEXT
);
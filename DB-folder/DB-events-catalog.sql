CREATE TABLE IF NOT EXISTS events (
  id  UUID  PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  dateTime TIMESTAMPTZ,
  description TEXT.
  category TEXT,
);

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
  capacity INT,
  seats_available INT
);
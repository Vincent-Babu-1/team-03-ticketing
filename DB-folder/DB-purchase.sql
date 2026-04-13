-- SPEC STATES: TICKET PURCHASE EXCLUSIVELY OWNS PURCHASE DB

-- QUESTIONS/NOTES:
-- Can change types later: maybe not integers/text for things like ID?
-- Do we add or remove things that reference other databases?
-- Do we add event_id to reservations to avoid having to run joins for that info?
-- wait and see and update if needed ^ 
-- can also change type of amount from integer to decimal, etc:
-- https://www.w3schools.com/sql/sql_datatypes.asp

CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservations (
    id SERIAL PRIMARY KEY,
    purchase_id INTEGER NOT NULL,
    seat_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('released', 'pending', 'confirmed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_purchase_res
    FOREIGN KEY (purchase_id)
    REFERENCES purchases(id)
);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    purchase_id INTEGER NOT NULL,
    refund_id INTEGER,
    amount INTEGER NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL CHECK (status IN ('failed', 'refunded', 'succeeded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_purchase_pay
    FOREIGN KEY (purchase_id)
    REFERENCES purchases(id)
);
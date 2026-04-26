CREATE TABLE IF NOT EXISTS purchases (
    id              UUID PRIMARY KEY,
    idempotency_key UUID UNIQUE NOT NULL,
    user_id         UUID NOT NULL,
    event_id        UUID NOT NULL,
    seats           TEXT[] NOT NULL,
    quantity        INTEGER NOT NULL,
    total_usd       NUMERIC(10,2) NOT NULL,
    card_token      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )

CREATE TABLE IF NOT EXISTS reservations (
    id          UUID PRIMARY KEY,
    purchase_id UUID NOT NULL,
    event_id    UUID NOT NULL,
    seats       TEXT[] NOT NULL,
    quantity    INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'released')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY, 
    purchase_id UUID NOT NULL UNIQUE,
    refund_id UUID UNIQUE,
    total_usd NUMERIC(10,2) NOT NULL CHECK (total_usd > 0),
    status TEXT NOT NULL CHECK (status IN ('failed', 'refunded', 'succeeded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
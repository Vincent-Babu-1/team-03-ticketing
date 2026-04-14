-- tickets_sold increments on each confirmed purchase
-- browse_count increments on each browse event (approximate)
CREATE TABLE IF NOT EXISTS event_stats (
    event_id     UUID        PRIMARY KEY,
    tickets_sold INTEGER     NOT NULL DEFAULT 0,
    browse_count INTEGER     NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tracks which purchase_ids have already been counted
CREATE TABLE IF NOT EXISTS processed_purchases (
    purchase_id  UUID        PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

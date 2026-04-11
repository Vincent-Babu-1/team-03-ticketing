CREATE TABLE IF NOT EXISTS tickets_sold (
    event_id    TEXT        NOT NULL, -- unique ID, maybe use UUID??
    count       INTEGER     NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- date and time
    PRIMARY KEY (event_id)
);

CREATE TABLE IF NOT EXISTS browse_stats (
    event_id    TEXT        NOT NULL,
    hour_bucket TIMESTAMPTZ NOT NULL,
    views       INTEGER     NOT NULL DEFAULT 0,
    PRIMARY KEY (event_id, hour_bucket)
);

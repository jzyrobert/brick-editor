-- Cohorts preserve prompt version and starting conditions separately from the
-- subject/model. Old indexes and unclassified rows remain usable.
CREATE TABLE generations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1))
);
CREATE UNIQUE INDEX generations_default ON generations(is_default) WHERE is_default = 1;
ALTER TABLE builds ADD COLUMN generation_id TEXT REFERENCES generations(id);
CREATE INDEX builds_generation ON builds(generation_id, hidden);

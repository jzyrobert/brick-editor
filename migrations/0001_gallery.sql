-- The agent-build gallery (docs/GALLERY-PLAN.md §4). D1 is the source of
-- truth for builds; index.json on the gallery bucket is generated from it.
CREATE TABLE prompts (
  id TEXT PRIMARY KEY,                 -- slug, e.g. "japanese-buddhist-temple-2000"
  brief TEXT NOT NULL,                 -- the --brief text
  target_parts INTEGER,
  arena INTEGER NOT NULL DEFAULT 1,    -- 0 = gallery only
  created_at INTEGER NOT NULL
);
CREATE TABLE agents (
  id TEXT PRIMARY KEY,                 -- "claude/claude-opus-5-5/high"
  runner TEXT NOT NULL,
  model TEXT NOT NULL,
  effort TEXT,
  display_name TEXT NOT NULL
);
CREATE TABLE builds (
  id TEXT PRIMARY KEY,                 -- first 12 hex of mpd_sha
  prompt_id TEXT NOT NULL REFERENCES prompts(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  title TEXT,                          -- the build script's own title
  mpd_sha TEXT NOT NULL,
  mpd_bytes INTEGER NOT NULL,
  script_sha TEXT,
  report_sha TEXT,
  renders TEXT NOT NULL,               -- JSON {"iso": sha, "front": sha, "iso-back": sha}
  parts INTEGER NOT NULL,
  attempts INTEGER,
  seconds INTEGER,
  cost_usd REAL,
  output_tokens INTEGER,
  source TEXT,                         -- the batch it came from, e.g. the one-shot run folder
  library_release TEXT NOT NULL,
  library_hash TEXT NOT NULL,
  warnings INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX builds_prompt ON builds(prompt_id, hidden);
CREATE UNIQUE INDEX builds_once ON builds(prompt_id, agent_id, mpd_sha);
CREATE TABLE votes (
  id INTEGER PRIMARY KEY,
  created_at INTEGER NOT NULL,
  prompt_id TEXT NOT NULL,
  build_lo TEXT NOT NULL,              -- pair stored in sorted order
  build_hi TEXT NOT NULL,
  choice TEXT NOT NULL CHECK (choice IN ('lo', 'hi', 'tie', 'both_bad')),
  session TEXT NOT NULL,               -- HMAC(VOTE_SALT, cookie id)
  net_day TEXT NOT NULL,               -- HMAC(VOTE_SALT, ip + UTC day): rotates daily, never stored raw
  excluded INTEGER NOT NULL DEFAULT 0  -- set by hand to drop abuse from ranking
);
CREATE UNIQUE INDEX votes_once ON votes(session, build_lo, build_hi);
CREATE INDEX votes_net ON votes(net_day, created_at);

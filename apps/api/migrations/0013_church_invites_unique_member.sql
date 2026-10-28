-- Hostile-mode invite codes + unique church membership.
CREATE TABLE IF NOT EXISTS church_invites (
  id TEXT PRIMARY KEY NOT NULL,
  church_id TEXT NOT NULL REFERENCES churches(id),
  code_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER,
  max_uses INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS church_invites_church_idx ON church_invites(church_id);

-- Deduplicate before unique index (keep earliest rowid).
DELETE FROM church_members
WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM church_members GROUP BY church_id, user_id
);

CREATE UNIQUE INDEX IF NOT EXISTS church_members_church_user_uidx
  ON church_members(church_id, user_id);

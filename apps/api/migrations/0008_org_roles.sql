-- Multi-role church membership + group membership + org tree fields.

ALTER TABLE church_members ADD COLUMN roles_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE church_groups ADD COLUMN parent_id TEXT;
ALTER TABLE church_groups ADD COLUMN kind TEXT NOT NULL DEFAULT 'small_group';
ALTER TABLE church_groups ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

CREATE TABLE church_group_members (
  id TEXT PRIMARY KEY NOT NULL,
  group_id TEXT NOT NULL REFERENCES church_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member',
  created_at INTEGER NOT NULL
);

CREATE INDEX church_group_members_group_idx ON church_group_members(group_id);
CREATE INDEX church_group_members_user_idx ON church_group_members(user_id);
CREATE UNIQUE INDEX church_group_members_group_user_uidx ON church_group_members(group_id, user_id);

-- Backfill primary role into roles_json for existing rows.
UPDATE church_members
SET roles_json = CASE
  WHEN role IS NULL OR role = '' THEN '["member"]'
  ELSE '["' || role || '"]'
END
WHERE roles_json = '[]' OR roles_json IS NULL OR roles_json = '';

-- Mirror legacy group_ids_json into church_group_members as plain members.
INSERT OR IGNORE INTO church_group_members (id, group_id, user_id, role, created_at)
SELECT
  'cgm_' || church_members.id || '_' || j.value,
  j.value,
  church_members.user_id,
  'member',
  church_members.created_at
FROM church_members,
  json_each(church_members.group_ids_json) AS j
WHERE typeof(j.value) = 'text' AND length(j.value) > 0;

-- 大道: richer post kinds, pin/readonly/soft-delete, interactions
ALTER TABLE forum_posts ADD COLUMN kind TEXT NOT NULL DEFAULT 'text';
ALTER TABLE forum_posts ADD COLUMN payload_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE forum_posts ADD COLUMN answer_hash TEXT;
ALTER TABLE forum_posts ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE forum_posts ADD COLUMN pinned_at INTEGER;
ALTER TABLE forum_posts ADD COLUMN readonly INTEGER NOT NULL DEFAULT 0;
ALTER TABLE forum_posts ADD COLUMN expires_at INTEGER;
ALTER TABLE forum_posts ADD COLUMN deleted_at INTEGER;

CREATE TABLE IF NOT EXISTS forum_post_responses (
  id TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL REFERENCES forum_posts(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS forum_post_responses_post_idx ON forum_post_responses(post_id);
CREATE INDEX IF NOT EXISTS forum_post_responses_user_idx ON forum_post_responses(post_id, user_id);

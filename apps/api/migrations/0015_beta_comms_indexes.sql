-- Beta-scale chat/comms: hot-path indexes + opaque rate-limit counters.
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS conversation_members_conversation_idx
  ON conversation_members(conversation_id);

CREATE INDEX IF NOT EXISTS conversation_members_user_conversation_idx
  ON conversation_members(user_id, conversation_id);

CREATE INDEX IF NOT EXISTS forum_posts_church_created_idx
  ON forum_posts(church_id, created_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

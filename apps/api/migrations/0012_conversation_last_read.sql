-- Per-member last-read cursor for chat unread / unread.
ALTER TABLE conversation_members ADD COLUMN last_read_at INTEGER;
CREATE INDEX IF NOT EXISTS conversation_members_user_last_read_idx
  ON conversation_members(user_id, last_read_at);

-- Friends, calendar events, and station inbox for 通讯 redesign

CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY NOT NULL,
  from_user_id TEXT NOT NULL REFERENCES users(id),
  to_user_id TEXT NOT NULL REFERENCES users(id),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  responded_at INTEGER
);

CREATE INDEX IF NOT EXISTS friend_requests_to_idx ON friend_requests(to_user_id, status);
CREATE INDEX IF NOT EXISTS friend_requests_from_idx ON friend_requests(from_user_id, status);

CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY NOT NULL,
  user_a_id TEXT NOT NULL REFERENCES users(id),
  user_b_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_uidx ON friendships(user_a_id, user_b_id);
CREATE INDEX IF NOT EXISTS friendships_a_idx ON friendships(user_a_id);
CREATE INDEX IF NOT EXISTS friendships_b_idx ON friendships(user_b_id);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  notes TEXT,
  start_at INTEGER NOT NULL,
  end_at INTEGER,
  all_day INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'local',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS calendar_events_owner_start_idx ON calendar_events(owner_user_id, start_at);

CREATE TABLE IF NOT EXISTS calendar_invites (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES calendar_events(id),
  invitee_user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  responded_at INTEGER
);

CREATE INDEX IF NOT EXISTS calendar_invites_invitee_idx ON calendar_invites(invitee_user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS calendar_invites_pair_uidx ON calendar_invites(event_id, invitee_user_id);

CREATE TABLE IF NOT EXISTS inbox_messages (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  related_user_id TEXT,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS inbox_messages_user_idx ON inbox_messages(user_id, created_at);
CREATE INDEX IF NOT EXISTS inbox_messages_unread_idx ON inbox_messages(user_id, read_at);

-- Opaque client-encrypted account vault (reader place + history pointers).
CREATE TABLE IF NOT EXISTS user_vault (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS user_vault_user_kind_uidx
  ON user_vault(user_id, kind);

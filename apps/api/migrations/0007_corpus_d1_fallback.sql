-- D1 corpus fallback for preview/temporary Workers without R2 MEDIA.
-- Production still uses R2 (CORPUS_LIVE_R2). This table enables live
-- download→local-DB against preview Workers when MEDIA is unbound.
CREATE TABLE IF NOT EXISTS corpus_chapters (
  translation_id TEXT NOT NULL,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  body_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (translation_id, book, chapter)
);
CREATE INDEX IF NOT EXISTS corpus_chapters_tid_idx ON corpus_chapters (translation_id);

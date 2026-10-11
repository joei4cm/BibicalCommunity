-- Calendar events can be ordinary events or seminars (研究会).
ALTER TABLE calendar_events ADD COLUMN kind text NOT NULL DEFAULT 'event';

CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `uid` text NOT NULL UNIQUE,
  `handle_hash` text NOT NULL UNIQUE,
  `email_hash` text,
  `password_hash` text NOT NULL,
  `nickname_ct` text,
  `legal_name_ct` text,
  `signature_ct` text,
  `locale` text NOT NULL DEFAULT 'zh-CN',
  `theme` text NOT NULL DEFAULT 'day',
  `privacy_json` text NOT NULL,
  `created_at` integer NOT NULL,
  `tombstoned` integer NOT NULL DEFAULT 0
);
CREATE INDEX `users_uid_idx` ON `users` (`uid`);

CREATE TABLE `devices` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `platform` text NOT NULL,
  `name` text,
  `identity_key_pub` text,
  `signed_prekey_pub` text,
  `signed_prekey_sig` text,
  `signed_prekey_id` integer,
  `registration_id` integer,
  `revoked` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL
);

CREATE TABLE `sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `device_id` text NOT NULL REFERENCES `devices`(`id`),
  `token_hash` text NOT NULL UNIQUE,
  `expires_at` integer NOT NULL,
  `created_at` integer NOT NULL
);

CREATE TABLE `churches` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `slug` text NOT NULL UNIQUE,
  `security_mode` text NOT NULL DEFAULT 'standard',
  `created_at` integer NOT NULL
);

CREATE TABLE `church_members` (
  `id` text PRIMARY KEY NOT NULL,
  `church_id` text NOT NULL REFERENCES `churches`(`id`),
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `role` text NOT NULL DEFAULT 'member',
  `verified` integer NOT NULL DEFAULT 0,
  `group_ids_json` text NOT NULL DEFAULT '[]',
  `created_at` integer NOT NULL
);

CREATE TABLE `annotations` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `translation_id` text NOT NULL,
  `book` text NOT NULL,
  `chapter` integer NOT NULL,
  `verse_start` integer,
  `verse_end` integer,
  `kind` text NOT NULL,
  `color` text,
  `ciphertext` text NOT NULL,
  `iv` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE `reading_plans` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL REFERENCES `users`(`id`),
  `title` text NOT NULL,
  `description` text,
  `visibility` text NOT NULL DEFAULT 'private',
  `days_json` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE `plan_subscriptions` (
  `id` text PRIMARY KEY NOT NULL,
  `plan_id` text NOT NULL REFERENCES `reading_plans`(`id`),
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `progress_day` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL
);

CREATE TABLE `forum_posts` (
  `id` text PRIMARY KEY NOT NULL,
  `church_id` text NOT NULL REFERENCES `churches`(`id`),
  `group_id` text,
  `author_id` text NOT NULL REFERENCES `users`(`id`),
  `board` text NOT NULL DEFAULT 'general',
  `title` text NOT NULL,
  `body` text NOT NULL,
  `external_media_url` text,
  `created_at` integer NOT NULL
);

CREATE TABLE `conversations` (
  `id` text PRIMARY KEY NOT NULL,
  `kind` text NOT NULL,
  `title` text,
  `disappearing_ttl_sec` integer,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer NOT NULL
);

CREATE TABLE `conversation_members` (
  `id` text PRIMARY KEY NOT NULL,
  `conversation_id` text NOT NULL REFERENCES `conversations`(`id`),
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `role` text NOT NULL DEFAULT 'member',
  `archived` integer NOT NULL DEFAULT 0
);

CREATE TABLE `messages` (
  `id` text PRIMARY KEY NOT NULL,
  `conversation_id` text NOT NULL REFERENCES `conversations`(`id`),
  `sender_device_id` text NOT NULL,
  `ratchet_header` text NOT NULL,
  `ciphertext` text NOT NULL,
  `content_type` text NOT NULL DEFAULT 'msg',
  `created_at` integer NOT NULL,
  `expires_at` integer,
  `tombstoned` integer NOT NULL DEFAULT 0
);

CREATE TABLE `wipe_commands` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `device_id` text,
  `issued_by` text NOT NULL,
  `reason_code` text NOT NULL,
  `token_hash` text NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `issued_at` integer NOT NULL,
  `expires_at` integer NOT NULL
);

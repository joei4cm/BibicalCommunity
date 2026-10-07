CREATE TABLE `church_groups` (
  `id` text PRIMARY KEY NOT NULL,
  `church_id` text NOT NULL REFERENCES `churches`(`id`),
  `name` text NOT NULL,
  `created_at` integer NOT NULL
);

CREATE TABLE `message_favorites` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `message_id` text NOT NULL,
  `ciphertext` text NOT NULL,
  `iv` text NOT NULL,
  `created_at` integer NOT NULL
);

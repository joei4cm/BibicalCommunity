CREATE TABLE `translation_entitlements` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `translation_id` text NOT NULL,
  `granted_at` integer NOT NULL,
  `expires_at` integer
);
CREATE INDEX `translation_entitlements_user_idx` ON `translation_entitlements` (`user_id`);
CREATE UNIQUE INDEX `translation_entitlements_user_translation_uidx`
  ON `translation_entitlements` (`user_id`, `translation_id`);

CREATE TABLE `one_time_prekeys` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `device_id` text NOT NULL REFERENCES `devices`(`id`),
  `prekey_id` integer NOT NULL,
  `prekey_pub` text NOT NULL,
  `consumed_at` integer
);
CREATE INDEX `one_time_prekeys_user_device_idx` ON `one_time_prekeys` (`user_id`, `device_id`);
CREATE INDEX `one_time_prekeys_unused_idx` ON `one_time_prekeys` (`device_id`, `consumed_at`);

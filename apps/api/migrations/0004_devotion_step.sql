ALTER TABLE `plan_subscriptions` ADD COLUMN `devotion_step` text NOT NULL DEFAULT 'pause';
ALTER TABLE `plan_subscriptions` ADD COLUMN `devotion_material_id` text;

CREATE TABLE `passport_issuer` (
	`client_id` text PRIMARY KEY NOT NULL,
	`granted` integer DEFAULT false NOT NULL,
	`requested_at` integer NOT NULL,
	`decided_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_client`(`client_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `passport` ALTER COLUMN "secret_hash" TO "secret_hash" text;--> statement-breakpoint
ALTER TABLE `passport` ADD `uid` text;--> statement-breakpoint
ALTER TABLE `passport` ADD `key_version` integer;--> statement-breakpoint
ALTER TABLE `passport` ADD `read_counter` integer;--> statement-breakpoint
ALTER TABLE `passport` ADD `issued_by` text REFERENCES oauth_client(client_id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `passport` ADD `activated_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `passport_uid_uidx` ON `passport` (`uid`);
--> statement-breakpoint
INSERT INTO `oauth_resource` (`id`, `identifier`, `name`, `access_token_ttl`, `allowed_scopes`, `dpop_bound_access_tokens_required`, `disabled`, `created_at`, `updated_at`, `policy_version`)
SELECT
  lower(hex(randomblob(16))),
  'https://id.purduehackers.com/api/passports',
  'Purdue Hackers passports',
  300,
  json_array('passports:issue'),
  1,
  0,
  (cast(unixepoch('subsecond') * 1000 as integer)),
  (cast(unixepoch('subsecond') * 1000 as integer)),
  1
WHERE NOT EXISTS (
  SELECT 1 FROM `oauth_resource` WHERE rtrim(`identifier`, '/') = 'https://id.purduehackers.com/api/passports'
);

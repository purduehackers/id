-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `user` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`discord_id` text NOT NULL,
	`role` text NOT NULL,
	`totp` text
);
--> statement-breakpoint
CREATE TABLE `passport` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`version` integer NOT NULL,
	`surname` text NOT NULL,
	`name` text NOT NULL,
	`date_of_birth` text NOT NULL,
	`date_of_issue` text NOT NULL,
	`place_of_origin` text NOT NULL,
	`secret` text NOT NULL,
	`activated` integer DEFAULT 0 NOT NULL,
	`ceremony_time` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ceremonies` (
	`ceremony_time` integer PRIMARY KEY NOT NULL,
	`total_slots` integer NOT NULL,
	`open_registration` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_grant` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`redirect_uri` text NOT NULL,
	`until` integer NOT NULL,
	`scope` text NOT NULL,
	`client_id` text NOT NULL,
	`code` text,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `auth_token` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grant_id` integer NOT NULL,
	`token` text NOT NULL,
	`until` integer NOT NULL,
	FOREIGN KEY (`grant_id`) REFERENCES `auth_grant`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `auth_session` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token` text NOT NULL,
	`until` integer NOT NULL,
	`owner_id` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `oauth_client` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text,
	`owner_id` integer NOT NULL,
	`redirect_uris` text NOT NULL,
	`default_scope` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE cascade
);

*/
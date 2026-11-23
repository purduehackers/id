ALTER TABLE `passport` ADD `reference` text;--> statement-breakpoint
CREATE UNIQUE INDEX `passport_issuedBy_reference_uidx` ON `passport` (`issued_by`,`reference`);

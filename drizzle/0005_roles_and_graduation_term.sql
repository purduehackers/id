UPDATE `user` SET `role` = 'admin,organizer' WHERE `role` = 'admin';--> statement-breakpoint
UPDATE `user` SET `role` = nullif(trim(replace(',' || `role` || ',', ',alumni,', ','), ','), '')
WHERE instr(',' || `role` || ',', ',alumni,') > 0;--> statement-breakpoint
ALTER TABLE `user` ADD `graduation_term` integer;--> statement-breakpoint
UPDATE `user` SET `graduation_term` = `graduation_year` * 2 WHERE `graduation_year` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `graduation_year`;

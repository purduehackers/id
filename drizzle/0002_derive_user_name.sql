UPDATE `user` SET
	`given_name` = CASE
		WHEN instr(trim(`name`), ' ') = 0 THEN trim(`name`)
		ELSE rtrim(rtrim(trim(`name`), replace(trim(`name`), ' ', '')))
	END,
	`family_name` = CASE
		WHEN instr(trim(`name`), ' ') = 0 THEN NULL
		ELSE substr(trim(`name`), length(rtrim(trim(`name`), replace(trim(`name`), ' ', ''))) + 1)
	END
WHERE `given_name` IS NULL AND `family_name` IS NULL;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `name`;--> statement-breakpoint
ALTER TABLE `user` ADD `name` text GENERATED ALWAYS AS (trim(coalesce(given_name, '') || ' ' || coalesce(family_name, ''))) VIRTUAL NOT NULL;
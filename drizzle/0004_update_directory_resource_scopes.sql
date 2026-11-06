UPDATE `oauth_resource`
SET
	`allowed_scopes` = json('["directory:roles","directory:contact","directory:discord"]'),
	`policy_version` = coalesce(`policy_version`, 1) + 1,
	`updated_at` = (cast(unixepoch('subsecond') * 1000 as integer))
WHERE rtrim(`identifier`, '/') = 'https://id.purduehackers.com/api/directory';

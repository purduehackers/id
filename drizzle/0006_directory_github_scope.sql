-- Extend the resource allowlist without granting any client new access.
UPDATE `oauth_resource`
SET
  `allowed_scopes` = json_insert(coalesce(`allowed_scopes`, '[]'), '$[#]', 'directory:github'),
  `policy_version` = coalesce(`policy_version`, 1) + 1,
  `updated_at` = (cast(unixepoch('subsecond') * 1000 as integer))
WHERE rtrim(`identifier`, '/') = 'https://id.purduehackers.com/api/directory'
  AND NOT EXISTS (
    SELECT 1 FROM json_each(coalesce(`allowed_scopes`, '[]')) WHERE value = 'directory:github'
  );

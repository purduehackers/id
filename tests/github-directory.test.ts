import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createClient } from '@libsql/client';
import {
	DIRECTORY_SCOPES,
	MEMBER_CLIENT_SCOPES,
	isDirectoryScope
} from '../src/lib/server/scopes.ts';
import { githubAccountsClaim, githubLinkEvent } from '../src/lib/server/github-links.ts';
import {
	availableEvents,
	expandScopes,
	githubDeliveryAllowed
} from '../src/lib/server/webhook-policy.ts';

const linked = {
	accountId: '12345678901234567890',
	createdAt: new Date('2026-11-14T01:02:03Z'),
	updatedAt: new Date('2026-11-14T02:03:04Z'),
	accessToken: 'never-expose',
	refreshToken: 'never-expose',
	id: 'internal-row-id'
};

test('GitHub directory access is a separate admin-granted scope', () => {
	assert.ok(isDirectoryScope('directory:github'));
	assert.ok(DIRECTORY_SCOPES.includes('directory:github'));
	assert.ok(!MEMBER_CLIENT_SCOPES.includes('directory:github'));
	assert.deepEqual(
		githubAccountsClaim(new Set(['directory:roles', 'directory:discord']), [linked]),
		{}
	);
	assert.deepEqual(githubAccountsClaim(new Set(['directory:github']), []), { github_accounts: [] });
});

test('GitHub links retain native string IDs and all links but exclude credentials', () => {
	const claims = githubAccountsClaim(new Set(['directory:github']), [
		linked,
		{ ...linked, accountId: '2' }
	]);
	assert.deepEqual(claims, {
		github_accounts: [
			{
				id: linked.accountId,
				linked_at: '2026-11-14T01:02:03.000Z',
				updated_at: '2026-11-14T02:03:04.000Z'
			},
			{ id: '2', linked_at: '2026-11-14T01:02:03.000Z', updated_at: '2026-11-14T02:03:04.000Z' }
		]
	});
	assert.ok(!JSON.stringify(claims).includes('never-expose'));
	assert.ok(!JSON.stringify(claims).includes('internal-row-id'));
});

test('GitHub linked and unlinked events disappear when their scope is revoked', () => {
	const allowed = availableEvents(['directory:roles', 'directory:github']);
	assert.ok(allowed.includes('user.github.linked'));
	assert.ok(allowed.includes('user.github.unlinked'));
	assert.ok(
		!availableEvents(['directory:roles', 'directory:discord']).includes('user.github.linked')
	);
	assert.ok(!availableEvents(['profile', 'roles']).includes('user.github.unlinked'));
	const ref = { sub: 'phid1' };
	assert.equal(githubLinkEvent(expandScopes(['directory:roles']), ref, linked), null);
	assert.deepEqual(githubLinkEvent(expandScopes(['directory:github']), ref, linked), {
		user: ref,
		github_account: {
			id: linked.accountId,
			linked_at: '2026-11-14T01:02:03.000Z',
			updated_at: '2026-11-14T02:03:04.000Z'
		}
	});
});

test('resource migration preserves scopes and grants and is idempotent', async () => {
	const client = createClient({ url: ':memory:' });
	try {
		await client.execute(
			'CREATE TABLE oauth_resource(identifier TEXT, allowed_scopes TEXT, policy_version INTEGER, updated_at INTEGER)'
		);
		await client.execute('CREATE TABLE directory_access(client_id TEXT, granted_scopes TEXT)');
		await client.execute({
			sql: 'INSERT INTO oauth_resource VALUES(?,?,?,?)',
			args: [
				'https://id.purduehackers.com/api/directory',
				'["directory:roles","custom:existing"]',
				3,
				1
			]
		});
		await client.execute({
			sql: 'INSERT INTO oauth_resource VALUES(?,?,?,?)',
			args: ['https://unrelated.example', '["other"]', 1, 1]
		});
		await client.execute("INSERT INTO directory_access VALUES('client1','[\"directory:roles\"]')");
		const migration = await readFile(
			new URL('../drizzle/0006_directory_github_scope.sql', import.meta.url),
			'utf8'
		);
		await client.execute(migration);
		await client.execute(migration);
		const rows = (await client.execute('SELECT * FROM oauth_resource ORDER BY identifier')).rows;
		assert.deepEqual(JSON.parse(String(rows[0].allowed_scopes)), [
			'directory:roles',
			'custom:existing',
			'directory:github'
		]);
		assert.equal(rows[0].policy_version, 4);
		assert.equal(rows[1].allowed_scopes, '["other"]');
		assert.equal(
			(await client.execute('SELECT granted_scopes FROM directory_access')).rows[0].granted_scopes,
			'["directory:roles"]'
		);
	} finally {
		client.close();
	}
});

test('queued, retry and resend GitHub events are suppressed after grant or subscription revocation', () => {
	for (const type of ['user.github.linked', 'user.github.unlinked']) {
		// The payload was valid when queued; dispatch must use the new state instead.
		assert.ok(githubLinkEvent(expandScopes(['directory:github']), { sub: 'phid1' }, linked));
		assert.ok(githubDeliveryAllowed(type, [type], ['directory:roles', 'directory:github']));
		assert.equal(githubDeliveryAllowed(type, [type], ['directory:roles']), false);
		assert.equal(githubDeliveryAllowed(type, [], ['directory:github']), false);
		assert.equal(githubDeliveryAllowed(type, [], []), false);
	}
});

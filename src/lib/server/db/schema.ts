import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { oauthClient, user } from './auth.schema';

export * from './auth.schema';

export const auditEvent = sqliteTable(
	'audit_event',
	{
		id: text('id').primaryKey(),
		action: text('action', { enum: ['role', 'ban', 'unban', 'access', 'passport'] }).notNull(),
		actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
		actorUsername: text('actor_username').notNull(),
		targetId: text('target_id').references(() => user.id, { onDelete: 'set null' }),
		targetUsername: text('target_username').notNull(),
		from: text('from'),
		to: text('to'),
		appName: text('app_name'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		index('auditEvent_targetId_idx').on(table.targetId),
		index('auditEvent_createdAt_idx').on(table.createdAt)
	]
);

export const webhookEndpoint = sqliteTable('webhook_endpoint', {
	id: text('id').primaryKey(),
	clientId: text('client_id')
		.notNull()
		.unique()
		.references(() => oauthClient.clientId, { onDelete: 'cascade' }),
	url: text('url').notNull(),
	secret: text('secret').notNull(),
	events: text('events', { mode: 'json' }).$type<string[]>().notNull(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull()
});

export const webhookDelivery = sqliteTable(
	'webhook_delivery',
	{
		id: text('id').primaryKey(),
		endpointId: text('endpoint_id')
			.notNull()
			.references(() => webhookEndpoint.id, { onDelete: 'cascade' }),
		type: text('type').notNull(),
		payload: text('payload').notNull(),
		attempts: integer('attempts').default(0).notNull(),
		nextAttemptAt: integer('next_attempt_at', { mode: 'timestamp_ms' }),
		deliveredAt: integer('delivered_at', { mode: 'timestamp_ms' }),
		failedAt: integer('failed_at', { mode: 'timestamp_ms' }),
		lastStatus: integer('last_status'),
		lastError: text('last_error'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		index('webhookDelivery_endpointId_idx').on(table.endpointId),
		index('webhookDelivery_nextAttemptAt_idx').on(table.nextAttemptAt)
	]
);

export const directoryAccess = sqliteTable('directory_access', {
	clientId: text('client_id')
		.primaryKey()
		.references(() => oauthClient.clientId, { onDelete: 'cascade' }),
	requestedScopes: text('requested_scopes', { mode: 'json' }).$type<string[]>().notNull(),
	grantedScopes: text('granted_scopes', { mode: 'json' }).$type<string[]>().default([]).notNull(),
	requestedAt: integer('requested_at', { mode: 'timestamp_ms' }).notNull(),
	decidedAt: integer('decided_at', { mode: 'timestamp_ms' })
});

export const passport = sqliteTable(
	'passport',
	{
		id: integer('id').primaryKey(),
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
		discordId: text('discord_id'),
		secretHash: text('secret_hash').notNull(),
		activated: integer('activated', { mode: 'boolean' }).default(false).notNull(),
		importedAt: integer('imported_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		index('passport_userId_idx').on(table.userId),
		index('passport_discordId_idx').on(table.discordId)
	]
);

export const passportLogin = sqliteTable(
	'passport_login',
	{
		id: text('id').primaryKey(),
		passportId: integer('passport_id').references(() => passport.id, { onDelete: 'cascade' }),
		code: text('code').notNull(),
		ipHash: text('ip_hash'),
		status: text('status', { enum: ['pending', 'approved', 'used'] })
			.default('pending')
			.notNull(),
		userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [index('passportLogin_code_idx').on(table.code)]
);

export const passportTap = sqliteTable('passport_tap', {
	tokenHash: text('token_hash').primaryKey(),
	passportId: integer('passport_id')
		.notNull()
		.references(() => passport.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull()
});

export const legacyMember = sqliteTable('legacy_member', {
	discordId: text('discord_id').primaryKey(),
	oldUserId: text('old_user_id').notNull(),
	name: text('name').notNull(),
	givenName: text('given_name'),
	familyName: text('family_name'),
	claimedBy: text('claimed_by').references(() => user.id, { onDelete: 'set null' }),
	claimedAt: integer('claimed_at', { mode: 'timestamp_ms' })
});

export const userEmail = sqliteTable(
	'user_email',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		email: text('email').notNull(),
		verifiedAt: integer('verified_at', { mode: 'timestamp_ms' }),
		codeHash: text('code_hash'),
		codeSentAt: integer('code_sent_at', { mode: 'timestamp_ms' }),
		codeAttempts: integer('code_attempts').default(0).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		uniqueIndex('userEmail_userId_email_idx').on(table.userId, table.email),
		uniqueIndex('userEmail_verified_email_idx')
			.on(table.email)
			.where(sql`verified_at is not null`)
	]
);

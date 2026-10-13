import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { oauthClient, user } from './auth.schema';

export * from './auth.schema';

export const auditEvent = sqliteTable(
	'audit_event',
	{
		id: text('id').primaryKey(),
		action: text('action', { enum: ['role', 'ban', 'unban', 'access'] }).notNull(),
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

import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { user } from './auth.schema';

export * from './auth.schema';

export const auditEvent = sqliteTable(
	'audit_event',
	{
		id: text('id').primaryKey(),
		action: text('action', { enum: ['role', 'ban', 'unban'] }).notNull(),
		actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
		actorUsername: text('actor_username').notNull(),
		targetId: text('target_id').references(() => user.id, { onDelete: 'set null' }),
		targetUsername: text('target_username').notNull(),
		from: text('from'),
		to: text('to'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		index('auditEvent_targetId_idx').on(table.targetId),
		index('auditEvent_createdAt_idx').on(table.createdAt)
	]
);

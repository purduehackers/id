import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { session } from '$lib/server/db/schema';
import { describeUserAgent } from '$lib/server/user-agent';

export async function activeSessions(userId: string) {
	const rows = await db
		.select({
			id: session.id,
			createdAt: session.createdAt,
			updatedAt: session.updatedAt,
			ipAddress: session.ipAddress,
			userAgent: session.userAgent
		})
		.from(session)
		.where(and(eq(session.userId, userId), gt(session.expiresAt, new Date())))
		.orderBy(desc(session.updatedAt));

	return rows.map((row) => ({
		id: row.id,
		device: describeUserAgent(row.userAgent),
		ipAddress: row.ipAddress,
		signedInAt: row.createdAt,
		activeAt: row.updatedAt
	}));
}

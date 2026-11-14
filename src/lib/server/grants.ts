import { and, eq, gt, inArray, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { readList } from '$lib/server/db/json';
import {
	deviceCode,
	oauthAccessToken,
	oauthClient,
	oauthConsent,
	oauthGrantRevocation,
	oauthRefreshToken,
	user
} from '$lib/server/db/schema';
import { SCOPE_DESCRIPTIONS } from '$lib/server/scopes';

const scopeWords = (scope: string | null) => (scope ?? '').split(/\s+/).filter(Boolean);

export async function authorizedApps(userId: string) {
	const now = new Date();

	const [consents, accessTokens, refreshTokens, approvedCodes] = await Promise.all([
		db
			.select({
				clientId: oauthConsent.clientId,
				scopes: oauthConsent.scopes,
				createdAt: oauthConsent.createdAt
			})
			.from(oauthConsent)
			.where(eq(oauthConsent.userId, userId)),
		db
			.select({
				clientId: oauthAccessToken.clientId,
				scopes: oauthAccessToken.scopes,
				createdAt: oauthAccessToken.createdAt
			})
			.from(oauthAccessToken)
			.where(and(eq(oauthAccessToken.userId, userId), gt(oauthAccessToken.expiresAt, now))),
		db
			.select({
				clientId: oauthRefreshToken.clientId,
				scopes: oauthRefreshToken.scopes,
				createdAt: oauthRefreshToken.createdAt
			})
			.from(oauthRefreshToken)
			.where(
				and(
					eq(oauthRefreshToken.userId, userId),
					gt(oauthRefreshToken.expiresAt, now),
					isNull(oauthRefreshToken.revoked)
				)
			),
		db
			.select({ clientId: deviceCode.clientId, scope: deviceCode.scope })
			.from(deviceCode)
			.where(
				and(
					eq(deviceCode.userId, userId),
					eq(deviceCode.status, 'approved'),
					gt(deviceCode.expiresAt, now)
				)
			)
	]);

	const apps = new Map<string, { grantedAt: Date; scopes: Set<string> }>();
	const add = (clientId: string, scopes: string[], grantedAt: Date) => {
		const app = apps.get(clientId) ?? { grantedAt, scopes: new Set<string>() };
		if (grantedAt < app.grantedAt) app.grantedAt = grantedAt;
		scopes.forEach((scope) => app.scopes.add(scope));
		apps.set(clientId, app);
	};
	for (const grant of [...consents, ...accessTokens, ...refreshTokens]) {
		add(grant.clientId, readList(grant.scopes), grant.createdAt);
	}
	for (const code of approvedCodes) {
		if (code.clientId) add(code.clientId, scopeWords(code.scope), now);
	}

	const clients = apps.size
		? await db
				.select({ clientId: oauthClient.clientId, name: oauthClient.name })
				.from(oauthClient)
				.where(inArray(oauthClient.clientId, [...apps.keys()]))
		: [];
	const nameFor = new Map(clients.map((client) => [client.clientId, client.name]));

	return [...apps]
		.sort(([, a], [, b]) => b.grantedAt.getTime() - a.grantedAt.getTime())
		.map(([clientId, app]) => ({
			id: clientId,
			name: nameFor.get(clientId) ?? clientId,
			grantedAt: app.grantedAt,
			scopes: [...app.scopes].map((scope) => SCOPE_DESCRIPTIONS[scope] ?? scope)
		}));
}

export function revokeApp(userId: string, clientId: string) {
	return db.transaction(async (tx) => {
		const consents = await tx
			.delete(oauthConsent)
			.where(and(eq(oauthConsent.userId, userId), eq(oauthConsent.clientId, clientId)))
			.returning({ id: oauthConsent.id });
		const access = await tx
			.delete(oauthAccessToken)
			.where(and(eq(oauthAccessToken.userId, userId), eq(oauthAccessToken.clientId, clientId)))
			.returning({ id: oauthAccessToken.id });
		const refresh = await tx
			.delete(oauthRefreshToken)
			.where(and(eq(oauthRefreshToken.userId, userId), eq(oauthRefreshToken.clientId, clientId)))
			.returning({ id: oauthRefreshToken.id });
		const codes = await tx
			.delete(deviceCode)
			.where(
				and(
					eq(deviceCode.userId, userId),
					eq(deviceCode.clientId, clientId),
					eq(deviceCode.status, 'approved')
				)
			)
			.returning({ id: deviceCode.id });
		const removed = consents.length + access.length + refresh.length + codes.length;
		if (removed > 0) {
			const revokedAt = new Date();
			await tx
				.insert(oauthGrantRevocation)
				.values({ userId, clientId, revokedAt })
				.onConflictDoUpdate({
					target: [oauthGrantRevocation.userId, oauthGrantRevocation.clientId],
					set: { revokedAt }
				});
		}
		return removed;
	});
}

export async function grantIsActive(userId: string, clientId: string, issuedAt: number) {
	const [row] = await db
		.select({
			banned: user.banned,
			disabled: oauthClient.disabled,
			revokedAt: oauthGrantRevocation.revokedAt
		})
		.from(user)
		.innerJoin(oauthClient, eq(oauthClient.clientId, clientId))
		.leftJoin(
			oauthGrantRevocation,
			and(eq(oauthGrantRevocation.userId, user.id), eq(oauthGrantRevocation.clientId, clientId))
		)
		.where(eq(user.id, userId))
		.limit(1);
	if (!row || row.banned || row.disabled) return false;
	return !row.revokedAt || issuedAt * 1000 >= row.revokedAt.getTime();
}

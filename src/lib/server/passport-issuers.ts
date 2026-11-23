import { and, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { auditEvent, oauthClient, passportIssuer, user } from '$lib/server/db/schema';
import { syncClientCredentials } from '$lib/server/client-credentials';
import { uuidv7 } from '$lib/server/uuid';

export class IssuerError extends Error {}

type Actor = { id: string; username: string };

export async function issuerFor(clientId: string) {
	const [row] = await db
		.select()
		.from(passportIssuer)
		.where(eq(passportIssuer.clientId, clientId))
		.limit(1);
	return row ?? null;
}

export async function isIssuer(clientId: string) {
	return (await issuerFor(clientId))?.granted === true;
}

export async function requestIssuing(ownerId: string, clientId: string) {
	const [client] = await db
		.select({ authMethod: oauthClient.tokenEndpointAuthMethod })
		.from(oauthClient)
		.where(and(eq(oauthClient.clientId, clientId), eq(oauthClient.userId, ownerId)))
		.limit(1);
	if (!client) throw new IssuerError('That is not your application.');
	if (client.authMethod === 'none') {
		throw new IssuerError('Only confidential applications, with a secret, can issue passports.');
	}

	await db
		.insert(passportIssuer)
		.values({ clientId, requestedAt: new Date() })
		.onConflictDoUpdate({ target: passportIssuer.clientId, set: { requestedAt: new Date() } });
}

export function listIssuers() {
	return db
		.select({
			clientId: passportIssuer.clientId,
			granted: passportIssuer.granted,
			requestedAt: passportIssuer.requestedAt,
			decidedAt: passportIssuer.decidedAt,
			name: oauthClient.name,
			ownerUsername: user.username
		})
		.from(passportIssuer)
		.innerJoin(oauthClient, eq(oauthClient.clientId, passportIssuer.clientId))
		.leftJoin(user, eq(user.id, oauthClient.userId))
		.orderBy(desc(passportIssuer.requestedAt));
}

export async function decideIssuing(actor: Actor, clientId: string, grant: boolean) {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.select({
				granted: passportIssuer.granted,
				name: oauthClient.name,
				authMethod: oauthClient.tokenEndpointAuthMethod,
				ownerId: oauthClient.userId,
				ownerUsername: user.username
			})
			.from(passportIssuer)
			.innerJoin(oauthClient, eq(oauthClient.clientId, passportIssuer.clientId))
			.leftJoin(user, eq(user.id, oauthClient.userId))
			.where(eq(passportIssuer.clientId, clientId))
			.limit(1);
		if (!row) throw new IssuerError('That application has not asked to issue passports.');
		if (grant && row.authMethod === 'none') {
			throw new IssuerError('Only confidential applications can issue passports.');
		}

		await tx
			.update(passportIssuer)
			.set({ granted: grant, decidedAt: new Date() })
			.where(eq(passportIssuer.clientId, clientId));
		await syncClientCredentials(tx, clientId);
		await tx.insert(auditEvent).values({
			id: uuidv7(),
			action: 'passport-access',
			actorId: actor.id,
			actorUsername: actor.username,
			targetId: row.ownerId,
			targetUsername: row.ownerUsername ?? 'unknown',
			appName: row.name ?? clientId,
			from: row.granted ? 'passports:issue' : null,
			to: grant ? 'passports:issue' : null
		});

		return row.name ?? clientId;
	});
}

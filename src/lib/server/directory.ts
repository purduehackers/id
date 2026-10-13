import { and, desc, eq } from 'drizzle-orm';
import { verifyJwsAccessToken } from 'better-auth/oauth2';
import { env } from '$env/dynamic/private';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import {
	auditEvent,
	directoryAccess,
	oauthClient,
	oauthClientResource,
	user
} from '$lib/server/db/schema';
import { readList, writeList } from '$lib/server/db/json';
import { DIRECTORY_RESOURCE, isDirectoryScope, type DirectoryScope } from '$lib/server/scopes';
import { uuidv7 } from '$lib/server/uuid';

export class DirectoryError extends Error {}

type Actor = { id: string; username: string };

export async function accessFor(clientId: string) {
	const [row] = await db
		.select()
		.from(directoryAccess)
		.where(eq(directoryAccess.clientId, clientId))
		.limit(1);
	return row ?? null;
}

export async function grantedScopes(clientId: string): Promise<DirectoryScope[]> {
	return ((await accessFor(clientId))?.grantedScopes ?? []).filter(isDirectoryScope);
}

export async function requestAccess(ownerId: string, clientId: string, scopes: string[]) {
	const requested = scopes.filter(isDirectoryScope);
	if (requested.length === 0) throw new DirectoryError('Pick at least one kind of access.');

	const [client] = await db
		.select({ authMethod: oauthClient.tokenEndpointAuthMethod })
		.from(oauthClient)
		.where(and(eq(oauthClient.clientId, clientId), eq(oauthClient.userId, ownerId)))
		.limit(1);
	if (!client) throw new DirectoryError('That is not your application.');
	if (client.authMethod === 'none') {
		throw new DirectoryError('Only confidential applications, with a secret, can get access.');
	}

	await db
		.insert(directoryAccess)
		.values({ clientId, requestedScopes: requested, requestedAt: new Date() })
		.onConflictDoUpdate({
			target: directoryAccess.clientId,
			set: { requestedScopes: requested, requestedAt: new Date() }
		});
}

export function listAccess() {
	return db
		.select({
			clientId: directoryAccess.clientId,
			requestedScopes: directoryAccess.requestedScopes,
			grantedScopes: directoryAccess.grantedScopes,
			requestedAt: directoryAccess.requestedAt,
			decidedAt: directoryAccess.decidedAt,
			name: oauthClient.name,
			ownerUsername: user.username
		})
		.from(directoryAccess)
		.innerJoin(oauthClient, eq(oauthClient.clientId, directoryAccess.clientId))
		.leftJoin(user, eq(user.id, oauthClient.userId))
		.orderBy(desc(directoryAccess.requestedAt));
}

export async function decide(actor: Actor, clientId: string, scopes: string[]) {
	return db.transaction(async (tx) => {
		const [access] = await tx
			.select()
			.from(directoryAccess)
			.where(eq(directoryAccess.clientId, clientId))
			.limit(1);
		const [client] = await tx
			.select({
				name: oauthClient.name,
				grantTypes: oauthClient.grantTypes,
				ownerId: oauthClient.userId,
				ownerUsername: user.username
			})
			.from(oauthClient)
			.leftJoin(user, eq(user.id, oauthClient.userId))
			.where(eq(oauthClient.clientId, clientId))
			.limit(1);
		if (!access || !client) throw new DirectoryError('That application has not asked for access.');

		const granted = scopes.filter(
			(scope) => isDirectoryScope(scope) && access.requestedScopes.includes(scope)
		);
		const grantTypes = readList(client.grantTypes).filter((type) => type !== 'client_credentials');
		if (granted.length) grantTypes.push('client_credentials');

		await tx
			.update(oauthClient)
			.set({ grantTypes: writeList(grantTypes), clientCredentialsScopes: writeList(granted) })
			.where(eq(oauthClient.clientId, clientId));

		if (granted.length) {
			await tx
				.insert(oauthClientResource)
				.values({ id: uuidv7(), clientId, resourceId: DIRECTORY_RESOURCE, createdAt: new Date() })
				.onConflictDoNothing();
		} else {
			await tx
				.delete(oauthClientResource)
				.where(
					and(
						eq(oauthClientResource.clientId, clientId),
						eq(oauthClientResource.resourceId, DIRECTORY_RESOURCE)
					)
				);
		}

		await tx
			.update(directoryAccess)
			.set({ grantedScopes: granted, decidedAt: new Date() })
			.where(eq(directoryAccess.clientId, clientId));
		await tx.insert(auditEvent).values({
			id: uuidv7(),
			action: 'access',
			actorId: actor.id,
			actorUsername: actor.username,
			targetId: client.ownerId,
			targetUsername: client.ownerUsername ?? 'unknown',
			appName: client.name ?? clientId,
			from: access.grantedScopes.join(' ') || null,
			to: granted.join(' ') || null
		});

		return client.name ?? clientId;
	});
}

const jwksCacheKey = {};

function bearerError(status: 401 | 403, error: string, description: string) {
	return Response.json(
		{ error, error_description: description },
		{
			status,
			headers: { 'www-authenticate': `Bearer error="${error}", error_description="${description}"` }
		}
	);
}

export async function authorizeDirectoryRequest(request: Request) {
	const header = request.headers.get('authorization') ?? '';
	const token = header.match(/^Bearer\s+(.+)$/i)?.[1];
	if (!token) return bearerError(401, 'invalid_request', 'Missing bearer token.');

	const origin = new URL(request.url).origin;
	const issuers = [...new Set([`${env.ORIGIN ?? origin}/api/auth`, `${origin}/api/auth`])];

	let payload;
	try {
		payload = await verifyJwsAccessToken(token, {
			jwksFetch: () => auth.api.getJwks(),
			jwksCacheKey,
			verifyOptions: { audience: DIRECTORY_RESOURCE, issuer: issuers }
		});
	} catch {
		return bearerError(401, 'invalid_token', 'Invalid or expired token.');
	}

	const clientId = (payload.azp ?? payload.client_id) as string | undefined;
	if (!clientId) return bearerError(401, 'invalid_token', 'Token has no client.');

	const tokenScopes = String(payload.scope ?? '').split(' ');
	const granted = await grantedScopes(clientId);
	const scopes = new Set(granted.filter((scope) => tokenScopes.includes(scope)));
	if (!scopes.has('directory:roles')) {
		return bearerError(403, 'insufficient_scope', 'This application lacks directory:roles.');
	}

	return { clientId, scopes };
}

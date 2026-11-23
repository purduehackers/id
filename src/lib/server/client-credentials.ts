import { and, eq, inArray } from 'drizzle-orm';
import type { db } from '$lib/server/db';
import {
	directoryAccess,
	oauthClient,
	oauthClientResource,
	passportIssuer
} from '$lib/server/db/schema';
import { readList, writeList } from '$lib/server/db/json';
import {
	DIRECTORY_RESOURCE,
	PASSPORT_RESOURCE,
	PASSPORT_SCOPES,
	isDirectoryScope
} from '$lib/server/scopes';
import { uuidv7 } from '$lib/server/uuid';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const MANAGED_RESOURCES = [DIRECTORY_RESOURCE, PASSPORT_RESOURCE];

export async function syncClientCredentials(tx: Tx, clientId: string) {
	const [client] = await tx
		.select({ grantTypes: oauthClient.grantTypes })
		.from(oauthClient)
		.where(eq(oauthClient.clientId, clientId))
		.limit(1);
	if (!client) return;
	const [directory] = await tx
		.select({ granted: directoryAccess.grantedScopes })
		.from(directoryAccess)
		.where(eq(directoryAccess.clientId, clientId))
		.limit(1);
	const [issuer] = await tx
		.select({ granted: passportIssuer.granted })
		.from(passportIssuer)
		.where(eq(passportIssuer.clientId, clientId))
		.limit(1);

	const directoryScopes = (directory?.granted ?? []).filter(isDirectoryScope);
	const passportScopes = issuer?.granted ? PASSPORT_SCOPES : [];
	const scopes = [...directoryScopes, ...passportScopes];
	const resources = [
		...(directoryScopes.length ? [DIRECTORY_RESOURCE] : []),
		...(passportScopes.length ? [PASSPORT_RESOURCE] : [])
	];

	const grantTypes = readList(client.grantTypes).filter((type) => type !== 'client_credentials');
	if (scopes.length) grantTypes.push('client_credentials');

	await tx
		.update(oauthClient)
		.set({ grantTypes: writeList(grantTypes), clientCredentialsScopes: writeList(scopes) })
		.where(eq(oauthClient.clientId, clientId));

	const revoked = MANAGED_RESOURCES.filter((resource) => !resources.includes(resource));
	if (revoked.length) {
		await tx
			.delete(oauthClientResource)
			.where(
				and(
					eq(oauthClientResource.clientId, clientId),
					inArray(oauthClientResource.resourceId, revoked)
				)
			);
	}
	for (const resourceId of resources) {
		await tx
			.insert(oauthClientResource)
			.values({ id: uuidv7(), clientId, resourceId, createdAt: new Date() })
			.onConflictDoNothing();
	}
}

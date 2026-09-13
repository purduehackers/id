import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../src/lib/server/db/auth.schema.ts';

type Seed = {
	clientId: string;
	name: string;
	redirectUris: string[];
	scopes: string[];
	isPublic: boolean;
	skipConsent: boolean;
};

const CLIENTS: Seed[] = [
	{
		clientId: 'id-dash',
		name: 'ID Dashboard',
		redirectUris: ['http://localhost:5173/dash'],
		scopes: ['openid', 'profile', 'email', 'user:read', 'user'],
		isPublic: true,
		skipConsent: true
	},
	{
		clientId: 'authority',
		name: 'Passport Authority',
		redirectUris: ['authority://callback'],
		scopes: ['openid', 'profile', 'offline_access', 'admin:read', 'admin'],
		isPublic: true,
		skipConsent: false
	}
];

const url = Deno.env.get('DATABASE_URL');
if (!url) throw new Error('DATABASE_URL is not set');

const sql = postgres(url);
const db = drizzle(sql, { schema });

for (const client of CLIENTS) {
	const [existing] = await db
		.select({ clientId: schema.oauthClient.clientId })
		.from(schema.oauthClient)
		.where(eq(schema.oauthClient.clientId, client.clientId))
		.limit(1);

	if (existing) {
		console.log(`= ${client.clientId} (already present, untouched)`);
		continue;
	}

	await db.insert(schema.oauthClient).values({
		clientId: client.clientId,
		clientSecret: null,
		name: client.name,
		redirectUris: client.redirectUris,
		scopes: client.scopes,
		tokenEndpointAuthMethod: client.isPublic ? 'none' : 'client_secret_basic',
		grantTypes: ['authorization_code', 'refresh_token'],
		responseTypes: ['code'],
		skipConsent: client.skipConsent,
		requirePKCE: true,
		disabled: false,
		createdAt: new Date(),
		updatedAt: new Date()
	});

	console.log(`+ ${client.clientId}`);
}

await sql.end();

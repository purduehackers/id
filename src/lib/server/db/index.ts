import { drizzle } from 'drizzle-orm/libsql';
import { createClient, type Client, type InStatement } from '@libsql/client';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.TURSO_DATABASE_URL) throw new Error('TURSO_DATABASE_URL is not set');

const client = createClient({
	url: env.TURSO_DATABASE_URL,
	authToken: env.TURSO_AUTH_TOKEN
});

const NETWORK_ERROR_CODES = new Set([
	'HRANA_CLOSED_ERROR',
	'ECONNRESET',
	'ECONNREFUSED',
	'ETIMEDOUT',
	'ENOTFOUND',
	'EAI_AGAIN',
	'EPIPE'
]);

function isNetworkError(err: unknown): boolean {
	for (let e = err; e instanceof Error; e = e.cause) {
		const code = (e as { code?: unknown }).code;
		if (typeof code === 'string' && (NETWORK_ERROR_CODES.has(code) || code.startsWith('UND_ERR_')))
			return true;
		if (e instanceof TypeError && e.message === 'fetch failed') return true;
	}
	return false;
}

function isReadOnly(stmt: InStatement): boolean {
	const sql = typeof stmt === 'string' ? stmt : stmt.sql;
	return /^\s*select\b/i.test(sql);
}

const execute = client.execute.bind(client) as (stmt: InStatement) => ReturnType<Client['execute']>;
client.execute = (async (stmt: InStatement) => {
	try {
		return await execute(stmt);
	} catch (err) {
		console.error('[db] libsql execute failed', err);
		if (!isReadOnly(stmt) || !isNetworkError(err)) throw err;
		await new Promise((resolve) => setTimeout(resolve, 100));
		return await execute(stmt);
	}
}) as Client['execute'];

const batch = client.batch.bind(client);
client.batch = (async (...args: Parameters<Client['batch']>) => {
	try {
		return await batch(...args);
	} catch (err) {
		console.error('[db] libsql batch failed', err);
		throw err;
	}
}) as Client['batch'];

export const db = drizzle(client, { schema });

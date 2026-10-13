import { lookup as dnsLookup } from 'node:dns';
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { and, asc, desc, eq, isNotNull, isNull, lt, lte, or } from 'drizzle-orm';
import { waitUntil } from '@vercel/functions';
import { symmetricDecrypt, symmetricEncrypt } from 'better-auth/crypto';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { db } from '$lib/server/db';
import {
	account,
	directoryAccess,
	oauthConsent,
	user,
	webhookDelivery,
	webhookEndpoint
} from '$lib/server/db/schema';
import { readList } from '$lib/server/db/json';
import { isDirectoryScope } from '$lib/server/scopes';
import { uuidv7 } from '$lib/server/uuid';
import { grantedRoles } from '$lib/roles';

export const WEBHOOK_EVENTS = {
	'user.roles.changed': { description: "A user's roles changed.", needs: ['roles'] },
	'user.banned': { description: 'A user was banned.', needs: [] },
	'user.unbanned': { description: 'A user was unbanned.', needs: [] },
	'user.updated': {
		description: 'A user was updated. Carries their current name, username, avatar or email.',
		needs: ['profile', 'email']
	},
	'user.discord.linked': { description: 'A user connected a Discord account.', needs: ['discord'] },
	'user.discord.unlinked': {
		description: 'A user disconnected their Discord account.',
		needs: ['discord']
	}
} as const satisfies Record<string, { description: string; needs: readonly string[] }>;
export type WebhookEvent = keyof typeof WEBHOOK_EVENTS;

const DIRECTORY_EXPANDS: Record<string, string[]> = {
	'directory:roles': ['roles', 'profile'],
	'directory:discord': ['discord']
};

export function expandScopes(scopes: string[]): Set<string> {
	return new Set(scopes.flatMap((scope) => DIRECTORY_EXPANDS[scope] ?? [scope]));
}

export function availableEvents(scopes: string[]): WebhookEvent[] {
	const visible = expandScopes(scopes);
	return (Object.keys(WEBHOOK_EVENTS) as WebhookEvent[]).filter((type) => {
		const needs: readonly string[] = WEBHOOK_EVENTS[type].needs;
		return needs.length === 0 || needs.some((scope) => visible.has(scope));
	});
}

type Db = typeof db;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export function newSecret() {
	return `whsec_${Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64')}`;
}

export const sealSecret = (secret: string) =>
	symmetricEncrypt({ key: env.BETTER_AUTH_SECRET!, data: secret });
const openSecret = (sealed: string) =>
	symmetricDecrypt({ key: env.BETTER_AUTH_SECRET!, data: sealed });

async function sign(secret: string, id: string, timestamp: number, body: string) {
	const key = await crypto.subtle.importKey(
		'raw',
		Buffer.from(secret.replace(/^whsec_/, ''), 'base64'),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const mac = await crypto.subtle.sign('HMAC', key, Buffer.from(`${id}.${timestamp}.${body}`));
	return `v1,${Buffer.from(mac).toString('base64')}`;
}

function isPrivateAddress(address: string): boolean {
	if (isIP(address) === 6) {
		const a = address.toLowerCase();
		if (a.startsWith('::ffff:')) return isPrivateAddress(a.slice(7));
		return (
			a === '::1' ||
			a === '::' ||
			/^f[cd]/.test(a) ||
			/^fe[89ab]/.test(a) ||
			a.startsWith('64:ff9b:')
		);
	}
	const [x, y, z] = address.split('.').map(Number);
	return (
		x === 0 ||
		x === 10 ||
		x === 127 ||
		(x === 100 && y >= 64 && y <= 127) ||
		(x === 169 && y === 254) ||
		(x === 172 && y >= 16 && y <= 31) ||
		(x === 192 && y === 0 && z === 0) ||
		(x === 192 && y === 168) ||
		(x === 198 && (y === 18 || y === 19)) ||
		x >= 224
	);
}

const isLocalDev = (url: URL) => dev && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);

function staticProblem(url: URL): string | null {
	if (isLocalDev(url)) return null;
	if (url.protocol !== 'https:') return 'Webhook URLs must use https.';
	if (url.username || url.password) return 'Leave credentials out of the URL.';
	const host = url.hostname.replace(/^\[|\]$/g, '');
	if (isIP(host) && isPrivateAddress(host)) return 'Webhook URLs must point to a public address.';
	return null;
}

export async function urlProblem(raw: string): Promise<string | null> {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return 'That is not a valid URL.';
	}
	const problem = staticProblem(url);
	if (problem || isLocalDev(url) || isIP(url.hostname.replace(/^\[|\]$/g, ''))) return problem;

	try {
		const addresses = await lookup(url.hostname, { all: true });
		if (addresses.some(({ address }) => isPrivateAddress(address))) {
			return 'Webhook URLs must point to a public address.';
		}
	} catch {
		return `Could not resolve ${url.hostname}.`;
	}
	return null;
}

const lookupPublic: LookupFunction = (hostname, options, callback) => {
	dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
		if (!error && addresses.some(({ address }) => isPrivateAddress(address))) {
			error = Object.assign(new Error('private address'), { code: 'EPRIVATE' });
		}
		if (error) return callback(error, '');
		if (options.all) return callback(null, addresses);
		callback(null, addresses[0].address, addresses[0].family);
	});
};

type EventUser = { id: string; username: string };
type Ref = Record<string, unknown>;
type Build = (scopes: Set<string>, ref: Ref) => Record<string, unknown> | null;

function envelope(type: string, data: Record<string, unknown>) {
	return JSON.stringify({ type, timestamp: new Date().toISOString(), data });
}

export async function enqueueForUser(
	tx: Tx | Db,
	target: EventUser,
	type: WebhookEvent,
	build: Build
) {
	const consented = await tx
		.select({
			endpointId: webhookEndpoint.id,
			events: webhookEndpoint.events,
			scopes: oauthConsent.scopes
		})
		.from(webhookEndpoint)
		.innerJoin(
			oauthConsent,
			and(eq(oauthConsent.clientId, webhookEndpoint.clientId), eq(oauthConsent.userId, target.id))
		);
	const directory = await tx
		.select({
			endpointId: webhookEndpoint.id,
			events: webhookEndpoint.events,
			scopes: directoryAccess.grantedScopes
		})
		.from(webhookEndpoint)
		.innerJoin(directoryAccess, eq(directoryAccess.clientId, webhookEndpoint.clientId));

	const granted = new Map<string, string[]>();
	for (const row of [
		...consented.map((row) => ({
			...row,
			scopes: readList(row.scopes).filter((s) => !isDirectoryScope(s))
		})),
		...directory
	]) {
		if (!row.events.includes(type) || row.scopes.length === 0) continue;
		granted.set(row.endpointId, [...(granted.get(row.endpointId) ?? []), ...row.scopes]);
	}

	let discordId: string | null | undefined;
	for (const [endpointId, list] of granted) {
		const scopes = expandScopes(list);
		if (scopes.has('discord') && discordId === undefined) {
			discordId = await linkedDiscord(tx, target.id);
		}
		const ref: Ref = {
			sub: target.id,
			...(scopes.has('profile') && { preferred_username: target.username }),
			...(scopes.has('discord') && { discord_id: discordId ?? null })
		};
		const data = build(scopes, ref);
		if (!data) continue;
		await tx.insert(webhookDelivery).values({
			id: `msg_${uuidv7()}`,
			endpointId,
			type,
			payload: envelope(type, data),
			nextAttemptAt: new Date()
		});
	}
}

async function linkedDiscord(tx: Tx | Db, userId: string) {
	const [row] = await tx
		.select({ id: account.accountId })
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, 'discord')))
		.limit(1);
	return row?.id ?? null;
}

export function rolesChanged(previous: string | null, next: string | null): Build {
	return (scopes, ref) =>
		scopes.has('roles')
			? { user: ref, previous_roles: grantedRoles(previous), roles: grantedRoles(next) }
			: null;
}

export const banChanged: Build = (_scopes, ref) => ({ user: ref });

type Profile = {
	id: string;
	name: string;
	username?: string | null;
	image?: string | null;
	email: string;
	emailVerified: boolean;
};

const PROFILE_CLAIMS = [
	{ claim: 'name', scope: 'profile', read: (u: Profile) => u.name },
	{ claim: 'preferred_username', scope: 'profile', read: (u: Profile) => u.username },
	{ claim: 'picture', scope: 'profile', read: (u: Profile) => u.image ?? null },
	{ claim: 'email', scope: 'email', read: (u: Profile) => u.email },
	{ claim: 'email_verified', scope: 'email', read: (u: Profile) => u.emailVerified }
] as const;

export async function recordProfileUpdate(profile: Profile) {
	const target = { id: profile.id, username: profile.username ?? '' };
	await enqueueForUser(db, target, 'user.updated', (scopes, ref) => {
		const claims = PROFILE_CLAIMS.filter((c) => scopes.has(c.scope));
		if (claims.length === 0) return null;
		return {
			user: { ...ref, ...Object.fromEntries(claims.map((c) => [c.claim, c.read(profile)])) }
		};
	});
	deliverSoon();
}

export async function recordDiscordLink(userId: string, discordId: string, linked: boolean) {
	const [target] = await db
		.select({ id: user.id, username: user.username })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (!target) return;

	const type = linked ? 'user.discord.linked' : 'user.discord.unlinked';
	await enqueueForUser(db, target, type, (scopes, ref) =>
		scopes.has('discord') ? { user: { ...ref, discord_id: discordId } } : null
	);
	deliverSoon();
}

export async function enqueueTest(endpointId: string, clientId: string) {
	const id = `msg_${uuidv7()}`;
	await db.insert(webhookDelivery).values({
		id,
		endpointId,
		type: 'webhook.test',
		payload: envelope('webhook.test', { client_id: clientId }),
		nextAttemptAt: new Date()
	});
	return id;
}

const RETRY_DELAYS = [60, 300, 1800, 7200, 18000, 36000, 36000].map((s) => s * 1000);
const LEASE = 60_000;
const TIMEOUT = 10_000;
const RETENTION = 30 * 24 * 60 * 60 * 1000;

type Outcome = { ok: boolean; status: number | null; error: string | null };

function post(url: URL, headers: Record<string, string>, body: string): Promise<number> {
	const local = isLocalDev(url);
	const request = local && url.protocol === 'http:' ? httpRequest : httpsRequest;
	return new Promise((resolve, reject) => {
		const req = request(
			url,
			{
				method: 'POST',
				headers,
				lookup: local ? undefined : lookupPublic,
				signal: AbortSignal.timeout(TIMEOUT)
			},
			(response) => {
				response.resume();
				resolve(response.statusCode ?? 0);
			}
		);
		req.on('error', reject);
		req.end(body);
	});
}

async function send(raw: string, secret: string, id: string, payload: string): Promise<Outcome> {
	const url = new URL(raw);
	const problem = staticProblem(url);
	if (problem) return { ok: false, status: null, error: problem };

	const timestamp = Math.floor(Date.now() / 1000);
	try {
		const status = await post(
			url,
			{
				'content-type': 'application/json',
				'user-agent': 'PurdueHackersID-Webhooks/1',
				'webhook-id': id,
				'webhook-timestamp': String(timestamp),
				'webhook-signature': await sign(secret, id, timestamp, payload)
			},
			payload
		);
		const ok = status >= 200 && status < 300;
		return { ok, status, error: ok ? null : `HTTP ${status}` };
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		const message =
			(error as Error).name === 'AbortError'
				? 'Timed out'
				: code === 'EPRIVATE'
					? 'Points to a private address'
					: 'Could not connect';
		return { ok: false, status: null, error: message };
	}
}

export async function deliverDue(options: { endpointId?: string } = {}) {
	const now = new Date();
	const due = await db
		.select({
			id: webhookDelivery.id,
			payload: webhookDelivery.payload,
			attempts: webhookDelivery.attempts,
			url: webhookEndpoint.url,
			secret: webhookEndpoint.secret
		})
		.from(webhookDelivery)
		.innerJoin(webhookEndpoint, eq(webhookEndpoint.id, webhookDelivery.endpointId))
		.where(
			and(
				isNull(webhookDelivery.deliveredAt),
				isNull(webhookDelivery.failedAt),
				lte(webhookDelivery.nextAttemptAt, now),
				options.endpointId ? eq(webhookDelivery.endpointId, options.endpointId) : undefined
			)
		)
		.orderBy(asc(webhookDelivery.nextAttemptAt))
		.limit(25);

	const secrets = new Map<string, Promise<string>>();
	await Promise.all(
		due.map(async (row) => {
			const [claimed] = await db
				.update(webhookDelivery)
				.set({ nextAttemptAt: new Date(Date.now() + LEASE) })
				.where(
					and(
						eq(webhookDelivery.id, row.id),
						isNull(webhookDelivery.deliveredAt),
						isNull(webhookDelivery.failedAt),
						lte(webhookDelivery.nextAttemptAt, now)
					)
				)
				.returning({ id: webhookDelivery.id });
			if (!claimed) return;

			if (!secrets.has(row.secret)) secrets.set(row.secret, openSecret(row.secret));
			const outcome = await send(row.url, await secrets.get(row.secret)!, row.id, row.payload);

			const attempts = row.attempts + 1;
			const delay = RETRY_DELAYS[attempts - 1];
			await db
				.update(webhookDelivery)
				.set({
					attempts,
					lastStatus: outcome.status,
					lastError: outcome.error,
					...(outcome.ok
						? { deliveredAt: new Date(), nextAttemptAt: null }
						: delay === undefined
							? { failedAt: new Date(), nextAttemptAt: null }
							: { nextAttemptAt: new Date(Date.now() + delay) })
				})
				.where(eq(webhookDelivery.id, row.id));
		})
	);
}

export function deliverSoon() {
	waitUntil(
		Promise.all([deliverDue(), pruneDeliveries()]).catch((error) =>
			console.error('[webhooks] delivery failed', error)
		)
	);
}

async function pruneDeliveries() {
	const cutoff = new Date(Date.now() - RETENTION);
	await db
		.delete(webhookDelivery)
		.where(
			and(
				lt(webhookDelivery.createdAt, cutoff),
				or(isNotNull(webhookDelivery.deliveredAt), isNotNull(webhookDelivery.failedAt))
			)
		);
}

export async function resend(deliveryId: string, endpointId: string) {
	await db
		.update(webhookDelivery)
		.set({ deliveredAt: null, failedAt: null, attempts: 0, nextAttemptAt: new Date() })
		.where(and(eq(webhookDelivery.id, deliveryId), eq(webhookDelivery.endpointId, endpointId)));
	await deliverDue({ endpointId });
}

export function recentDeliveries(endpointId: string) {
	return db
		.select()
		.from(webhookDelivery)
		.where(eq(webhookDelivery.endpointId, endpointId))
		.orderBy(desc(webhookDelivery.createdAt))
		.limit(20);
}

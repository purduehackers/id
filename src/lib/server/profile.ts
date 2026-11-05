import { waitUntil } from '@vercel/functions';
import { and, asc, eq, isNull, lte, or } from 'drizzle-orm';
import {
	DISCORD_SYNC_INTERVAL_MS,
	ProfileError,
	discordHandle,
	isDiscordSyncDue,
	validateProfile,
	type ProfileInput,
	type ValidatedProfile
} from '$lib/profile';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { account, user } from '$lib/server/db/schema';
import { recordDiscordUsernameChange } from '$lib/server/webhooks';

export { ProfileError, validateProfile, type ProfileInput, type ValidatedProfile };

const GITHUB_TIMEOUT = 5_000;
const DISCORD_TIMEOUT = 5_000;
const DISCORD_SWEEP_LIMIT = 500;
const DISCORD_SWEEP_CONCURRENCY = 5;
const DISCORD_SWEEP_BUDGET = 45_000;

type HandleProvider = 'github' | 'discord';

const syncsInFlight = new Map<string, Promise<string | null>>();

function syncHandle(
	userId: string,
	provider: HandleProvider,
	fetchHandle: () => Promise<string | null>
): Promise<string | null> {
	const key = `${provider}:${userId}`;
	const running = syncsInFlight.get(key);
	if (running) return running;
	const sync = writeHandle(userId, provider, fetchHandle).finally(() => syncsInFlight.delete(key));
	syncsInFlight.set(key, sync);
	return sync;
}

async function writeHandle(
	userId: string,
	provider: HandleProvider,
	fetchHandle: () => Promise<string | null>
): Promise<string | null> {
	const handle = await fetchHandle();
	if (!handle) return null;
	const [row] = await db
		.select({ current: user[provider], linkedAccount: account.id })
		.from(user)
		.leftJoin(account, and(eq(account.userId, user.id), eq(account.providerId, provider)))
		.where(eq(user.id, userId))
		.limit(1);
	if (!row?.linkedAccount) return null;
	if (row.current === handle) return handle;
	const ctx = await auth.$context;
	await ctx.internalAdapter.updateUser(userId, { [provider]: handle });
	if (provider === 'discord') await recordDiscordUsernameChange(userId);
	return handle;
}

function runInBackground(label: string, work: Promise<unknown>) {
	waitUntil(work.catch((error) => console.error(`[profile] ${label} sync failed`, error)));
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout>;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
	});
	return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

export async function updateProfile(
	userId: string,
	input: ProfileInput
): Promise<ValidatedProfile> {
	const validated = validateProfile(input);
	const ctx = await auth.$context;
	await ctx.internalAdapter.updateUser(userId, {
		givenName: validated.givenName,
		familyName: validated.familyName,
		phone: validated.phone,
		graduationYear: validated.graduationYear
	});
	return validated;
}

export async function fetchGithubUsername(
	accountId: string,
	accessToken?: string | null
): Promise<string | null> {
	const headers: Record<string, string> = {
		accept: 'application/vnd.github+json',
		'user-agent': 'PurdueHackersID'
	};
	try {
		if (accessToken) {
			const res = await fetch('https://api.github.com/user', {
				headers: { ...headers, authorization: `Bearer ${accessToken}` },
				signal: AbortSignal.timeout(GITHUB_TIMEOUT)
			});
			if (res.ok) {
				const data = (await res.json()) as { login?: unknown };
				if (typeof data.login === 'string' && data.login) return data.login;
			}
		}
		const res = await fetch(`https://api.github.com/user/${encodeURIComponent(accountId)}`, {
			headers,
			signal: AbortSignal.timeout(GITHUB_TIMEOUT)
		});
		if (res.ok) {
			const data = (await res.json()) as { login?: unknown };
			if (typeof data.login === 'string' && data.login) return data.login;
		}
	} catch {
		// Ignore transient GitHub API errors; next sync or page load can retry.
	}
	return null;
}

export function syncGithubAccount(
	userId: string,
	accountId: string,
	accessToken?: string | null
): Promise<string | null> {
	return syncHandle(userId, 'github', () => fetchGithubUsername(accountId, accessToken));
}

export function syncGithubAccountInBackground(
	userId: string,
	accountId: string,
	accessToken?: string | null
) {
	runInBackground('GitHub', syncGithubAccount(userId, accountId, accessToken));
}

export async function ensureGithubSynced(
	userId: string,
	currentGithub?: string | null
): Promise<string | null> {
	if (currentGithub) return currentGithub;
	const [linked] = await db
		.select({ accountId: account.accountId, accessToken: account.accessToken })
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, 'github')))
		.limit(1);
	if (!linked) return null;
	return syncGithubAccount(userId, linked.accountId, linked.accessToken);
}

export async function clearGithubAccount(userId: string) {
	const ctx = await auth.$context;
	await ctx.internalAdapter.updateUser(userId, { github: null });
}

type DiscordUser = Parameters<typeof discordHandle>[0];

export async function fetchDiscordUsername(accessToken?: string | null): Promise<string | null> {
	if (!accessToken) return null;
	try {
		const res = await fetch('https://discord.com/api/v10/users/@me', {
			headers: {
				authorization: `Bearer ${accessToken}`,
				'user-agent': 'PurdueHackersID'
			},
			signal: AbortSignal.timeout(DISCORD_TIMEOUT)
		});
		if (res.ok) return discordHandle((await res.json()) as DiscordUser);
	} catch {
		// Ignore transient Discord API errors; next sync or page load can retry.
	}
	return null;
}

export function syncDiscordAccount(
	userId: string,
	accessToken?: string | null
): Promise<string | null> {
	return syncHandle(userId, 'discord', async () => {
		await db.update(user).set({ discordCheckedAt: new Date() }).where(eq(user.id, userId));
		return fetchDiscordUsername(accessToken);
	});
}

export function syncDiscordAccountInBackground(userId: string, accessToken?: string | null) {
	runInBackground('Discord', syncDiscordAccount(userId, accessToken));
}

type DiscordLink = { id: string; userId: string; accessToken: string | null };

async function refreshAndSyncDiscord(link: DiscordLink): Promise<string | null> {
	let accessToken = link.accessToken;
	try {
		const tokens = await withTimeout(
			auth.api.getAccessToken({ body: { accountId: link.id, userId: link.userId } }),
			DISCORD_TIMEOUT
		);
		accessToken = tokens.accessToken ?? accessToken;
	} catch {
		// Fall back to the stored token; a failed refresh just means no username yet.
	}
	return syncDiscordAccount(link.userId, accessToken);
}

export async function ensureDiscordSynced(userId: string): Promise<string | null> {
	const [linked] = await db
		.select({
			id: account.id,
			userId: account.userId,
			accessToken: account.accessToken,
			discord: user.discord,
			checkedAt: user.discordCheckedAt
		})
		.from(account)
		.innerJoin(user, eq(user.id, account.userId))
		.where(and(eq(account.userId, userId), eq(account.providerId, 'discord')))
		.limit(1);
	if (!linked) return null;
	if (!isDiscordSyncDue(linked.checkedAt)) return linked.discord;
	if (linked.discord) {
		runInBackground('Discord', refreshAndSyncDiscord(linked));
		return linked.discord;
	}
	try {
		return await refreshAndSyncDiscord(linked);
	} catch (error) {
		console.error('[profile] Discord sync failed', error);
		return null;
	}
}

export async function syncDueDiscordAccounts(): Promise<{ checked: number; failed: number }> {
	const deadline = Date.now() + DISCORD_SWEEP_BUDGET;
	const cutoff = new Date(Date.now() - DISCORD_SYNC_INTERVAL_MS);
	const due = await db
		.select({ id: account.id, userId: account.userId, accessToken: account.accessToken })
		.from(account)
		.innerJoin(user, eq(user.id, account.userId))
		.where(
			and(
				eq(account.providerId, 'discord'),
				or(isNull(user.discordCheckedAt), lte(user.discordCheckedAt, cutoff))
			)
		)
		.orderBy(asc(user.discordCheckedAt))
		.limit(DISCORD_SWEEP_LIMIT);

	let checked = 0;
	let failed = 0;
	const worker = async () => {
		while (Date.now() < deadline) {
			const link = due.shift();
			if (!link) return;
			checked++;
			await refreshAndSyncDiscord(link).catch((error) => {
				failed++;
				console.error('[profile] Discord sync failed', error);
			});
		}
	};
	await Promise.all(Array.from({ length: DISCORD_SWEEP_CONCURRENCY }, worker));
	return { checked, failed };
}

export async function clearDiscordAccount(userId: string) {
	const ctx = await auth.$context;
	await ctx.internalAdapter.updateUser(userId, { discord: null, discordCheckedAt: null });
}

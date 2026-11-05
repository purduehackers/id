import { waitUntil } from '@vercel/functions';
import { and, eq } from 'drizzle-orm';
import {
	ProfileError,
	discordHandle,
	validateProfile,
	type ProfileInput,
	type ValidatedProfile
} from '$lib/profile';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { account, user } from '$lib/server/db/schema';

export { ProfileError, validateProfile, type ProfileInput, type ValidatedProfile };

const GITHUB_TIMEOUT = 5_000;
const DISCORD_TIMEOUT = 5_000;

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

export async function syncGithubAccount(
	userId: string,
	accountId: string,
	accessToken?: string | null
): Promise<string | null> {
	const github = await fetchGithubUsername(accountId, accessToken);
	if (!github) return null;
	const [current] = await db
		.select({ github: user.github })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (current?.github === github) return github;
	const ctx = await auth.$context;
	await ctx.internalAdapter.updateUser(userId, { github });
	return github;
}

export function syncGithubAccountInBackground(
	userId: string,
	accountId: string,
	accessToken?: string | null
) {
	waitUntil(
		syncGithubAccount(userId, accountId, accessToken).catch((error) =>
			console.error('[profile] GitHub sync failed', error)
		)
	);
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

export async function syncDiscordAccount(
	userId: string,
	accessToken?: string | null
): Promise<string | null> {
	const discord = await fetchDiscordUsername(accessToken);
	if (!discord) return null;
	const [current] = await db
		.select({ discord: user.discord })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (current?.discord === discord) return discord;
	const ctx = await auth.$context;
	await ctx.internalAdapter.updateUser(userId, { discord });
	return discord;
}

export function syncDiscordAccountInBackground(userId: string, accessToken?: string | null) {
	waitUntil(
		syncDiscordAccount(userId, accessToken).catch((error) =>
			console.error('[profile] Discord sync failed', error)
		)
	);
}

export async function ensureDiscordSynced(
	userId: string,
	currentDiscord?: string | null
): Promise<string | null> {
	if (currentDiscord) return currentDiscord;
	const [linked] = await db
		.select({ id: account.id, accessToken: account.accessToken })
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, 'discord')))
		.limit(1);
	if (!linked) return null;
	// Discord tokens expire after a week, so refresh accounts linked before usernames were synced.
	let accessToken = linked.accessToken;
	try {
		const tokens = await auth.api.getAccessToken({ body: { accountId: linked.id, userId } });
		accessToken = tokens.accessToken ?? accessToken;
	} catch {
		// Fall back to the stored token; a failed refresh just means no username yet.
	}
	return syncDiscordAccount(userId, accessToken);
}

export async function clearDiscordAccount(userId: string) {
	const ctx = await auth.$context;
	await ctx.internalAdapter.updateUser(userId, { discord: null });
}

import { createHash, timingSafeEqual } from 'node:crypto';
import { error, json } from '@sveltejs/kit';
import type { Config } from '@sveltejs/adapter-vercel';
import { env } from '$env/dynamic/private';
import { syncDueDiscordAccounts } from '$lib/server/profile';
import type { RequestHandler } from './$types';

export const config: Config = { maxDuration: 60 };

const digest = (value: string) => createHash('sha256').update(value).digest();

export const GET: RequestHandler = async ({ request }) => {
	const provided = request.headers.get('authorization') ?? '';
	const authorized =
		!!env.CRON_SECRET && timingSafeEqual(digest(provided), digest(`Bearer ${env.CRON_SECRET}`));
	if (!authorized) error(401, 'Unauthorized');
	return json(await syncDueDiscordAccounts());
};

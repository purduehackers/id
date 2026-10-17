import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { LOGIN_COOKIE, loginState } from '$lib/server/passport';

export const GET: RequestHandler = async ({ cookies }) => {
	const login = await loginState(cookies.get(LOGIN_COOKIE));
	return json({ status: login?.status ?? 'expired' });
};

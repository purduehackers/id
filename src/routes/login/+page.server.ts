import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

function safeNext(raw: string | null | undefined): string {
	if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dash';
	return raw;
}

export const load: PageServerLoad = (event) => {
	const next = safeNext(event.url.searchParams.get('next'));
	if (event.locals.user) redirect(302, next);

	return {
		next,
		error: event.url.searchParams.has('error') ? 'Discord sign-in failed. Try again?' : null
	};
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const next = safeNext(formData.get('next')?.toString());

		let url: string | undefined;
		try {
			({ url } = await auth.api.signInSocial({
				body: { provider: 'discord', callbackURL: next, errorCallbackURL: '/login?error=1' }
			}));
		} catch (error) {
			const message = error instanceof APIError ? error.message : '';
			return fail(400, { message: message || 'Could not start Discord sign-in.' });
		}

		if (!url) return fail(500, { message: 'Discord did not return a sign-in URL.' });

		redirect(302, url);
	}
};

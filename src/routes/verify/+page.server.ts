import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

function safeNext(raw: string | null | undefined): string {
	if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dash';
	return raw;
}

export const load: PageServerLoad = (event) => {
	const email = event.url.searchParams.get('email') ?? '';
	const next = safeNext(event.url.searchParams.get('next'));

	if (!email) redirect(302, '/login');
	if (event.locals.user?.emailVerified) redirect(302, next);

	return { email, next };
};

function message(error: unknown, fallback: string) {
	return error instanceof APIError ? error.message || fallback : fallback;
}

export const actions: Actions = {
	verify: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const otp = formData.get('otp')?.toString().replace(/\s+/g, '') ?? '';
		const next = safeNext(formData.get('next')?.toString());

		try {
			// With autoSignInAfterVerification this also creates the session, and the
			// sveltekitCookies plugin carries the cookie onto our redirect.
			await auth.api.verifyEmailOTP({ body: { email, otp }, headers: event.request.headers });
		} catch (error) {
			return fail(400, { message: message(error, 'That code did not work.') });
		}

		redirect(302, next);
	},

	resend: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';

		try {
			await auth.api.sendVerificationOTP({
				body: { email, type: 'email-verification' },
				headers: event.request.headers
			});
		} catch (error) {
			return fail(400, { message: message(error, 'Could not send a new code.') });
		}

		return { notice: 'Sent a new code.' };
	}
};

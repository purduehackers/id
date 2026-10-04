import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

function safeNext(raw: string | null | undefined): string {
	if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
	return raw;
}

export const load: PageServerLoad = (event) => {
	return {
		email: event.url.searchParams.get('email') ?? '',
		next: safeNext(event.url.searchParams.get('next'))
	};
};

function message(error: unknown, fallback: string) {
	return error instanceof APIError ? error.message || fallback : fallback;
}

async function sendCode(email: string, headers: Headers) {
	await auth.api.requestPasswordResetEmailOTP({ body: { email }, headers });
}

export const actions: Actions = {
	request: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString().trim() ?? '';
		const next = safeNext(formData.get('next')?.toString());

		if (!email) return fail(400, { message: 'Tell us your email.' });

		try {
			await sendCode(email, event.request.headers);
		} catch (error) {
			return fail(400, { message: message(error, 'Could not send a code.') });
		}

		redirect(303, `/forgot?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
	},

	resend: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';

		try {
			await sendCode(email, event.request.headers);
		} catch (error) {
			return fail(400, { message: message(error, 'Could not send a new code.') });
		}

		return { notice: 'Sent a new code.' };
	},

	reset: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const otp = formData.get('otp')?.toString().replace(/\s+/g, '') ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const next = safeNext(formData.get('next')?.toString());

		try {
			await auth.api.resetPasswordEmailOTP({
				body: { email, otp, password },
				headers: event.request.headers
			});
		} catch (error) {
			return fail(400, { message: message(error, 'Could not reset your password.') });
		}

		try {
			await auth.api.signInEmail({ body: { email, password }, headers: event.request.headers });
		} catch {
			redirect(303, `/login?next=${encodeURIComponent(next)}`);
		}

		redirect(303, next);
	}
};

import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { requireUser } from '$lib/server/guard';
import { APIError } from 'better-auth/api';
import { passportsOf } from '$lib/server/passport';
import {
	EmailError,
	addEmail,
	emailsOf,
	makePrimary,
	removeEmail,
	resendCode,
	verifyEmail
} from '$lib/server/emails';

const PROVIDERS = [
	{ id: 'discord', label: 'Discord' },
	{ id: 'github', label: 'GitHub' }
] as const;

type Provider = (typeof PROVIDERS)[number]['id'];

const EXPIRED = 'That linking attempt expired or was interrupted. Please try again.';
const LINK_ERRORS: Record<string, string> = {
	state_mismatch: EXPIRED,
	state_not_found: EXPIRED,
	state_invalid: EXPIRED,
	account_already_linked_to_different_user:
		'That account is already attached to a different Purdue Hackers ID.',
	signup_disabled: 'That account is not attached to any ID yet.'
};

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);

	const linked = event.url.searchParams.get('linked');
	const errorCode = event.url.searchParams.get('error');
	const accounts = await auth.api.listUserAccounts({ headers: event.request.headers });

	const emails = await emailsOf(user.id);
	const passports = (await passportsOf(user.id)).filter((p) => p.activated);
	const ids = passports.map((p) => p.id);
	const passportNotice =
		linked !== 'discord' || ids.length === 0
			? ''
			: ids.length === 1
				? ` Passport ${ids[0]} is yours again.`
				: ` Passports ${ids.slice(0, -1).join(', ')} and ${ids.at(-1)} are yours again.`;

	return {
		notice: linked ? `${linked} connected.${passportNotice}` : null,
		passports: ids,
		emails,
		error: errorCode ? (LINK_ERRORS[errorCode] ?? `Linking failed (${errorCode}).`) : null,
		connections: PROVIDERS.map((provider) => {
			const account = accounts.find((a) => a.providerId === provider.id);
			return {
				id: provider.id,
				label: provider.label,
				accountId: account?.id ?? null,
				connectedAt: account?.createdAt ?? null
			};
		})
	};
};

function messageFrom(error: unknown, fallback: string) {
	return error instanceof APIError ? error.message || fallback : fallback;
}

async function emailAction(
	event: RequestEvent,
	run: (user: NonNullable<App.Locals['user']>, id: string, formData: FormData) => Promise<string>
) {
	const user = requireUser(event);
	const formData = await event.request.formData();
	const id = formData.get('id')?.toString();
	if (!id) return fail(400, { message: 'Nothing to change.' });
	try {
		return { notice: await run(user, id, formData) };
	} catch (error) {
		if (error instanceof EmailError) return fail(400, { message: error.message });
		throw error;
	}
}

export const actions: Actions = {
	link: async (event) => {
		requireUser(event);
		const formData = await event.request.formData();
		const provider = formData.get('provider')?.toString();

		if (!PROVIDERS.some((p) => p.id === provider)) {
			return fail(400, { message: 'Unknown provider.' });
		}

		let url: string | undefined;
		try {
			({ url } = await auth.api.linkSocialAccount({
				body: {
					provider: provider as Provider,
					callbackURL: `/?linked=${provider}`,
					errorCallbackURL: '/'
				},
				headers: event.request.headers
			}));
		} catch (error) {
			return fail(400, { message: messageFrom(error, `Could not start ${provider} linking.`) });
		}

		if (!url) return fail(500, { message: 'No authorization URL came back.' });

		redirect(302, url);
	},

	unlink: async (event) => {
		requireUser(event);
		const formData = await event.request.formData();
		const accountId = formData.get('accountId')?.toString();
		if (!accountId) return fail(400, { message: 'Nothing to disconnect.' });

		try {
			await auth.api.unlinkAccount({
				body: { accountId },
				headers: event.request.headers
			});
		} catch (error) {
			const message = messageFrom(error, 'Could not disconnect that account.');
			return fail(400, {
				message: /fresh|expired/i.test(message)
					? 'For this one you need to sign in again first.'
					: message
			});
		}

		return { message: 'Disconnected.' };
	},

	addEmail: async (event) => {
		const user = requireUser(event);
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		try {
			const added = await addEmail(user, email);
			return { notice: `Sent a code to ${added}. It is good for ten minutes.` };
		} catch (error) {
			if (error instanceof EmailError) return fail(400, { email, message: error.message });
			throw error;
		}
	},

	verifyEmail: (event) =>
		emailAction(event, async (user, id, formData) => {
			const email = await verifyEmail(user.id, id, formData.get('otp')?.toString() ?? '');
			return `${email} verified.`;
		}),

	resendEmail: (event) =>
		emailAction(event, async (user, id) => `Sent a new code to ${await resendCode(user.id, id)}.`),

	removeEmail: (event) =>
		emailAction(event, async (user, id) => `Removed ${await removeEmail(user.id, id)}.`),

	makePrimary: (event) =>
		emailAction(
			event,
			async (user, id) => `${await makePrimary(user, id)} is now your primary email.`
		),

	signOut: async (event) => {
		await auth.api.signOut({ headers: event.request.headers });
		redirect(302, '/login');
	}
};

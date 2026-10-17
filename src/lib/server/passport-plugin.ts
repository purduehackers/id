import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';

const body = {
	'~standard': {
		version: 1,
		vendor: 'purdue-hackers-id',
		types: undefined as unknown as { input: { userId: string }; output: { userId: string } },
		validate: (value: unknown) =>
			typeof (value as { userId?: unknown })?.userId === 'string'
				? { value: { userId: (value as { userId: string }).userId } }
				: { issues: [{ message: 'userId is required' }] }
	}
} as const;

export const passportSignIn = () =>
	({
		id: 'passport-sign-in',
		endpoints: {
			signInWithPassport: createAuthEndpoint.serverOnly({ method: 'POST', body }, async (ctx) => {
				const user = await ctx.context.internalAdapter.findUserById(ctx.body.userId);
				if (!user) throw new APIError('NOT_FOUND');

				const session = await ctx.context.internalAdapter.createSession(user.id);
				await setSessionCookie(ctx, { session, user });
				return ctx.json({ ok: true });
			})
		}
	}) satisfies BetterAuthPlugin;

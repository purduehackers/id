import { createAuthEndpoint, dispatchAuthEndpoint } from 'better-auth/api';
import { z } from 'zod';
import { auth } from '$lib/server/auth';

type Endpoint = Parameters<typeof dispatchAuthEndpoint>[0];
type DispatchContext = Parameters<typeof dispatchAuthEndpoint>[1]['context'];
type Input = { body?: unknown; query?: unknown };

export type ClientEndpoint =
	| 'getOAuthClients'
	| 'getOAuthClient'
	| 'createOAuthClient'
	| 'updateOAuthClient'
	| 'rotateClientSecret'
	| 'deleteOAuthClient';

const deleteSession = createAuthEndpoint(
	{ method: 'POST', body: z.object({ token: z.string() }) },
	async (ctx) => {
		await ctx.context.internalAdapter.deleteSession(ctx.body.token);
		return ctx.json({ status: true });
	}
);

export function asMember(userId: string) {
	let member: Promise<DispatchContext['session']> | undefined;

	const sessionOf = async () => {
		const ctx = await auth.$context;
		const user = await ctx.internalAdapter.findUserById(userId);
		if (!user) throw new Error('User not found.');
		const now = new Date();
		return {
			session: {
				id: `mcp:${userId}`,
				userId,
				token: '',
				expiresAt: now,
				createdAt: now,
				updatedAt: now
			},
			user
		} as DispatchContext['session'];
	};

	const run = async <T>(endpoint: Endpoint, input: Input) => {
		const ctx = await auth.$context;
		member ??= sessionOf();
		return (await dispatchAuthEndpoint(endpoint, {
			...input,
			headers: new Headers(),
			context: { ...ctx, session: await member } as DispatchContext
		})) as T;
	};

	return {
		async client<T>(name: ClientEndpoint, input: Input) {
			const ctx = await auth.$context;
			const plugin = ctx.options.plugins?.find((p) => p.id === 'oauth-provider');
			const endpoint = (plugin?.endpoints as Record<string, Endpoint> | undefined)?.[name];
			if (!endpoint) throw new Error(`Cannot run ${name}.`);
			return run<T>(endpoint, input);
		},

		signOut(token: string) {
			return run(deleteSession as unknown as Endpoint, { body: { token } });
		}
	};
}

export type Member = ReturnType<typeof asMember>;

import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { jwt } from 'better-auth/plugins/jwt';
import { oauthProvider } from '@better-auth/oauth-provider';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { SCOPES } from '$lib/server/scopes';

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),

	emailAndPassword: {
		enabled: true,
		minPasswordLength: 10,
		// todo: turn on once we have an email sender
		requireEmailVerification: false
	},

	socialProviders: {
		discord: {
			clientId: env.DISCORD_CLIENT_ID,
			clientSecret: env.DISCORD_CLIENT_SECRET,
			disableSignUp: true,
			scope: ['identify', 'email', 'guilds.members.read']
		},
		github: {
			clientId: env.GITHUB_CLIENT_ID,
			clientSecret: env.GITHUB_CLIENT_SECRET,
			disableSignUp: true
		}
	},

	account: {
		accountLinking: {
			enabled: true,
			disableImplicitLinking: true,
			allowDifferentEmails: true,
			allowUnlinkingAll: false
		}
	},

	advanced: {
		database: {
			generateId: 'uuid'
		}
	},

	plugins: [
		jwt(),
		oauthProvider({
			loginPage: '/login',
			consentPage: '/oauth2/consent',
			scopes: SCOPES,
			allowDynamicClientRegistration: true,
			allowUnauthenticatedClientRegistration: false,
			clientRegistrationRequirePKCE: true,
			clientRegistrationDefaultScopes: ['openid', 'profile', 'email', 'user:read'],
			clientRegistrationAllowedScopes: ['openid', 'profile', 'email', 'user:read', 'user'],
			accessTokenExpiresIn: 60 * 60,
			refreshTokenExpiresIn: 60 * 60 * 24 * 30,
			prefix: {
				opaqueAccessToken: 'phid_at_',
				refreshToken: 'phid_rt_',
				clientSecret: 'phid_cs_'
			}
		}),
		sveltekitCookies(getRequestEvent)
	]
});

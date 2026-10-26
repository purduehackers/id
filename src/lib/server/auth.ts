import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { jwt } from 'better-auth/plugins/jwt';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { username } from 'better-auth/plugins/username';
import { admin } from 'better-auth/plugins/admin';
import { createAccessControl } from 'better-auth/plugins/access';
import { oauthDeviceAuthorization, oauthProvider } from '@better-auth/oauth-provider';
import { getRequestEvent } from '$app/server';
import { dev } from '$app/environment';
import { db } from '$lib/server/db';
import { uuidv7 } from '$lib/server/uuid';
import { DIRECTORY_RESOURCE, DIRECTORY_SCOPES, SCOPES, isDirectoryScope } from '$lib/server/scopes';
import { emailConfigured, sendEmail } from '$lib/server/email';
import {
	USERNAME_MAX_LENGTH,
	USERNAME_MIN_LENGTH,
	USERNAME_PATTERN,
	normalizeUsername
} from '$lib/username';
import { accessTokenClaims, identityClaims } from '$lib/server/claims';
import { recordDiscordLink, recordProfileUpdate } from '$lib/server/webhooks';
import { passportSignIn } from '$lib/server/passport-plugin';
import { recoverByDiscord } from '$lib/server/passport';

const devFixedOtp = dev && !emailConfigured() && env.DEV_FIXED_OTP ? env.DEV_FIXED_OTP : null;
if (devFixedOtp) {
	console.warn(`[auth] DEV_FIXED_OTP is set: every verification code is "${devFixedOtp}"`);
}

const lockedAc = createAccessControl({ user: [], session: [] });
const noPermissions = lockedAc.newRole({ user: [], session: [] });
const ADMIN_PLUGIN_PATHS = [
	'set-role',
	'get-user',
	'create-user',
	'update-user',
	'list-users',
	'list-user-sessions',
	'ban-user',
	'unban-user',
	'impersonate-user',
	'stop-impersonating',
	'revoke-user-session',
	'revoke-user-sessions',
	'remove-user',
	'set-user-password',
	'has-permission'
].map((path) => `/admin/${path}`);

export const auth = betterAuth({
	baseURL: env.ORIGIN ?? {
		allowedHosts: ['id.purduehackers.com', '*.vercel.app']
	},
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'sqlite' }),

	emailAndPassword: {
		enabled: true,
		minPasswordLength: 10,
		requireEmailVerification: true,
		revokeSessionsOnPasswordReset: true
	},

	emailVerification: {
		sendOnSignIn: true,
		autoSignInAfterVerification: true
	},

	socialProviders: {
		discord: {
			clientId: env.DISCORD_CLIENT_ID!,
			clientSecret: env.DISCORD_CLIENT_SECRET,
			disableSignUp: true,
			scope: ['identify', 'email', 'guilds.members.read']
		},
		github: {
			clientId: env.GITHUB_CLIENT_ID!,
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
			generateId: () => uuidv7()
		}
	},

	disabledPaths: ADMIN_PLUGIN_PATHS,

	hooks: {
		before: createAuthMiddleware(async (ctx) => {
			const unique = (scope: unknown) =>
				typeof scope === 'string'
					? [...new Set(scope.split(/\s+/).filter(Boolean))].join(' ')
					: scope;
			if (ctx.path === '/oauth2/authorize' && ctx.query?.scope) {
				return { context: { query: { ...ctx.query, scope: unique(ctx.query.scope) } } };
			}
			if ((ctx.path === '/oauth2/token' || ctx.path === '/device/code') && ctx.body?.scope) {
				return { context: { body: { ...ctx.body, scope: unique(ctx.body.scope) } } };
			}

			if (
				!['/oauth2/create-client', '/oauth2/update-client', '/oauth2/register'].includes(ctx.path)
			) {
				return;
			}
			const scope = String(ctx.body?.update?.scope ?? ctx.body?.scope ?? '');
			if (scope.split(/\s+/).some(isDirectoryScope)) {
				throw new APIError('BAD_REQUEST', {
					error: 'invalid_scope',
					error_description: 'Directory scopes are granted by admins.'
				});
			}
		})
	},

	databaseHooks: {
		user: {
			create: {
				before: async (data) => ({ data: { ...data, role: null } })
			},
			update: {
				after: (updated) => recordProfileUpdate(updated)
			}
		},
		account: {
			create: {
				async after(account) {
					if (account.providerId === 'discord') {
						await recoverByDiscord(account.userId, account.accountId);
						await recordDiscordLink(account.userId, account.accountId, true);
					}
				}
			},
			delete: {
				async after(account) {
					if (account.providerId === 'discord') {
						await recordDiscordLink(account.userId, account.accountId, false);
					}
				}
			}
		}
	},

	plugins: [
		admin({
			ac: lockedAc,
			roles: { alumni: noPermissions, organizer: noPermissions, admin: noPermissions },
			adminRoles: ['admin'],
			bannedUserMessage:
				'This Purdue Hackers ID has been suspended. Reach out to an organizer if you think this is a mistake.'
		}),
		username({
			minUsernameLength: USERNAME_MIN_LENGTH,
			maxUsernameLength: USERNAME_MAX_LENGTH,
			usernameNormalization: normalizeUsername,
			usernameValidator: (value) => USERNAME_PATTERN.test(value),
			validationOrder: { username: 'post-normalization' },
			displayUsername: false
		}),
		emailOTP({
			overrideDefaultEmailVerification: true,
			otpLength: 6,
			expiresIn: 60 * 10,
			allowedAttempts: 5,
			storeOTP: 'hashed',
			generateOTP: () => devFixedOtp ?? '',
			async sendVerificationOTP({ email, otp, type }) {
				if (type === 'email-verification') {
					await sendEmail({
						to: email,
						subject: `${otp} is your Purdue Hackers ID code`,
						text: [
							`Your verification code is ${otp}.`,
							'',
							'It expires in ten minutes. If you did not create a Purdue Hackers ID, you can ignore this email.'
						].join('\n')
					});
				} else if (type === 'forget-password') {
					await sendEmail({
						to: email,
						subject: `${otp} is your Purdue Hackers ID password reset code`,
						text: [
							`Your password reset code is ${otp}.`,
							'',
							'It expires in ten minutes. If you did not ask to reset your password, you can ignore this email.'
						].join('\n')
					});
				}
			}
		}),
		jwt(),
		passportSignIn(),
		oauthProvider({
			loginPage: '/login',
			consentPage: '/oauth2/consent',
			scopes: SCOPES,
			allowDynamicClientRegistration: true,
			allowUnauthenticatedClientRegistration: false,
			clientRegistrationRequirePKCE: true,
			clientRegistrationDefaultScopes: ['openid', 'profile', 'email', 'user:read'],
			clientRegistrationAllowedScopes: ['openid', 'profile', 'email', 'roles', 'user:read', 'user'],
			customUserInfoClaims: identityClaims,
			customIdTokenClaims: identityClaims,
			customAccessTokenClaims: accessTokenClaims,
			resources: [
				{
					identifier: DIRECTORY_RESOURCE,
					name: 'Purdue Hackers directory',
					allowedScopes: DIRECTORY_SCOPES,
					accessTokenTtl: 60 * 5
				}
			],
			clientPrivileges: ({ action, user }) =>
				action !== 'configure-client-credentials-scopes' || user?.role === 'admin',
			accessTokenExpiresIn: 60 * 60,
			refreshTokenExpiresIn: 60 * 60 * 24 * 30,
			prefix: {
				opaqueAccessToken: 'phid_at_',
				refreshToken: 'phid_rt_',
				clientSecret: 'phid_cs_'
			}
		}),
		oauthDeviceAuthorization({
			verificationUri: '/device',
			expiresIn: '10m',
			interval: '5s'
		}),
		sveltekitCookies(getRequestEvent)
	]
});

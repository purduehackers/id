import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { jwt } from 'better-auth/plugins/jwt';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { username } from 'better-auth/plugins/username';
import { admin } from 'better-auth/plugins/admin';
import { createAccessControl } from 'better-auth/plugins/access';
import { oauthDeviceAuthorization, oauthProvider } from '@better-auth/oauth-provider';
import { getAuthenticatorName, passkey } from '@better-auth/passkey';
import { cimd } from '@better-auth/cimd';
import { fetchClientMetadataResource } from '@better-auth/cimd/node';
import { getRequestEvent } from '$app/server';
import { dev } from '$app/environment';
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { oauthClient, oauthClientResource, userEmail } from '$lib/server/db/schema';
import { uuidv7 } from '$lib/server/uuid';
import {
	DIRECTORY_RESOURCE,
	DIRECTORY_SCOPES,
	MCP_SCOPES,
	SCOPES,
	isDirectoryScope
} from '$lib/server/scopes';
import { MCP_RESOURCE, configuredOrigin } from '$lib/server/origin';
import { emailConfigured, sendEmail } from '$lib/server/email';
import {
	USERNAME_MAX_LENGTH,
	USERNAME_MIN_LENGTH,
	USERNAME_PATTERN,
	normalizeUsername
} from '$lib/username';
import { accessTokenClaims, identityClaims, userInfoClaims } from '$lib/server/claims';
import { recordDiscordLink, recordGitHubLink, recordProfileUpdate } from '$lib/server/webhooks';
import { passportSignIn } from '$lib/server/passport-plugin';
import { recoverByDiscord } from '$lib/server/passport';
import { PART_NAME_MAX_LENGTH, normalizeNamePart, splitNameParts } from '$lib/profile';
import { isDevicePollFrom } from '$lib/server/rate-limit';
import { hasRole } from '$lib/roles';
import { describeUserAgent } from '$lib/server/user-agent';
import {
	alertConsent,
	alertDeviceApproval,
	alertNewPlace,
	rememberConsents
} from '$lib/server/security-emails';

export const devFixedOtp =
	dev && !emailConfigured() && env.DEV_FIXED_OTP ? env.DEV_FIXED_OTP : null;
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

function requestClientId(ctx: {
	query?: Record<string, unknown>;
	body?: Record<string, unknown>;
	headers?: Headers;
}) {
	const id = ctx.query?.client_id ?? ctx.body?.client_id;
	if (typeof id === 'string') return id;
	const basic = ctx.headers?.get('authorization')?.match(/^Basic\s+(.+)$/i)?.[1];
	if (!basic) return null;
	try {
		return decodeURIComponent(atob(basic).split(':')[0]);
	} catch {
		return null;
	}
}

async function linkMcpResources(clientId: string | null, resource: unknown) {
	if (!clientId || !MCP_RESOURCE || ![resource].flat().includes(MCP_RESOURCE)) return;
	const [client] = await db
		.select({ clientId: oauthClient.clientId })
		.from(oauthClient)
		.where(eq(oauthClient.clientId, clientId))
		.limit(1);
	if (!client) return;
	await db
		.insert(oauthClientResource)
		.values({ id: uuidv7(), clientId, resourceId: MCP_RESOURCE, createdAt: new Date() })
		.onConflictDoNothing();
}

const passkeyOrigin = configuredOrigin ?? 'http://localhost:5173';

export const auth = betterAuth({
	baseURL: configuredOrigin ?? { allowedHosts: ['*.vercel.app'] },
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

	user: {
		additionalFields: {
			securityEmails: { type: 'boolean', defaultValue: true, input: false },
			givenName: { type: 'string', required: false, input: true },
			familyName: { type: 'string', required: false, input: true },
			phone: { type: 'string', required: false, input: false },
			graduationTerm: { type: 'number', required: false, input: false }
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

	disabledPaths: ['/update-user', ...ADMIN_PLUGIN_PATHS],

	rateLimit: {
		customRules: {
			'/oauth2/token': async (request, current) =>
				env.PHACK_SH_CLIENT_ID && (await isDevicePollFrom(request, env.PHACK_SH_CLIENT_ID))
					? false
					: current
		}
	},

	hooks: {
		before: createAuthMiddleware(async (ctx) => {
			if (ctx.path === '/oauth2/consent') {
				const userId = (await getSessionFromCtx(ctx))?.user.id;
				if (userId && ctx.body?.accept === true) await rememberConsents(userId);
				return;
			}

			if (ctx.path === '/oauth2/authorize') {
				await linkMcpResources(requestClientId(ctx), ctx.query?.resource);
			} else if (
				ctx.path === '/device/code' ||
				(ctx.path === '/oauth2/token' && ctx.body?.grant_type !== 'client_credentials')
			) {
				await linkMcpResources(requestClientId(ctx), ctx.body?.resource);
			}

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
		}),
		after: createAuthMiddleware(async (ctx) => {
			if (ctx.path !== '/oauth2/consent' && ctx.path !== '/device/approve') return;
			const userId = (await getSessionFromCtx(ctx))?.user.id;
			if (!userId) return;

			if (ctx.path === '/oauth2/consent') {
				if (ctx.body?.accept === true) alertConsent(userId);
			} else if (!(ctx.context.returned instanceof Error)) {
				alertDeviceApproval(userId, String(ctx.body?.userCode));
			}
		})
	},

	databaseHooks: {
		session: {
			create: {
				after: async (session) => alertNewPlace(session.userId)
			}
		},
		user: {
			create: {
				async before(data) {
					const [taken] = await db
						.select({ id: userEmail.id })
						.from(userEmail)
						.where(
							and(eq(userEmail.email, data.email.toLowerCase()), isNotNull(userEmail.verifiedAt))
						)
						.limit(1);
					if (taken) {
						throw new APIError('UNPROCESSABLE_ENTITY', {
							message: 'That email already belongs to a Purdue Hackers ID.'
						});
					}
					const parts = data as { givenName?: string | null; familyName?: string | null };
					const guess = parts.givenName == null ? splitNameParts(data.name) : null;
					const givenName = normalizeNamePart(parts.givenName ?? guess?.firstName ?? '');
					const familyName = normalizeNamePart(parts.familyName ?? guess?.lastName ?? '');
					if (!givenName) {
						throw new APIError('BAD_REQUEST', { message: 'Tell us your first name.' });
					}
					if (!familyName) {
						throw new APIError('BAD_REQUEST', { message: 'Tell us your last name.' });
					}
					if (givenName.length > PART_NAME_MAX_LENGTH || familyName.length > PART_NAME_MAX_LENGTH) {
						throw new APIError('BAD_REQUEST', {
							message: `Keep each name under ${PART_NAME_MAX_LENGTH} characters.`
						});
					}
					return {
						data: { ...data, givenName, familyName, role: null }
					};
				}
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
					} else if (account.providerId === 'github') {
						await recordGitHubLink(account.userId, account, true);
					}
				}
			},
			delete: {
				async after(account) {
					if (account.providerId === 'discord') {
						await recordDiscordLink(account.userId, account.accountId, false);
					} else if (account.providerId === 'github') {
						await recordGitHubLink(account.userId, account, false);
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
		passkey({
			rpID: new URL(passkeyOrigin).hostname,
			rpName: 'Purdue Hackers ID',
			origin: passkeyOrigin,
			authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
			registration: {
				afterVerification: ({ ctx, verification }) => ({
					name:
						getAuthenticatorName(verification.registrationInfo?.aaguid) ??
						describeUserAgent(ctx.headers?.get('user-agent'))
				})
			}
		}),
		oauthProvider({
			loginPage: '/login',
			consentPage: '/oauth2/consent',
			scopes: SCOPES,
			allowDynamicClientRegistration: true,
			allowUnauthenticatedClientRegistration: false,
			clientRegistrationRequirePKCE: true,
			clientRegistrationDefaultScopes: ['openid', 'profile', 'email', 'user:read'],
			clientRegistrationAllowedScopes: [
				'openid',
				'profile',
				'email',
				'phone',
				'offline_access',
				'roles',
				'user:read',
				'user',
				'apps',
				'admin'
			],
			customUserInfoClaims: userInfoClaims,
			customIdTokenClaims: identityClaims,
			customAccessTokenClaims: accessTokenClaims,
			resources: [
				{
					identifier: DIRECTORY_RESOURCE,
					name: 'Purdue Hackers directory',
					allowedScopes: DIRECTORY_SCOPES,
					accessTokenTtl: 60 * 5
				},
				...(MCP_RESOURCE
					? [{ identifier: MCP_RESOURCE, name: 'Purdue Hackers ID MCP', allowedScopes: MCP_SCOPES }]
					: [])
			],
			clientRegistrationDefaultResources: MCP_RESOURCE ? [MCP_RESOURCE] : [],
			clientPrivileges: ({ action, user }) =>
				action !== 'configure-client-credentials-scopes' ||
				hasRole(user?.role as string | undefined, 'admin'),
			accessTokenExpiresIn: 60 * 60,
			refreshTokenExpiresIn: 60 * 60 * 24 * 30,
			prefix: {
				opaqueAccessToken: 'phid_at_',
				refreshToken: 'phid_rt_',
				clientSecret: 'phid_cs_'
			}
		}),
		cimd({ fetchClientMetadataResource }),
		oauthDeviceAuthorization({
			verificationUri: '/device',
			expiresIn: '10m',
			interval: '5s'
		}),
		sveltekitCookies(getRequestEvent)
	]
});

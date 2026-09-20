// import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { jwt } from 'better-auth/plugins/jwt';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { oauthProvider } from '@better-auth/oauth-provider';
import { getRequestEvent } from '$app/server';
import { dev } from '$app/environment';
import { db } from '$lib/server/db';
import { SCOPES } from '$lib/server/scopes';
import { sendEmail } from '$lib/server/email';

const devFixedOtp = dev && !env.RESEND_API_KEY && env.DEV_FIXED_OTP ? env.DEV_FIXED_OTP : null;
if (devFixedOtp) {
	console.warn(`[auth] DEV_FIXED_OTP is set: every verification code is "${devFixedOtp}"`);
}

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),

	emailAndPassword: {
		enabled: true,
		minPasswordLength: 10,
		requireEmailVerification: true
	},

	emailVerification: {
		sendOnSignIn: true,
		autoSignInAfterVerification: true
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
		emailOTP({
			overrideDefaultEmailVerification: true,
			otpLength: 6,
			expiresIn: 60 * 10,
			allowedAttempts: 5,
			storeOTP: 'hashed',
			generateOTP: () => devFixedOtp ?? '',
			async sendVerificationOTP({ email, otp, type }) {
				if (type !== 'email-verification') return;
				await sendEmail({
					to: email,
					subject: `${otp} is your Purdue Hackers ID code`,
					text: [
						`Your verification code is ${otp}.`,
						'',
						'It expires in ten minutes. If you did not create a Purdue Hackers ID,',
						'you can ignore this email.'
					].join('\n')
				});
			}
		}),
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

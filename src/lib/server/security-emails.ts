import { and, eq } from 'drizzle-orm';
import { geolocation, waitUntil } from '@vercel/functions';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { readList } from '$lib/server/db/json';
import {
	deviceCode,
	loginPlace,
	oauthAccessToken,
	oauthClient,
	oauthConsent,
	oauthRefreshToken,
	user
} from '$lib/server/db/schema';
import { sendEmail } from '$lib/server/email';
import { SCOPE_DESCRIPTIONS } from '$lib/server/scopes';
import { describeUserAgent } from '$lib/server/user-agent';

const site = () => env.ORIGIN || 'https://id.purduehackers.com';

function inBackground(task: () => Promise<void>) {
	waitUntil(task().catch((error) => console.error('[security-emails] failed', error)));
}

function placeOf(request: Request) {
	const { city, countryRegion, country } = geolocation(request);
	return country ? [city, countryRegion, country].filter(Boolean).join(', ') : null;
}

function requestDetails() {
	const { request, getClientAddress } = getRequestEvent();
	return [
		`Device: ${describeUserAgent(request.headers.get('user-agent'))}`,
		`IP address: ${getClientAddress()}`,
		`Time: ${new Date().toUTCString()}`
	];
}

async function emailOwner(userId: string, subject: string, body: string[]) {
	const [owner] = await db
		.select({ email: user.email, securityEmails: user.securityEmails })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (!owner?.securityEmails) return;

	const text = [
		...body,
		'',
		`To stop these emails, turn off security emails on your account: ${site()}/`
	].join('\n');
	await sendEmail({ to: owner.email, subject, text });
}

export function alertNewPlace(userId: string) {
	inBackground(async () => {
		const place = placeOf(getRequestEvent().request);
		if (!place) return;
		const details = requestDetails();

		const [seen] = await db
			.select({ place: loginPlace.place })
			.from(loginPlace)
			.where(eq(loginPlace.userId, userId))
			.limit(1);
		const [added] = await db
			.insert(loginPlace)
			.values({ userId, place })
			.onConflictDoNothing()
			.returning({ place: loginPlace.place });

		if (!added || !seen) return;

		await emailOwner(userId, 'New sign-in to your Purdue Hackers ID', [
			'Your Purdue Hackers ID just signed in from a new place.',
			'',
			`Place: ${place} (approximate)`,
			...details,
			'',
			'If this was you, there is nothing to do.',
			`If it was not, sign that device out at ${site()}/sessions and reset your password.`
		]);
	});
}

async function emailAppAccess(
	userId: string,
	app: { clientId: string; scopes: string[]; isNew: boolean }
) {
	const [client] = await db
		.select({ name: oauthClient.name })
		.from(oauthClient)
		.where(eq(oauthClient.clientId, app.clientId))
		.limit(1);
	const name = (client?.name ?? app.clientId).replace(/\s+/g, ' ').slice(0, 80);
	const access = app.scopes.map((scope) => `- ${SCOPE_DESCRIPTIONS[scope] ?? scope}`);

	await emailOwner(
		userId,
		app.isNew
			? 'New app authorized on your Purdue Hackers ID'
			: 'An app has more access to your Purdue Hackers ID',
		[
			app.isNew
				? 'An app was just given access to your Purdue Hackers ID.'
				: 'An app you authorized was just given more access to your Purdue Hackers ID.',
			'',
			`App: "${name}"`,
			...requestDetails(),
			...(access.length ? ['', app.isNew ? 'It can:' : 'It can now also:', ...access] : []),
			'',
			'If this was you, there is nothing to do.',
			`If it was not, revoke it at ${site()}/authorized and reset your password.`
		]
	);
}

const consentsBefore = new WeakMap<object, Map<string, string[]>>();

export async function rememberConsents(userId: string) {
	try {
		const rows = await db
			.select({ id: oauthConsent.id, scopes: oauthConsent.scopes })
			.from(oauthConsent)
			.where(eq(oauthConsent.userId, userId));
		consentsBefore.set(
			getRequestEvent(),
			new Map(rows.map((row) => [row.id, readList(row.scopes)]))
		);
	} catch (error) {
		console.error('[security-emails] failed', error);
	}
}

export function alertConsent(userId: string) {
	inBackground(async () => {
		const before = consentsBefore.get(getRequestEvent());
		if (!before) return;

		const consents = await db
			.select({ id: oauthConsent.id, clientId: oauthConsent.clientId, scopes: oauthConsent.scopes })
			.from(oauthConsent)
			.where(eq(oauthConsent.userId, userId));

		for (const consent of consents) {
			const granted = readList(consent.scopes);
			const previous = before.get(consent.id);
			const added = previous ? granted.filter((scope) => !previous.includes(scope)) : granted;
			if (previous && !added.length) continue;

			await emailAppAccess(userId, {
				clientId: consent.clientId,
				scopes: added,
				isNew: !previous
			});
		}
	});
}

export function alertDeviceApproval(userId: string, userCode: string) {
	inBackground(async () => {
		const [approved] = await db
			.select({ clientId: deviceCode.clientId, scope: deviceCode.scope })
			.from(deviceCode)
			.where(
				and(
					eq(deviceCode.userCode, userCode.replaceAll('-', '')),
					eq(deviceCode.userId, userId),
					eq(deviceCode.status, 'approved')
				)
			)
			.limit(1);
		if (!approved?.clientId) return;

		const mine = and(
			eq(oauthAccessToken.userId, userId),
			eq(oauthAccessToken.clientId, approved.clientId)
		);
		const mineRefresh = and(
			eq(oauthRefreshToken.userId, userId),
			eq(oauthRefreshToken.clientId, approved.clientId)
		);
		const tokens = [
			...(await db.select({ scopes: oauthAccessToken.scopes }).from(oauthAccessToken).where(mine)),
			...(await db
				.select({ scopes: oauthRefreshToken.scopes })
				.from(oauthRefreshToken)
				.where(mineRefresh))
		];

		const previous = new Set(tokens.flatMap((token) => readList(token.scopes)));
		const requested = (approved.scope ?? '').split(/\s+/).filter(Boolean);
		const added = requested.filter((scope) => !previous.has(scope));
		if (tokens.length && !added.length) return;

		await emailAppAccess(userId, {
			clientId: approved.clientId,
			scopes: added,
			isNew: !tokens.length
		});
	});
}

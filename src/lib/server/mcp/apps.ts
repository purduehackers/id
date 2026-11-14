import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
	AppError,
	clientErrorMessage,
	describeClient,
	ownApp,
	registrationBody,
	removeWebhook,
	rotateWebhookSecret,
	saveWebhook,
	testWebhook,
	updateBody,
	type Client,
	type OwnedApp
} from '$lib/server/apps';
import { DirectoryError, requestAccess } from '$lib/server/directory';
import { DIRECTORY_SCOPES, MEMBER_CLIENT_SCOPES } from '$lib/server/scopes';
import type { WebhookEvent } from '$lib/server/webhook-policy';
import { WEBHOOK_EVENTS, availableEvents, recentDeliveries, resend } from '$lib/server/webhooks';
import { fail, ok, type Caller } from './result';

const APP_ID = z.string().describe('The client ID of the application. Get it from list_my_apps.');
const EVENTS = Object.keys(WEBHOOK_EVENTS) as [WebhookEvent, ...WebhookEvent[]];

export function registerAppTools(server: McpServer, caller: Caller) {
	if (!caller.scopes.has('apps')) return;

	const withApp = async (appId: string, run: (app: OwnedApp) => Promise<ReturnType<typeof ok>>) => {
		const app = await ownApp(caller.userId, appId);
		if (!app) return fail('You do not own an application with that client ID.');
		try {
			return await run(app);
		} catch (error) {
			if (error instanceof AppError || error instanceof DirectoryError) {
				return fail(error.message);
			}
			throw error;
		}
	};

	server.registerTool(
		'list_my_apps',
		{
			title: 'List my applications',
			description: 'List the OAuth applications that the member made.',
			annotations: { readOnlyHint: true, openWorldHint: false }
		},
		async () => {
			const clients = await caller.member.client<Client[]>('getOAuthClients', {});
			return ok(clients.map(describeClient));
		}
	);

	server.registerTool(
		'get_app',
		{
			title: 'Get an application',
			description:
				'Get one application: its settings, OAuth endpoints, webhook, recent webhook deliveries and directory access.',
			inputSchema: { app_id: APP_ID },
			annotations: { readOnlyHint: true, openWorldHint: false }
		},
		async ({ app_id }) =>
			withApp(app_id, async (app) => {
				const [client, deliveries] = await Promise.all([
					caller.member.client<Client>('getOAuthClient', { query: { client_id: app_id } }),
					app.endpoint ? recentDeliveries(app.endpoint.id) : []
				]);
				return ok({
					...describeClient(client),
					discovery: `${caller.issuer}/.well-known/openid-configuration`,
					webhook: app.endpoint && { url: app.endpoint.url, events: app.endpoint.events },
					webhook_events: availableEvents(app.scopes).map((type) => ({
						type,
						description: WEBHOOK_EVENTS[type].description
					})),
					recent_deliveries: deliveries.map((d) => ({
						id: d.id,
						type: d.type,
						attempts: d.attempts,
						createdAt: d.createdAt,
						deliveredAt: d.deliveredAt,
						failedAt: d.failedAt,
						lastError: d.lastError
					})),
					directory: {
						requested: app.access?.requestedScopes ?? [],
						granted: app.access?.grantedScopes ?? [],
						decided: !!app.access?.decidedAt
					}
				});
			})
	);

	server.registerTool(
		'create_app',
		{
			title: 'Create an application',
			description:
				'Create an OAuth application that signs members in with Purdue Hackers ID. ' +
				'The result shows a confidential client secret one time only.',
			inputSchema: {
				name: z.string(),
				redirect_uris: z
					.array(z.string())
					.default([])
					.describe('Callback URLs. Leave empty for device sign-in or server-only apps.'),
				confidential: z
					.boolean()
					.describe(
						'True for a server that can keep a client secret. False for browser or native apps.'
					),
				device: z.boolean().default(false).describe('Allow device sign-in, for CLIs and TVs.'),
				scopes: z.array(z.enum(MEMBER_CLIENT_SCOPES as [string, ...string[]]))
			},
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
		},
		async (input) => {
			let body;
			try {
				body = registrationBody({
					name: input.name,
					redirectUris: input.redirect_uris,
					confidential: input.confidential,
					device: input.device,
					scopes: input.scopes
				});
			} catch (error) {
				if (error instanceof AppError) return fail(error.message);
				throw error;
			}
			try {
				const created = await caller.member.client<Client & { client_secret?: string }>(
					'createOAuthClient',
					{ body }
				);
				return ok({ ...describeClient(created), clientSecret: created.client_secret });
			} catch (error) {
				return fail(clientErrorMessage(error, 'Could not create it.'));
			}
		}
	);

	server.registerTool(
		'update_app',
		{
			title: 'Update an application',
			description:
				'Change the name, redirect URLs, device sign-in or scopes of an application. ' +
				'Omit a field to keep it. The type, public or confidential, cannot change.',
			inputSchema: {
				app_id: APP_ID,
				name: z.string().optional(),
				redirect_uris: z
					.array(z.string())
					.optional()
					.describe('The full new list. It replaces the old list.'),
				device: z.boolean().optional(),
				scopes: z
					.array(z.enum(MEMBER_CLIENT_SCOPES as [string, ...string[]]))
					.optional()
					.describe('The full new list. It replaces the old list.')
			},
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
		},
		async ({ app_id, ...changes }) =>
			withApp(app_id, async () => {
				const client = await caller.member.client<Client>('getOAuthClient', {
					query: { client_id: app_id }
				});
				const current = describeClient(client);
				const update = updateBody(client, {
					name: changes.name ?? current.name,
					redirectUris: changes.redirect_uris ?? current.redirectUris,
					device: changes.device ?? current.device,
					scopes: changes.scopes ?? current.scopes
				});
				try {
					const updated = await caller.member.client<Client>('updateOAuthClient', {
						body: { client_id: app_id, update }
					});
					return ok(describeClient(updated));
				} catch (error) {
					return fail(clientErrorMessage(error, 'Could not save it.'));
				}
			})
	);

	server.registerTool(
		'rotate_app_secret',
		{
			title: 'Rotate the client secret',
			description:
				'Issue a new client secret for a confidential application. The old secret stops working at once.',
			inputSchema: { app_id: APP_ID },
			annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false }
		},
		async ({ app_id }) =>
			withApp(app_id, async () => {
				try {
					const rotated = await caller.member.client<{ client_secret?: string }>(
						'rotateClientSecret',
						{ body: { client_id: app_id } }
					);
					return ok({ clientId: app_id, clientSecret: rotated.client_secret });
				} catch (error) {
					return fail(clientErrorMessage(error, 'Could not rotate the secret.'));
				}
			})
	);

	server.registerTool(
		'delete_app',
		{
			title: 'Delete an application',
			description:
				'Delete an application. Members can no longer sign in with it. You cannot undo this.',
			inputSchema: { app_id: APP_ID },
			annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
		},
		async ({ app_id }) =>
			withApp(app_id, async () => {
				if (app_id === caller.clientId) {
					return fail('This app is the one you use now. Delete it on the Applications page.');
				}
				try {
					await caller.member.client('deleteOAuthClient', { body: { client_id: app_id } });
					return ok({ deleted: app_id });
				} catch (error) {
					return fail(clientErrorMessage(error, 'Could not delete it.'));
				}
			})
	);

	server.registerTool(
		'set_app_webhook',
		{
			title: 'Set the webhook',
			description:
				'Create or change the webhook of an application. A new webhook gets a signing secret, shown one time only. ' +
				'get_app shows the events that the application can get.',
			inputSchema: {
				app_id: APP_ID,
				url: z.string().describe('The HTTPS URL that receives the events.'),
				events: z.array(z.enum(EVENTS)).min(1)
			},
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
		},
		async ({ app_id, url, events }) =>
			withApp(app_id, async (app) => {
				const saved = await saveWebhook(app, url.trim(), events);
				const skipped = events.filter((type) => !saved.events.includes(type));
				return ok({
					url: url.trim(),
					events: saved.events,
					...(skipped.length > 0 && { unavailable_events: skipped }),
					...(saved.secret && { secret: saved.secret })
				});
			})
	);

	server.registerTool(
		'rotate_webhook_secret',
		{
			title: 'Rotate the webhook secret',
			description: 'Issue a new webhook signing secret. The old secret stops working at once.',
			inputSchema: { app_id: APP_ID },
			annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false }
		},
		async ({ app_id }) =>
			withApp(app_id, async (app) => ok({ secret: await rotateWebhookSecret(app) }))
	);

	server.registerTool(
		'remove_app_webhook',
		{
			title: 'Remove the webhook',
			description: 'Remove the webhook of an application. It stops getting events.',
			inputSchema: { app_id: APP_ID },
			annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
		},
		async ({ app_id }) =>
			withApp(app_id, async (app) => {
				await removeWebhook(app);
				return ok({ removed: true });
			})
	);

	server.registerTool(
		'test_app_webhook',
		{
			title: 'Send a test event',
			description: 'Send a test event to the webhook of an application now, and show the result.',
			inputSchema: { app_id: APP_ID },
			annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
		},
		async ({ app_id }) =>
			withApp(app_id, async (app) => {
				const problem = await testWebhook(app);
				return problem
					? fail(`Test event failed: ${problem}. It will be sent again later.`)
					: ok({ delivered: true });
			})
	);

	server.registerTool(
		'resend_webhook_delivery',
		{
			title: 'Resend a webhook delivery',
			description: 'Send one webhook delivery again. Get the delivery ID from get_app.',
			inputSchema: { app_id: APP_ID, delivery_id: z.string() },
			annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
		},
		async ({ app_id, delivery_id }) =>
			withApp(app_id, async (app) => {
				if (!app.endpoint) return fail('There is no webhook yet.');
				if (!(await resend(delivery_id, app.endpoint.id))) {
					return fail('This webhook has no delivery with that ID. Get the IDs from get_app.');
				}
				return ok({ resent: delivery_id });
			})
	);

	server.registerTool(
		'request_directory_access',
		{
			title: 'Request directory access',
			description:
				'Ask an admin to let a confidential application read the member directory. ' +
				'An admin approves the request on the Access page.',
			inputSchema: {
				app_id: APP_ID,
				scopes: z.array(z.enum(DIRECTORY_SCOPES as [string, ...string[]])).min(1)
			},
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
		},
		async ({ app_id, scopes }) =>
			withApp(app_id, async () => {
				const requested = await requestAccess(caller.userId, app_id, scopes);
				return ok({ requested, status: 'waiting for an admin' });
			})
	);
}

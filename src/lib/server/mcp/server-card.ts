import { createHash } from 'node:crypto';
import { SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/sdk/types.js';

export const SERVER_CARD_SCHEMA =
	'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json';
export const SERVER_CARD_MEDIA_TYPE = 'application/mcp-server-card+json';

export const MCP_SERVER_INFO = {
	name: 'com.purduehackers/id',
	title: 'Purdue Hackers ID',
	version: '1.0.0',
	description: 'Manage your Purdue Hackers ID profile, devices, and OAuth applications.'
} as const;

const CORS_HEADERS = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'GET, OPTIONS',
	'access-control-allow-headers': 'Accept, Content-Type, If-None-Match',
	'access-control-expose-headers': 'ETag',
	'x-robots-tag': 'noindex, nofollow'
} as const;

export function buildServerCard(origin: string) {
	const base = new URL(origin).origin;
	return {
		$schema: SERVER_CARD_SCHEMA,
		...MCP_SERVER_INFO,
		websiteUrl: base,
		repository: {
			url: 'https://github.com/purduehackers/id',
			source: 'github'
		},
		remotes: [
			{
				type: 'streamable-http' as const,
				url: `${base}/mcp`,
				supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS]
			}
		]
	};
}

function matchesIfNoneMatch(header: string | null, etag: string): boolean {
	if (!header) return false;
	const stripWeak = (tag: string) => tag.trim().replace(/^W\//i, '');
	const target = stripWeak(etag);
	return header
		.split(',')
		.map((part) => part.trim())
		.some((candidate) => candidate === '*' || stripWeak(candidate) === target);
}

export function serverCardResponse(request: Request, origin: string): Response {
	const body = JSON.stringify(buildServerCard(origin));
	const etag = `"${createHash('sha256').update(body).digest('base64url')}"`;
	const headers = {
		...CORS_HEADERS,
		'cache-control': 'public, max-age=3600',
		'content-type': `${SERVER_CARD_MEDIA_TYPE}; charset=utf-8`,
		etag
	};

	if (matchesIfNoneMatch(request.headers.get('if-none-match'), etag)) {
		return new Response(null, { status: 304, headers });
	}

	return new Response(body, { status: 200, headers });
}

export function serverCardOptionsResponse(): Response {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
}

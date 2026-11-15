import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/sdk/types.js';
import {
	AI_CATALOG_MEDIA_TYPE,
	SERVER_CARD_MEDIA_TYPE,
	SERVER_CARD_SCHEMA,
	buildAiCatalog,
	buildServerCard,
	discoveryJsonResponse,
	discoveryOptionsResponse
} from '../src/lib/server/mcp/discovery.ts';

const origin = 'https://id.purduehackers.com';

test('buildServerCard conforms to SEP-2127 server card constraints', () => {
	const card = buildServerCard(origin);

	assert.equal(card.$schema, SERVER_CARD_SCHEMA);
	assert.match(card.name, /^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/);
	assert.equal(card.name, 'com.purduehackers/id');
	assert.equal(card.title, 'Purdue Hackers ID');
	assert.equal(card.version, '1.0.0');
	assert.ok(card.description.length >= 1 && card.description.length <= 100);
	assert.equal(card.websiteUrl, origin);
	assert.deepEqual(card.repository, {
		url: 'https://github.com/purduehackers/id',
		source: 'github'
	});
	assert.deepEqual(card.remotes, [
		{
			type: 'streamable-http',
			url: 'https://id.purduehackers.com/mcp',
			supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS]
		}
	]);
	assert.equal('tools' in card, false);
	assert.equal('resources' in card, false);
	assert.equal('prompts' in card, false);
});

test('buildAiCatalog points to the hosted MCP server card', () => {
	const catalog = buildAiCatalog(origin);

	assert.deepEqual(catalog, {
		specVersion: '1.0',
		entries: [
			{
				identifier: 'urn:air:id.purduehackers.com:mcp:id',
				type: SERVER_CARD_MEDIA_TYPE,
				url: 'https://id.purduehackers.com/mcp/server-card'
			}
		]
	});
});

test('discoveryJsonResponse sets media type, CORS, caching, ETag and honors If-None-Match', async () => {
	const card = buildServerCard(origin);
	const initial = discoveryJsonResponse(
		new Request(`${origin}/mcp/server-card`),
		card,
		SERVER_CARD_MEDIA_TYPE
	);

	assert.equal(initial.status, 200);
	assert.equal(initial.headers.get('content-type'), `${SERVER_CARD_MEDIA_TYPE}; charset=utf-8`);
	assert.equal(initial.headers.get('access-control-allow-origin'), '*');
	assert.equal(initial.headers.get('access-control-expose-headers'), 'ETag');
	assert.equal(initial.headers.get('cache-control'), 'public, max-age=3600');

	const etag = initial.headers.get('etag');
	assert.ok(etag && /^".+"$/.test(etag));
	assert.deepEqual(await initial.json(), card);

	for (const header of [etag, `W/${etag}`, `"other", ${etag}`, '*']) {
		const cached = discoveryJsonResponse(
			new Request(`${origin}/mcp/server-card`, { headers: { 'if-none-match': header } }),
			card,
			SERVER_CARD_MEDIA_TYPE
		);
		assert.equal(cached.status, 304);
		assert.equal(cached.headers.get('etag'), etag);
		assert.equal(await cached.text(), '');
	}

	const stale = discoveryJsonResponse(
		new Request(`${origin}/.well-known/ai-catalog.json`, {
			headers: { 'if-none-match': '"stale"' }
		}),
		buildAiCatalog(origin),
		AI_CATALOG_MEDIA_TYPE
	);
	assert.equal(stale.status, 200);
	assert.equal(stale.headers.get('content-type'), `${AI_CATALOG_MEDIA_TYPE}; charset=utf-8`);

	const options = discoveryOptionsResponse();
	assert.equal(options.status, 204);
	assert.equal(options.headers.get('access-control-allow-origin'), '*');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/sdk/types.js';
import {
	SERVER_CARD_MEDIA_TYPE,
	SERVER_CARD_SCHEMA,
	buildServerCard,
	serverCardOptionsResponse,
	serverCardResponse
} from '../src/lib/server/mcp/server-card.ts';

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

test('serverCardResponse sets noindex, media type, CORS, caching, ETag and honors If-None-Match', async () => {
	const card = buildServerCard(origin);
	const initial = serverCardResponse(new Request(`${origin}/mcp/server-card`), origin);

	assert.equal(initial.status, 200);
	assert.equal(initial.headers.get('content-type'), `${SERVER_CARD_MEDIA_TYPE}; charset=utf-8`);
	assert.equal(initial.headers.get('access-control-allow-origin'), '*');
	assert.equal(initial.headers.get('access-control-expose-headers'), 'ETag');
	assert.equal(initial.headers.get('cache-control'), 'public, max-age=3600');
	assert.equal(initial.headers.get('x-robots-tag'), 'noindex, nofollow');

	const etag = initial.headers.get('etag');
	assert.ok(etag && /^".+"$/.test(etag));
	assert.deepEqual(await initial.json(), card);

	for (const header of [etag, `W/${etag}`, `"other", ${etag}`, '*']) {
		const cached = serverCardResponse(
			new Request(`${origin}/mcp/server-card`, { headers: { 'if-none-match': header } }),
			origin
		);
		assert.equal(cached.status, 304);
		assert.equal(cached.headers.get('etag'), etag);
		assert.equal(await cached.text(), '');
	}

	const stale = serverCardResponse(
		new Request(`${origin}/mcp/server-card`, { headers: { 'if-none-match': '"stale"' } }),
		origin
	);
	assert.equal(stale.status, 200);

	const options = serverCardOptionsResponse();
	assert.equal(options.status, 204);
	assert.equal(options.headers.get('access-control-allow-origin'), '*');
	assert.equal(options.headers.get('x-robots-tag'), 'noindex, nofollow');
});

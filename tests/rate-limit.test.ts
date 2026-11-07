import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isDevicePollFrom } from '../src/lib/server/rate-limit.ts';

const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

function tokenRequest(body: string, headers: Record<string, string> = {}) {
	return new Request('https://id.example.com/api/auth/oauth2/token', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
		body
	});
}

const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();

test('isDevicePollFrom finds the client in a form body', async () => {
	const request = tokenRequest(form({ grant_type: DEVICE_GRANT, client_id: 'phack' }));
	assert.equal(await isDevicePollFrom(request, 'phack'), true);
});

test('isDevicePollFrom finds the client in a JSON body', async () => {
	const request = tokenRequest(JSON.stringify({ grant_type: DEVICE_GRANT, client_id: 'phack' }), {
		'content-type': 'application/json'
	});
	assert.equal(await isDevicePollFrom(request, 'phack'), true);
});

test('isDevicePollFrom finds the client in Basic credentials', async () => {
	const request = tokenRequest(form({ grant_type: DEVICE_GRANT }), {
		authorization: `Basic ${btoa('phack:secret')}`
	});
	assert.equal(await isDevicePollFrom(request, 'phack'), true);
});

test('isDevicePollFrom rejects other clients and other grants', async () => {
	const other = tokenRequest(form({ grant_type: DEVICE_GRANT, client_id: 'other' }));
	assert.equal(await isDevicePollFrom(other, 'phack'), false);

	const refresh = tokenRequest(form({ grant_type: 'refresh_token', client_id: 'phack' }));
	assert.equal(await isDevicePollFrom(refresh, 'phack'), false);

	const anonymous = tokenRequest(form({ grant_type: DEVICE_GRANT }));
	assert.equal(await isDevicePollFrom(anonymous, 'phack'), false);
});

test('isDevicePollFrom returns false for malformed requests', async () => {
	const json = tokenRequest('{', { 'content-type': 'application/json' });
	assert.equal(await isDevicePollFrom(json, 'phack'), false);

	const basic = tokenRequest(form({ grant_type: DEVICE_GRANT }), {
		authorization: 'Basic %%%'
	});
	assert.equal(await isDevicePollFrom(basic, 'phack'), false);
});

test('isDevicePollFrom leaves the body readable', async () => {
	const body = form({ grant_type: DEVICE_GRANT, client_id: 'phack' });
	const request = tokenRequest(body);
	await isDevicePollFrom(request, 'phack');
	assert.equal(await request.text(), body);
});

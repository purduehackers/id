import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isForbiddenFormSubmission } from '../src/lib/server/csrf.ts';

const tokenUrl = 'https://id.example.com/api/auth/oauth2/token';

function formRequest(url: string, headers: Record<string, string> = {}) {
	return new Request(url, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
		body: 'grant_type=invalid'
	});
}

test('server-side OAuth requests can omit Origin', () => {
	for (const path of ['token', 'introspect', 'revoke']) {
		const url = `https://id.example.com/api/auth/oauth2/${path}`;
		assert.equal(isForbiddenFormSubmission(formRequest(url)), false);
	}
});

test('browser form requests still require a trusted Origin', () => {
	assert.equal(isForbiddenFormSubmission(formRequest('https://id.example.com/login')), true);
	assert.equal(isForbiddenFormSubmission(formRequest(tokenUrl, { cookie: 'session=abc' })), true);
	assert.equal(
		isForbiddenFormSubmission(formRequest(tokenUrl, { 'sec-fetch-site': 'cross-site' })),
		true
	);
	assert.equal(
		isForbiddenFormSubmission(formRequest(tokenUrl, { origin: 'https://other.example.com' })),
		true
	);
	assert.equal(
		isForbiddenFormSubmission(formRequest(tokenUrl, { origin: 'https://id.example.com' })),
		false
	);
});

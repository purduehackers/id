import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { identiconSvg } from '$lib/components/pixel';

// Public. Do not read the database here: it must not show if a user exists.
export const GET: RequestHandler = ({ params }) => {
	const seed = params.file.replace(/\.svg$/, '');
	if (seed === params.file || !/^[\w-]{1,64}$/.test(seed)) error(404, 'Not Found');

	return new Response(identiconSvg(seed), {
		headers: {
			'content-type': 'image/svg+xml; charset=utf-8',
			'cache-control': 'public, max-age=31536000, immutable',
			'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
			'x-content-type-options': 'nosniff'
		}
	});
};

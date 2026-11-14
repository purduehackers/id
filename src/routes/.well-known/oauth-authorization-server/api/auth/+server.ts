import { oauthProviderAuthServerMetadata } from '@better-auth/oauth-provider';
import type { RequestHandler } from './$types';
import { auth } from '$lib/server/auth';

const metadata = oauthProviderAuthServerMetadata(auth, {
	headers: { 'access-control-allow-origin': '*' }
});

export const GET: RequestHandler = ({ request }) => metadata(request);

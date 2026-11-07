const DEVICE_CODE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

async function readBody(request: Request): Promise<Record<string, unknown>> {
	const clone = request.clone();
	if (request.headers.get('content-type')?.includes('application/json')) {
		return (await clone.json()) ?? {};
	}
	return Object.fromEntries(new URLSearchParams(await clone.text()));
}

function basicClientId(request: Request): string | null {
	const [scheme, credentials] = request.headers.get('authorization')?.split(' ') ?? [];
	if (scheme?.toLowerCase() !== 'basic' || !credentials) return null;
	return decodeURIComponent(atob(credentials).split(':')[0]);
}

export async function isDevicePollFrom(request: Request, clientId: string): Promise<boolean> {
	try {
		const body = await readBody(request);
		if (body.grant_type !== DEVICE_CODE_GRANT) return false;
		return (body.client_id ?? basicClientId(request)) === clientId;
	} catch {
		return false;
	}
}

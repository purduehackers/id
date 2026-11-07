import { env } from '$env/dynamic/private';
import { AwsClient } from 'aws4fetch';

export class R2Error extends Error {}

const TIMEOUT = 10_000;

function config() {
	const accountId = env.CLOUDFLARE_ACCOUNT_ID;
	const accessKeyId = env.R2_ACCESS_KEY_ID;
	const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
	const bucket = env.R2_BUCKET;
	const publicUrl = env.R2_PUBLIC_URL?.replace(/\/$/, '');
	if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
		throw new R2Error('R2 is not configured');
	}
	return {
		publicUrl,
		endpoint: `https://${accountId}.r2.cloudflarestorage.com/${bucket}`,
		client: new AwsClient({
			accessKeyId,
			secretAccessKey,
			service: 's3',
			region: 'auto',
			retries: 2
		})
	};
}

export async function putObject(
	key: string,
	body: Uint8Array<ArrayBuffer>,
	headers: Record<string, string>
): Promise<string> {
	const { client, endpoint, publicUrl } = config();
	const response = await client.fetch(`${endpoint}/${key}`, {
		method: 'PUT',
		body,
		headers,
		signal: AbortSignal.timeout(TIMEOUT)
	});
	if (!response.ok) throw new R2Error(`R2 PUT failed with status ${response.status}`);
	return `${publicUrl}/${key}`;
}

export async function deleteByUrl(url: string): Promise<void> {
	const { client, endpoint, publicUrl } = config();
	if (!url.startsWith(`${publicUrl}/`)) return;
	const response = await client.fetch(`${endpoint}/${url.slice(publicUrl.length + 1)}`, {
		method: 'DELETE',
		signal: AbortSignal.timeout(TIMEOUT)
	});
	if (!response.ok && response.status !== 404) {
		throw new R2Error(`R2 DELETE failed with status ${response.status}`);
	}
}

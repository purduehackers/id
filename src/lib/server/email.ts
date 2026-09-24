import { env } from '$env/dynamic/private';

type Mail = {
	to: string;
	subject: string;
	text: string;
};

type SendResult = {
	success: boolean;
	errors: { code: number; message: string }[];
	result: { delivered: string[]; permanent_bounces: string[]; queued: string[] } | null;
};

export const emailConfigured = () =>
	Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_EMAIL_API_TOKEN && env.EMAIL_FROM);

export async function sendEmail(mail: Mail): Promise<void> {
	if (!emailConfigured()) return;

	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/email/sending/send`,
		{
			method: 'POST',
			headers: {
				authorization: `Bearer ${env.CLOUDFLARE_EMAIL_API_TOKEN}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				from: env.EMAIL_FROM,
				to: mail.to,
				subject: mail.subject,
				text: mail.text
			})
		}
	);

	const body = (await response.json().catch(() => null)) as SendResult | null;

	if (!response.ok || !body?.success) {
		const reason = body?.errors?.map((e) => `${e.code} ${e.message}`).join(', ');
		throw new Error(`Cloudflare error: HTTP ${response.status} ${reason ?? ''}`);
	}
}

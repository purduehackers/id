import { env } from '$env/dynamic/private';

type Mail = {
	to: string;
	subject: string;
	text: string;
};

export async function sendEmail(mail: Mail): Promise<void> {
	if (!env.RESEND_API_KEY) {
		return;
	}

	const response = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			authorization: `Bearer ${env.RESEND_API_KEY}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			from: env.EMAIL_FROM,
			to: mail.to,
			subject: mail.subject,
			text: mail.text
		})
	});

	if (!response.ok) {
		throw new Error(`Resend refused the email: HTTP ${response.status} ${await response.text()}`);
	}
}

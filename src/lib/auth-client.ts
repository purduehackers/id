import { passkeyClient } from '@better-auth/passkey/client';
import { createAuthClient } from 'better-auth/client';

export const authClient = createAuthClient({ plugins: [passkeyClient()] });

const MESSAGES: Record<string, string> = {
	SESSION_NOT_FRESH: 'For this one you need to sign in again first.',
	PASSKEY_NOT_FOUND: 'That passkey is no longer attached to a Purdue Hackers ID.',
	ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: 'This device already has a passkey for your account.',
	ERROR_INVALID_RP_ID: 'Passkeys do not work on this address.',
	ERROR_INVALID_DOMAIN: 'Passkeys do not work on this address.'
};

const CANCELLED = new Set([
	'AUTH_CANCELLED',
	'ERROR_CEREMONY_ABORTED',
	'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY'
]);

/** What to tell the person about a failed passkey request, if anything. */
export function passkeyProblem(error: {
	code?: string;
	message?: string;
	status?: number;
}): string | null {
	if (error.code && CANCELLED.has(error.code)) return null;
	if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
	if (error.status === 403 && error.message) return error.message;
	return 'That passkey did not work, please try again.';
}

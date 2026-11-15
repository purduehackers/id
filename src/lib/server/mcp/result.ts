import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Member } from './as-member';

export type Caller = {
	userId: string;
	clientId: string;
	issuer: string;
	scopes: Set<string>;
	member: Member;
	admin: { id: string; username: string } | null;
};

export const ok = (data: unknown): CallToolResult => ({
	content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
});

export const fail = (message: string): CallToolResult => ({
	content: [{ type: 'text', text: message }],
	isError: true
});

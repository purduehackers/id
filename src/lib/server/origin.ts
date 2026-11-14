import { env } from '$env/dynamic/private';

export const configuredOrigin = env.ORIGIN ? new URL(env.ORIGIN).origin : null;

export function originFor(url: URL) {
	return configuredOrigin ?? url.origin;
}

export function issuerFor(url: URL) {
	return `${originFor(url)}/api/auth`;
}

export const MCP_RESOURCE = configuredOrigin ? `${configuredOrigin}/mcp` : null;

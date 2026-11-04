/**
 * Example: Fetching the Purdue Hackers Member Directory
 *
 * Demonstrates how an external application (like a Member Directory site)
 * uses OAuth 2.0 client credentials to fetch directory data from `id`.
 *
 * Required OAuth scopes:
 * - `directory:roles`: Access to roles, GitHub handle, and graduation year.
 * - `directory:contact` (optional): Access to member email and phone number.
 *
 * Usage:
 *   deno run -A examples/demo-client/directory.ts
 *   bun run examples/demo-client/directory.ts
 */

const ID_BASE = process.env.ID_BASE ?? 'http://localhost:5173';
const CLIENT_ID = process.env.CLIENT_ID ?? 'directory-service';
const CLIENT_SECRET = process.env.CLIENT_SECRET ?? 'directory-secret';
const SCOPE = process.env.SCOPE ?? 'directory:roles directory:contact';

type DirectoryUser = {
	id: string;
	name: string;
	email?: string | null;
	phone_number?: string | null;
	github?: string | null;
	graduation_year?: number | null;
	roles: string[];
};

async function getAccessToken(): Promise<string> {
	console.log(`Requesting client_credentials token from ${ID_BASE}/api/auth/oauth2/token...`);

	const body = new URLSearchParams({
		grant_type: 'client_credentials',
		client_id: CLIENT_ID,
		client_secret: CLIENT_SECRET,
		scope: SCOPE
	});

	const res = await fetch(`${ID_BASE}/api/auth/oauth2/token`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: body.toString()
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Token request failed with status ${res.status}: ${text}`);
	}

	const data = (await res.json()) as { access_token: string; token_type: string; scope: string };
	console.log(`Received token with granted scope: "${data.scope}"`);
	return data.access_token;
}

async function fetchDirectory(
	accessToken: string,
	roles = 'organizer,alumni'
): Promise<DirectoryUser[]> {
	const url = new URL(`${ID_BASE}/api/directory/users`);
	if (roles) {
		url.searchParams.set('role', roles);
	}

	console.log(`Querying ${url.toString()}...`);
	const res = await fetch(url.toString(), {
		headers: {
			Authorization: `Bearer ${accessToken}`
		}
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Directory query failed with status ${res.status}: ${text}`);
	}

	const data = (await res.json()) as { users: DirectoryUser[] };
	return data.users;
}

async function main() {
	try {
		const token = await getAccessToken();
		const members = await fetchDirectory(token, 'organizer,alumni');

		console.log(`\nFound ${members.length} team members:`);
		for (const member of members) {
			const grad = member.graduation_year ? ` '` + String(member.graduation_year).slice(-2) : '';
			const github = member.github ? ` (@${member.github})` : '';
			const contact = [member.email, member.phone_number].filter(Boolean).join(' | ');

			console.log(`- ${member.name}${grad}${github} [${member.roles.join(', ')}]`);
			if (contact) {
				console.log(`    Contact: ${contact}`);
			}
		}
	} catch (err) {
		console.error('Error:', err instanceof Error ? err.message : err);
		process.exit(1);
	}
}

main();

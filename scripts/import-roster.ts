import { createClient } from '@libsql/client';
import { readFileSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { splitNameParts, splitPhone, validateProfile } from '../src/lib/profile.ts';

// Simple CSV line parser supporting quoted cells with commas
function parseCsv(text: string): Array<Record<string, string>> {
	const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
	if (lines.length < 2) return [];

	const splitRow = (row: string): string[] => {
		const cells: string[] = [];
		let current = '';
		let inQuotes = false;
		for (let i = 0; i < row.length; i++) {
			const ch = row[i];
			if (ch === '"') {
				if (inQuotes && row[i + 1] === '"') {
					current += '"';
					i++;
				} else {
					inQuotes = !inQuotes;
				}
			} else if (ch === ',' && !inQuotes) {
				cells.push(current.trim());
				current = '';
			} else {
				current += ch;
			}
		}
		cells.push(current.trim());
		return cells;
	};

	const headers = splitRow(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));

	const records: Array<Record<string, string>> = [];
	for (let i = 1; i < lines.length; i++) {
		const values = splitRow(lines[i]);
		const row: Record<string, string> = {};
		for (let j = 0; j < headers.length; j++) {
			row[headers[j]] = values[j] ?? '';
		}
		records.push(row);
	}
	return records;
}

function loadEnv(): Record<string, string> {
	const env: Record<string, string> = {};
	if (existsSync('.env')) {
		const text = readFileSync('.env', 'utf-8');
		for (const line of text.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const idx = trimmed.indexOf('=');
			if (idx > 0) {
				const key = trimmed.slice(0, idx).trim();
				let val = trimmed.slice(idx + 1).trim();
				if (
					(val.startsWith('"') && val.endsWith('"')) ||
					(val.startsWith("'") && val.endsWith("'"))
				) {
					val = val.slice(1, -1);
				}
				env[key] = val;
			}
		}
	}
	return env;
}

type RosterEntry = {
	email: string;
	name?: string;
	phone?: string;
	graduationYear?: string;
	github?: string;
};

function normalizeEntry(row: Record<string, string>): RosterEntry | null {
	// Discover field names flexibly across common Notion column header variations
	const emailKey = Object.keys(row).find((k) => k.includes('email'));
	const nameKey = Object.keys(row).find((k) => k.includes('name'));
	const phoneKey = Object.keys(row).find((k) => k.includes('phone'));
	const gradKey = Object.keys(row).find(
		(k) => k.includes('grad') || k.includes('year') || k.includes('class')
	);
	const githubKey = Object.keys(row).find((k) => k.includes('github'));

	const email = (emailKey ? row[emailKey] : '').trim().toLowerCase();
	if (!email || !email.includes('@')) return null;

	let github = githubKey ? row[githubKey].trim() : '';
	// Strip URL prefixes like https://github.com/
	github = github
		.replace(/^https?:\/\/(www\.)?github\.com\//i, '')
		.replace(/^@/, '')
		.trim();

	return {
		email,
		name: nameKey ? row[nameKey].trim() : undefined,
		phone: phoneKey ? row[phoneKey].trim() : undefined,
		graduationYear: gradKey ? row[gradKey].trim() : undefined,
		github: github || undefined
	};
}

async function main() {
	const { values, positionals } = parseArgs({
		options: {
			dryRun: { type: 'boolean', default: false },
			help: { type: 'boolean', short: 'h', default: false }
		},
		allowPositionals: true
	});

	if (values.help || positionals.length === 0) {
		console.log(`
Usage:
  deno run -A scripts/import-roster.ts [options] <roster.csv|roster.json>
  bun run scripts/import-roster.ts [options] <roster.csv|roster.json>

Options:
  --dryRun    Inspect changes without writing to the database
  -h, --help  Show help
`);
		process.exit(0);
	}

	const filePath = positionals[0];
	if (!existsSync(filePath)) {
		console.error(`Error: File not found: ${filePath}`);
		process.exit(1);
	}

	const env = { ...loadEnv(), ...process.env };
	const dbUrl = env.TURSO_DATABASE_URL;
	const dbAuthToken = env.TURSO_AUTH_TOKEN;

	if (!dbUrl) {
		console.error('Error: TURSO_DATABASE_URL is not set in environment or .env');
		process.exit(1);
	}

	const rawContent = readFileSync(filePath, 'utf-8');
	let rawRows: Array<Record<string, string>>;
	if (filePath.endsWith('.json')) {
		const parsed = JSON.parse(rawContent);
		rawRows = Array.isArray(parsed) ? parsed : [parsed];
	} else {
		rawRows = parseCsv(rawContent);
	}

	const entries: RosterEntry[] = [];
	for (const row of rawRows) {
		const entry = normalizeEntry(row);
		if (entry) entries.push(entry);
	}

	console.log(`Loaded ${entries.length} valid roster entries from ${filePath}.`);
	if (values.dryRun) {
		console.log('--- DRY RUN MODE (no writes) ---');
	}

	const client = createClient({ url: dbUrl, authToken: dbAuthToken });

	let updatedCount = 0;
	let notFoundCount = 0;
	let errorCount = 0;

	for (const entry of entries) {
		// Look up existing user by email
		const res = await client.execute({
			sql: 'SELECT id, name, phone, graduation_year as graduationYear, github FROM user WHERE lower(email) = lower(?) LIMIT 1',
			args: [entry.email]
		});

		if (res.rows.length === 0) {
			console.log(`[SKIP] No user in 'id' with email: ${entry.email}`);
			notFoundCount++;
			continue;
		}

		const user = res.rows[0] as unknown as {
			id: string;
			name: string;
			phone: string | null;
			graduationYear: number | null;
			github: string | null;
		};

		const nextName = entry.name || user.name;
		const { firstName, lastName } = splitNameParts({ name: nextName });
		const nextPhone = entry.phone !== undefined ? entry.phone : (user.phone ?? '');
		const parsedPhone = splitPhone(nextPhone);
		const nextGrad =
			entry.graduationYear !== undefined
				? entry.graduationYear
				: user.graduationYear
					? String(user.graduationYear)
					: '';

		try {
			const validated = validateProfile({
				firstName: firstName || 'Member',
				lastName: lastName || 'User',
				phoneCountry: parsedPhone.countryCode,
				phone: parsedPhone.national,
				graduationYear: nextGrad
			});

			const nextGithub = entry.github ?? user.github;

			if (values.dryRun) {
				console.log(
					`[PLAN] Update ${entry.email}: name="${validated.name}", givenName="${validated.givenName}", familyName="${validated.familyName}", phone=${validated.phone}, gradYear=${validated.graduationYear}, github=${nextGithub}`
				);
			} else {
				await client.execute({
					sql: 'UPDATE user SET name = ?, given_name = ?, family_name = ?, phone = ?, graduation_year = ?, github = ? WHERE id = ?',
					args: [
						validated.name,
						validated.givenName,
						validated.familyName,
						validated.phone,
						validated.graduationYear,
						nextGithub,
						user.id
					]
				});
				console.log(`[OK] Updated ${entry.email} (${validated.name})`);
			}
			updatedCount++;
		} catch (err) {
			console.error(
				`[ERROR] Failed validating ${entry.email}:`,
				err instanceof Error ? err.message : err
			);
			errorCount++;
		}
	}

	console.log('\n--- Summary ---');
	console.log(`Total roster rows:  ${entries.length}`);
	console.log(`Updated in 'id':    ${updatedCount}`);
	console.log(`Not found in 'id':  ${notFoundCount}`);
	if (errorCount > 0) {
		console.log(`Validation errors:  ${errorCount}`);
	}
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});

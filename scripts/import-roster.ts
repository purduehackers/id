import { createClient } from '@libsql/client';
import { readFileSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
	PART_NAME_MAX_LENGTH,
	ProfileError,
	normalizeNamePart,
	splitNameParts,
	validateGraduationYear,
	validatePhone
} from '../src/lib/profile.ts';

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

	const headers = splitRow(lines[0]);

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
	fullName?: string;
	firstName?: string;
	lastName?: string;
	phone?: string;
	graduationYear?: string;
	github?: string;
};

const FULL_NAME_COLUMNS = ['name', 'full_name', 'fullname', 'member_name', 'display_name'];
const FIRST_NAME_COLUMNS = ['first_name', 'firstname', 'given_name', 'givenname', 'first'];
const LAST_NAME_COLUMNS = ['last_name', 'lastname', 'family_name', 'familyname', 'surname', 'last'];

function normalizeEntry(raw: Record<string, unknown>): RosterEntry | null {
	const row: Record<string, string> = {};
	for (const [key, value] of Object.entries(raw)) {
		row[key.toLowerCase().replace(/[^a-z0-9_]/g, '_')] = String(value ?? '').trim();
	}
	const keys = Object.keys(row);
	const cell = (key: string | undefined) => (key && row[key]) || undefined;
	const exact = (columns: string[]) => cell(columns.find((column) => row[column]));
	const containing = (...parts: string[]) =>
		cell(keys.find((key) => row[key] && parts.some((part) => key.includes(part))));

	const email = containing('email')?.toLowerCase();
	if (!email || !email.includes('@')) return null;

	// Strip URL prefixes like https://github.com/
	const github = containing('github')
		?.replace(/^https?:\/\/(www\.)?github\.com\//i, '')
		.replace(/^@/, '')
		.trim();

	return {
		email,
		fullName: exact(FULL_NAME_COLUMNS),
		firstName: exact(FIRST_NAME_COLUMNS),
		lastName: exact(LAST_NAME_COLUMNS),
		phone: containing('phone'),
		graduationYear: containing('grad', 'year', 'class'),
		github: github || undefined
	};
}

type StoredUser = {
	id: string;
	name: string;
	given_name: string | null;
	family_name: string | null;
	phone: string | null;
	graduation_year: number | null;
	github: string | null;
};

function nameChanges(entry: RosterEntry, user: StoredUser) {
	const changes: { given_name?: string; family_name?: string | null } = {};
	if (entry.firstName || entry.lastName) {
		if (entry.firstName) changes.given_name = normalizeNamePart(entry.firstName);
		if (entry.lastName) changes.family_name = normalizeNamePart(entry.lastName);
	} else if (entry.fullName && normalizeNamePart(entry.fullName) !== user.name) {
		const { firstName, lastName } = splitNameParts(entry.fullName);
		changes.given_name = firstName;
		changes.family_name = lastName || null;
	}
	for (const part of [changes.given_name, changes.family_name]) {
		if (part && part.length > PART_NAME_MAX_LENGTH) {
			throw new ProfileError(`Keep each name under ${PART_NAME_MAX_LENGTH} characters.`);
		}
	}
	return changes;
}

function hasNoSurname(entry: RosterEntry): boolean {
	if (entry.firstName || entry.lastName) return !entry.lastName;
	if (entry.fullName) return !splitNameParts(entry.fullName).lastName;
	return false;
}

function rosterChanges(entry: RosterEntry, user: StoredUser) {
	const changes: Record<string, string | number | null> = { ...nameChanges(entry, user) };
	if (entry.phone) changes.phone = validatePhone(entry.phone, '+1');
	if (entry.graduationYear) {
		changes.graduation_year = validateGraduationYear(entry.graduationYear);
	}
	if (entry.github) changes.github = entry.github;
	for (const [column, value] of Object.entries(changes)) {
		if (user[column as keyof StoredUser] === value) delete changes[column];
	}
	return changes;
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
	let rawRows: Array<Record<string, unknown>>;
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
	let unchangedCount = 0;
	let notFoundCount = 0;
	let errorCount = 0;
	const singleNames: string[] = [];

	for (const entry of entries) {
		// Look up existing user by email
		const res = await client.execute({
			sql: 'SELECT id, name, given_name, family_name, phone, graduation_year, github FROM user WHERE lower(email) = lower(?) LIMIT 1',
			args: [entry.email]
		});

		if (res.rows.length === 0) {
			console.log(`[SKIP] No user in 'id' with email: ${entry.email}`);
			notFoundCount++;
			continue;
		}

		const user = res.rows[0] as unknown as StoredUser;

		try {
			const changes = rosterChanges(entry, user);
			if (hasNoSurname(entry)) singleNames.push(entry.email);
			const columns = Object.keys(changes);
			if (columns.length === 0) {
				unchangedCount++;
				continue;
			}

			const summary = columns.map((column) => `${column}=${changes[column]}`).join(', ');
			if (values.dryRun) {
				console.log(`[PLAN] Update ${entry.email}: ${summary}`);
			} else {
				await client.execute({
					sql: `UPDATE user SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`,
					args: [...columns.map((column) => changes[column]), user.id]
				});
				console.log(`[OK] Updated ${entry.email}: ${summary}`);
			}
			updatedCount++;
		} catch (err) {
			if (!(err instanceof ProfileError)) throw err;
			console.error(`[ERROR] Failed validating ${entry.email}: ${err.message}`);
			errorCount++;
		}
	}

	console.log('\n--- Summary ---');
	console.log(`Total roster rows:  ${entries.length}`);
	console.log(`Updated in 'id':    ${updatedCount}`);
	console.log(`Already up to date: ${unchangedCount}`);
	console.log(`Not found in 'id':  ${notFoundCount}`);
	if (errorCount > 0) {
		console.log(`Validation errors:  ${errorCount}`);
	}
	if (singleNames.length > 0) {
		console.log(`No surname given:   ${singleNames.join(', ')}`);
	}
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});

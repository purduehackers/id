/**
 * Migrate data from Postgres (pg_dump --data-only --inserts) to Turso.
 *
 * Usage:
 *   1. pg_dump --data-only --inserts --no-owner --no-privileges \
 *        --dbname="$POSTGRES_URL" > dump.sql
 *   2. TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... \
 *        bun run scripts/migrate-pg-to-turso.ts dump.sql
 *
 * What this script does:
 *   - Pushes the Drizzle schema to your Turso DB (creates all tables)
 *   - Parses each INSERT from the pg_dump
 *   - Converts Postgres types to SQLite types:
 *       bigint discord_id  → text
 *       boolean            → 0/1
 *       timestamp(tz)      → unix seconds (integer)
 *       json/jsonb         → text (already JSON strings in dump)
 *   - Inserts rows in dependency order with foreign keys deferred
 */

import { createClient } from "@libsql/client";
import { readFileSync } from "fs";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error("TURSO_DATABASE_URL is required");
  process.exit(1);
}

const dumpPath = process.argv[2];
if (!dumpPath) {
  console.error("Usage: bun run scripts/migrate-pg-to-turso.ts <dump.sql>");
  process.exit(1);
}

const client = createClient({ url, authToken });

// ── Schema creation ──────────────────────────────────────────────────
// We create tables manually so we control the exact DDL.
// This must match src/lib/server/db/schema.ts.

const createStatements = [
  `CREATE TABLE IF NOT EXISTS "user" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "discord_id" text NOT NULL UNIQUE,
    "role" text NOT NULL,
    "totp" text
  )`,
  `CREATE TABLE IF NOT EXISTS "passport" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "owner_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "version" integer NOT NULL,
    "surname" text NOT NULL,
    "name" text NOT NULL,
    "date_of_birth" text NOT NULL,
    "date_of_issue" text NOT NULL,
    "place_of_origin" text NOT NULL,
    "secret" text NOT NULL,
    "activated" integer NOT NULL DEFAULT 0,
    "ceremony_time" integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "ceremonies" (
    "ceremony_time" integer PRIMARY KEY NOT NULL,
    "total_slots" integer NOT NULL,
    "open_registration" integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "auth_grant" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "owner_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "redirect_uri" text NOT NULL,
    "until" integer NOT NULL,
    "scope" text NOT NULL,
    "client_id" text NOT NULL,
    "code" text
  )`,
  `CREATE TABLE IF NOT EXISTS "auth_token" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "grant_id" integer NOT NULL REFERENCES "auth_grant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "token" text NOT NULL,
    "until" integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "auth_session" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "token" text NOT NULL,
    "until" integer NOT NULL,
    "owner_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "oauth_client" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "client_id" text NOT NULL UNIQUE,
    "client_secret" text,
    "owner_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "redirect_uris" text NOT NULL,
    "default_scope" text NOT NULL,
    "name" text NOT NULL,
    "created_at" integer NOT NULL
  )`,
];

// ── Column metadata for type conversion ──────────────────────────────

interface ColMeta {
  type: "text" | "integer" | "boolean" | "timestamp" | "json";
}

// Maps pg table name → column name → how to convert the value
const tableMeta: Record<string, Record<string, ColMeta>> = {
  user: {
    id: { type: "integer" },
    discord_id: { type: "text" }, // was bigint, now text
    role: { type: "text" },
    totp: { type: "text" },
  },
  passport: {
    id: { type: "integer" },
    owner_id: { type: "integer" },
    version: { type: "integer" },
    surname: { type: "text" },
    name: { type: "text" },
    date_of_birth: { type: "text" },
    date_of_issue: { type: "text" },
    place_of_origin: { type: "text" },
    secret: { type: "text" },
    activated: { type: "boolean" },
    ceremony_time: { type: "timestamp" },
  },
  ceremonies: {
    ceremony_time: { type: "timestamp" },
    total_slots: { type: "integer" },
    open_registration: { type: "boolean" },
  },
  auth_grant: {
    id: { type: "integer" },
    owner_id: { type: "integer" },
    redirect_uri: { type: "json" },
    until: { type: "timestamp" },
    scope: { type: "json" },
    client_id: { type: "text" },
    code: { type: "text" },
  },
  auth_token: {
    id: { type: "integer" },
    grant_id: { type: "integer" },
    token: { type: "text" },
    until: { type: "timestamp" },
  },
  auth_session: {
    id: { type: "integer" },
    token: { type: "text" },
    until: { type: "timestamp" },
    owner_id: { type: "integer" },
  },
  oauth_client: {
    id: { type: "integer" },
    client_id: { type: "text" },
    client_secret: { type: "text" },
    owner_id: { type: "integer" },
    redirect_uris: { type: "json" },
    default_scope: { type: "text" },
    name: { type: "text" },
    created_at: { type: "timestamp" },
  },
};

// Postgres pg_dump may use the schema-qualified name "public.table_name"
function normalizeTableName(raw: string): string {
  return raw.replace(/^public\./, "").replace(/"/g, "");
}

// ── Value parsing ────────────────────────────────────────────────────

// Parse a single SQL value token from a pg_dump INSERT.
// Returns [parsedValue, restOfString].
function parseValue(s: string): [string, string] {
  s = s.trimStart();

  if (s.startsWith("NULL")) {
    return ["NULL", s.slice(4)];
  }

  if (s.startsWith("'")) {
    // String literal — find the closing quote, handling escaped quotes ('')
    let i = 1;
    let val = "'";
    while (i < s.length) {
      if (s[i] === "'" && s[i + 1] === "'") {
        val += "''";
        i += 2;
      } else if (s[i] === "'") {
        val += "'";
        i += 1;
        break;
      } else {
        val += s[i];
        i += 1;
      }
    }
    return [val, s.slice(i)];
  }

  // Unquoted value (number, boolean, etc.)
  const match = s.match(/^([^\s,)]+)/);
  if (match) {
    return [match[1], s.slice(match[1].length)];
  }

  return ["", s];
}

// Parse all values from "VALUES (v1, v2, ...)" portion
function parseValues(valueStr: string): string[] {
  const values: string[] = [];
  let s = valueStr.trim();
  // Strip outer parens
  if (s.startsWith("(")) s = s.slice(1);
  if (s.endsWith(")") || s.endsWith(");")) {
    s = s.replace(/\);?\s*$/, "");
  }

  while (s.length > 0) {
    s = s.trimStart();
    if (s.startsWith(",")) {
      s = s.slice(1).trimStart();
    }
    if (s.length === 0) break;
    const [val, rest] = parseValue(s);
    values.push(val);
    s = rest;
  }

  return values;
}

// Convert a parsed pg value to the SQLite equivalent
function convertValue(raw: string, meta: ColMeta): string {
  if (raw === "NULL") return "NULL";

  switch (meta.type) {
    case "boolean": {
      const inner = raw.replace(/'/g, "").toLowerCase();
      return inner === "true" || inner === "t" ? "1" : "0";
    }
    case "timestamp": {
      // Strip quotes, parse as Date, emit unix seconds
      const inner = raw.replace(/^'|'$/g, "");
      const ms = new Date(inner).getTime();
      if (isNaN(ms)) {
        console.warn(`  Warning: unparseable timestamp "${inner}", using 0`);
        return "0";
      }
      return String(Math.floor(ms / 1000));
    }
    case "integer": {
      // Strip quotes if present
      return raw.replace(/'/g, "");
    }
    case "text": {
      // If it's already a quoted string, keep it. If it's a bare number
      // (e.g. bigint discord_id), wrap it in quotes.
      if (raw.startsWith("'")) return raw;
      if (raw === "NULL") return "NULL";
      return `'${raw}'`;
    }
    case "json": {
      // JSON values from pg_dump come as quoted strings — keep as-is
      return raw;
    }
    default:
      return raw;
  }
}

// ── Positional column order (matches Postgres table definition order) ─

const tableColumns: Record<string, string[]> = {
  user: ["id", "discord_id", "role", "totp"],
  passport: [
    "id", "owner_id", "version", "surname", "name",
    "date_of_birth", "date_of_issue", "place_of_origin",
    "secret", "activated", "ceremony_time",
  ],
  ceremonies: ["ceremony_time", "total_slots", "open_registration"],
  auth_grant: [
    "id", "owner_id", "redirect_uri", "until",
    "scope", "client_id", "code",
  ],
  auth_token: ["id", "grant_id", "token", "until"],
  auth_session: ["id", "token", "until", "owner_id"],
  oauth_client: [
    "id", "client_id", "client_secret", "owner_id",
    "default_scope", "name", "created_at", "redirect_uris",
  ],
};

// ── INSERT parsing ───────────────────────────────────────────────────

interface ParsedInsert {
  table: string;
  columns: string[];
  values: string[];
}

function parseInsert(line: string): ParsedInsert | null {
  // Try named columns first: INSERT INTO table (col1, col2) VALUES (...);
  const namedMatch = line.match(
    /^INSERT\s+INTO\s+(\S+)\s*\(([^)]+)\)\s*VALUES\s*(\(.+\))\s*;?\s*$/i,
  );
  if (namedMatch) {
    const table = normalizeTableName(namedMatch[1]);
    const columns = namedMatch[2].split(",").map((c) => c.trim().replace(/"/g, ""));
    const values = parseValues(namedMatch[3]);
    return { table, columns, values };
  }

  // Positional: INSERT INTO public."table" VALUES (...);
  const positionalMatch = line.match(
    /^INSERT\s+INTO\s+(\S+)\s+VALUES\s*(\(.+\))\s*;?\s*$/i,
  );
  if (positionalMatch) {
    const table = normalizeTableName(positionalMatch[1]);
    const columns = tableColumns[table];
    if (!columns) {
      console.warn(`  Warning: no column order defined for "${table}", skipping`);
      return null;
    }
    const values = parseValues(positionalMatch[2]);
    return { table, columns, values };
  }

  return null;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const dump = readFileSync(dumpPath, "utf-8");

  // Create schema
  console.log("Creating tables...");
  for (const sql of createStatements) {
    await client.execute(sql);
  }
  console.log(`  Created ${createStatements.length} tables.`);

  // Parse inserts grouped by table
  const inserts: ParsedInsert[] = [];
  // pg_dump can split long INSERTs across lines, but with --inserts they're one per line
  for (const line of dump.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.toUpperCase().startsWith("INSERT")) continue;
    const parsed = parseInsert(trimmed);
    if (parsed) inserts.push(parsed);
  }

  console.log(`Parsed ${inserts.length} INSERT statements from dump.`);

  // Insert order: respect foreign key dependencies
  const tableOrder = [
    "user",
    "passport",
    "ceremonies",
    "auth_grant",
    "auth_token",
    "auth_session",
    "oauth_client",
  ];

  // Group inserts by table
  const byTable = new Map<string, ParsedInsert[]>();
  for (const ins of inserts) {
    const list = byTable.get(ins.table) ?? [];
    list.push(ins);
    byTable.set(ins.table, list);
  }

  // Process in order
  let totalRows = 0;
  for (const table of tableOrder) {
    const rows = byTable.get(table);
    if (!rows || rows.length === 0) {
      console.log(`  ${table}: 0 rows (skipped)`);
      continue;
    }

    const meta = tableMeta[table];
    if (!meta) {
      console.warn(
        `  Warning: no metadata for table "${table}", skipping ${rows.length} rows`,
      );
      continue;
    }

    // Batch inserts in groups of 50 for performance
    const batchSize = 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const statements = batch.map((row) => {
        const convertedValues = row.columns.map((col, idx) => {
          const colMeta = meta[col];
          if (!colMeta) {
            console.warn(
              `    Warning: unknown column "${col}" in "${table}", passing through`,
            );
            return row.values[idx];
          }
          return convertValue(row.values[idx], colMeta);
        });

        const quotedCols = row.columns.map((c) => `"${c}"`).join(", ");
        return `INSERT INTO "${table}" (${quotedCols}) VALUES (${convertedValues.join(", ")})`;
      });

      await client.batch(statements.map((sql) => ({ sql, args: [] })));
    }

    console.log(`  ${table}: ${rows.length} rows`);
    totalRows += rows.length;
  }

  // Check for tables in dump that we didn't handle
  for (const [table, rows] of byTable) {
    if (!tableOrder.includes(table)) {
      console.warn(
        `  Warning: ${rows.length} rows for unknown table "${table}" were skipped`,
      );
    }
  }

  console.log(`\nDone! Migrated ${totalRows} rows.`);
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});

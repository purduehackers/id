/**
 * Rotate TOTP secrets for all users who have TOTP enabled.
 *
 * Usage:
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... \
 *     bun run scripts/rotate-totp.ts
 *
 * Outputs a JSON array of affected users with their new secrets
 * and otpauth:// URIs for easy QR code generation.
 */

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error("TURSO_DATABASE_URL is required");
  process.exit(1);
}

const client = createClient({ url, authToken });

// Base32 alphabet (RFC 4648)
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function generateBase32Secret(bytes = 20): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  let result = "";
  let bits = 0;
  let value = 0;
  for (const byte of raw) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += BASE32[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    result += BASE32[(value << (5 - bits)) & 0x1f];
  }
  return result;
}

async function main() {
  // Find all users with TOTP enabled
  const rows = await client.execute(
    `SELECT id, discord_id, role, totp FROM "user" WHERE totp IS NOT NULL`,
  );

  if (rows.rows.length === 0) {
    console.log("No users with TOTP enabled.");
    return;
  }

  console.error(`Found ${rows.rows.length} user(s) with TOTP enabled.\n`);

  const results: Array<{
    userId: number;
    discordId: string;
    role: string;
    newSecret: string;
    otpauthUri: string;
  }> = [];

  for (const row of rows.rows) {
    const userId = row.id as number;
    const discordId = row.discord_id as string;
    const role = row.role as string;
    const newSecret = generateBase32Secret();

    await client.execute({
      sql: `UPDATE "user" SET totp = ? WHERE id = ?`,
      args: [newSecret, userId],
    });

    const otpauthUri =
      `otpauth://totp/Purdue%20Hackers:${userId}?secret=${newSecret}&issuer=Purdue%20Hackers&algorithm=SHA1&digits=6&period=30`;

    results.push({ userId, discordId, role, newSecret, otpauthUri });
    console.error(`  Rotated user ${userId} (discord: ${discordId})`);
  }

  console.error("\nDone. New secrets (JSON) printed to stdout.\n");

  // Print JSON to stdout so it can be piped/saved
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});

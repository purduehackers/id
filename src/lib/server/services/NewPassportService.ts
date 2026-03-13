import { Effect } from "effect";
import { eq, desc } from "drizzle-orm";
import { DbService } from "../effect/layers.js";
import { DbError } from "../effect/errors.js";
import { users, passports } from "../db/schema.js";
import { randomAlphanumeric } from "../shared/random.js";

const CURRENT_PASSPORT_VERSION = 1;

export function createPassport(params: {
  discordId: string;
  name: string;
  surname: string;
  dateOfBirth: string;
  dateOfIssue: string;
  placeOfOrigin: string;
  ceremonyTime: string;
}) {
  return Effect.gen(function* () {
    const db = yield* DbService;

    // Find or create user
    const existingUsers = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(users)
          .where(eq(users.discordId, params.discordId))
          .limit(1),
      catch: (e) => new DbError({ cause: e }),
    });

    let user;
    if (existingUsers.length > 0) {
      user = existingUsers[0];
    } else {
      const created = yield* Effect.tryPromise({
        try: () =>
          db
            .insert(users)
            .values({ discordId: params.discordId, role: "hacker" })
            .returning(),
        catch: (e) => new DbError({ cause: e }),
      });
      user = created[0];
    }

    // Check for latest passport
    const latestPassports = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(passports)
          .where(eq(passports.ownerId, user.id))
          .orderBy(desc(passports.id))
          .limit(1),
      catch: (e) => new DbError({ cause: e }),
    });

    const latestPassport = latestPassports[0] ?? null;

    if (latestPassport && !latestPassport.activated) {
      // Update existing unactivated passport
      const updated = yield* Effect.tryPromise({
        try: () =>
          db
            .update(passports)
            .set({
              name: params.name,
              surname: params.surname,
              dateOfBirth: params.dateOfBirth,
              dateOfIssue: params.dateOfIssue,
              placeOfOrigin: params.placeOfOrigin,
              ceremonyTime: new Date(params.ceremonyTime),
            })
            .where(eq(passports.id, latestPassport.id))
            .returning(),
        catch: (e) => new DbError({ cause: e }),
      });
      return { id: updated[0].id };
    }

    // Create new passport
    const created = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(passports)
          .values({
            ownerId: user.id,
            name: params.name,
            surname: params.surname,
            dateOfBirth: params.dateOfBirth,
            dateOfIssue: params.dateOfIssue,
            placeOfOrigin: params.placeOfOrigin,
            ceremonyTime: new Date(params.ceremonyTime),
            version: CURRENT_PASSPORT_VERSION,
            activated: false,
            secret: randomAlphanumeric(32),
          })
          .returning(),
      catch: (e) => new DbError({ cause: e }),
    });

    return { id: created[0].id };
  });
}

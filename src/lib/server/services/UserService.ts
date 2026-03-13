import { Effect } from "effect";
import { eq, desc, and } from "drizzle-orm";
import { DbService } from "../effect/layers.js";
import { DbError, NotFoundError } from "../effect/errors.js";
import { users, passports } from "../db/schema.js";

export function findUserById(id: number) {
  return Effect.gen(function* () {
    const db = yield* DbService;

    const result = yield* Effect.tryPromise({
      try: () => db.select().from(users).where(eq(users.id, id)).limit(1),
      catch: (e) => new DbError({ cause: e }),
    });

    if (result.length === 0) {
      return yield* Effect.fail(new NotFoundError({ entity: "User", id }));
    }

    return result[0];
  });
}

export function findUserByDiscordId(discordId: string) {
  return Effect.gen(function* () {
    const db = yield* DbService;

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(users)
          .where(eq(users.discordId, discordId))
          .limit(1),
      catch: (e) => new DbError({ cause: e }),
    });

    return result[0] ?? null;
  });
}

export function createUser(discordId: string) {
  return Effect.gen(function* () {
    const db = yield* DbService;

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(users)
          .values({ discordId, role: "hacker" })
          .returning(),
      catch: (e) => new DbError({ cause: e }),
    });

    return result[0];
  });
}

export function getUserWithPassport(userId: number) {
  return Effect.gen(function* () {
    const db = yield* DbService;
    const user = yield* findUserById(userId);

    const latestPassport = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(passports)
          .where(eq(passports.ownerId, userId))
          .orderBy(desc(passports.id))
          .limit(1),
      catch: (e) => new DbError({ cause: e }),
    });

    return {
      iss: "https://id.purduehackers.com",
      sub: user.id,
      id: user.id,
      discord_id: user.discordId,
      role: user.role,
      latest_passport: latestPassport[0]
        ? {
            id: latestPassport[0].id,
            version: latestPassport[0].version,
            surname: latestPassport[0].surname,
            name: latestPassport[0].name,
            dateOfBirth: latestPassport[0].dateOfBirth,
            dateOfIssue: latestPassport[0].dateOfIssue,
            placeOfOrigin: latestPassport[0].placeOfOrigin,
          }
        : null,
    };
  });
}

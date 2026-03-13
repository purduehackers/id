import { Effect } from "effect";
import { eq, and, ne } from "drizzle-orm";
import { DbService } from "../effect/layers.js";
import { DbError, NotFoundError } from "../effect/errors.js";
import { passports } from "../db/schema.js";

export function listAllPassports() {
  return Effect.gen(function* () {
    const db = yield* DbService;

    return yield* Effect.tryPromise({
      try: () => db.select().from(passports),
      catch: (e) => new DbError({ cause: e }),
    });
  });
}

export function activatePassport(passportId: number) {
  return Effect.gen(function* () {
    const db = yield* DbService;

    const results = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(passports)
          .where(eq(passports.id, passportId))
          .limit(1),
      catch: (e) => new DbError({ cause: e }),
    });

    if (results.length === 0) {
      return yield* Effect.fail(
        new NotFoundError({ entity: "Passport", id: passportId }),
      );
    }

    const passport = results[0];

    // Deactivate all other passports for this owner
    yield* Effect.tryPromise({
      try: () =>
        db
          .update(passports)
          .set({ activated: false })
          .where(
            and(
              eq(passports.ownerId, passport.ownerId),
              ne(passports.id, passportId),
            ),
          ),
      catch: (e) => new DbError({ cause: e }),
    });

    // Activate the target passport
    yield* Effect.tryPromise({
      try: () =>
        db
          .update(passports)
          .set({ activated: true })
          .where(eq(passports.id, passportId)),
      catch: (e) => new DbError({ cause: e }),
    });
  });
}

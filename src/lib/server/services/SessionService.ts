import { Effect } from "effect";
import { and, eq, gte, lte } from "drizzle-orm";
import { DbService } from "../effect/layers.js";
import { DbError, UnauthorizedError } from "../effect/errors.js";
import { authSessions } from "../db/schema.js";
import { randomAlphanumeric } from "../shared/random.js";

export function validateSession(token: string) {
  return Effect.gen(function* () {
    const db = yield* DbService;
    const now = new Date();

    const sessions = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(authSessions)
          .where(
            and(
              eq(authSessions.token, token),
              gte(authSessions.until, now),
            ),
          )
          .limit(1),
      catch: (e) => new DbError({ cause: e }),
    });

    if (sessions.length === 0) {
      return yield* Effect.fail(new UnauthorizedError({ message: "Invalid or expired session" }));
    }

    return sessions[0];
  });
}

export function createSession(ownerId: number) {
  return Effect.gen(function* () {
    const db = yield* DbService;
    const token = randomAlphanumeric(32);
    const until = new Date();
    until.setMonth(until.getMonth() + 2);

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(authSessions)
          .values({ token, until, ownerId })
          .returning(),
      catch: (e) => new DbError({ cause: e }),
    });

    return result[0];
  });
}

export function deleteSession(token: string) {
  return Effect.gen(function* () {
    const db = yield* DbService;

    yield* Effect.tryPromise({
      try: () =>
        db.delete(authSessions).where(eq(authSessions.token, token)),
      catch: (e) => new DbError({ cause: e }),
    });
  });
}

export function deleteSessionsByOwner(ownerId: number) {
  return Effect.gen(function* () {
    const db = yield* DbService;

    yield* Effect.tryPromise({
      try: () =>
        db.delete(authSessions).where(eq(authSessions.ownerId, ownerId)),
      catch: (e) => new DbError({ cause: e }),
    });
  });
}

export function purgeExpiredSessions() {
  return Effect.gen(function* () {
    const db = yield* DbService;
    const now = new Date();

    yield* Effect.tryPromise({
      try: () =>
        db.delete(authSessions).where(
          lte(authSessions.until, now),
        ),
      catch: (e) => new DbError({ cause: e }),
    });
  });
}

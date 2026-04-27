import { Effect } from "effect";
import { eq, and, desc } from "drizzle-orm";
import { DbService, KvService } from "../effect/layers.js";
import {
  DbError,
  KvError,
  NotFoundError,
  BadRequestError,
  PassportDisabledError,
  UnauthorizedError,
} from "../effect/errors.js";
import { passports } from "../db/schema.js";
import { findUserById } from "./UserService.js";

export function findPassportById(id: number) {
  return Effect.gen(function* () {
    const db = yield* DbService;

    const result = yield* Effect.tryPromise({
      try: () => db.select().from(passports).where(eq(passports.id, id)).limit(1),
      catch: (e) => new DbError({ cause: e }),
    });

    if (result.length === 0) {
      return yield* Effect.fail(new NotFoundError({ entity: "Passport", id }));
    }

    return result[0];
  });
}

export function getLatestActivatedPassport(ownerId: number) {
  return Effect.gen(function* () {
    const db = yield* DbService;

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(passports)
          .where(
            and(eq(passports.ownerId, ownerId), eq(passports.activated, true)),
          )
          .orderBy(desc(passports.id))
          .limit(1),
      catch: (e) => new DbError({ cause: e }),
    });

    return result[0] ?? null;
  });
}

/** Phase 1: User enters passport number -> set KV false with 90s TTL */
export function initiateScan(passportId: number) {
  return Effect.gen(function* () {
    const kvClient = yield* KvService;

    const passport = yield* findPassportById(passportId);

    if (!passport.activated) {
      return yield* Effect.fail(
        new PassportDisabledError({ passportId }),
      );
    }

    const exists = yield* Effect.tryPromise({
      try: () => kvClient.exists(String(passportId)),
      catch: (e) => new KvError({ cause: e }),
    });

    if (!exists) {
      yield* Effect.tryPromise({
        try: () => kvClient.set(String(passportId), "false", "EX", 90),
        catch: (e) => new KvError({ cause: e }),
      });
      return;
    }

    return yield* Effect.fail(
      new BadRequestError({ message: "Scan already in progress" }),
    );
  });
}

/** Phase 2: NFC scan with correct secret -> set KV true with 60s TTL */
export function completeScan(passportId: number, secret: string) {
  return Effect.gen(function* () {
    const kvClient = yield* KvService;

    const passport = yield* findPassportById(passportId);

    if (!passport.activated) {
      return yield* Effect.fail(
        new PassportDisabledError({ passportId }),
      );
    }

    const exists = yield* Effect.tryPromise({
      try: () => kvClient.exists(String(passportId)),
      catch: (e) => new KvError({ cause: e }),
    });

    if (!exists) {
      // No record yet, create initial scan
      yield* Effect.tryPromise({
        try: () => kvClient.set(String(passportId), "false", "EX", 90),
        catch: (e) => new KvError({ cause: e }),
      });
      return;
    }

    const currentValue = yield* Effect.tryPromise({
      try: () => kvClient.get(String(passportId)),
      catch: (e) => new KvError({ cause: e }),
    });

    if (currentValue === "false" && secret === passport.secret) {
      yield* Effect.tryPromise({
        try: () => kvClient.set(String(passportId), "true", "EX", 300),
        catch: (e) => new KvError({ cause: e }),
      });
      return;
    }

    return yield* Effect.fail(
      new BadRequestError({ message: "Invalid scan state or secret" }),
    );
  });
}

/** Check if passport scan is ready (KV value is "true") and return whether TOTP is needed */
export function checkScanReady(passportId: number) {
  return Effect.gen(function* () {
    const kvClient = yield* KvService;

    const exists = yield* Effect.tryPromise({
      try: () => kvClient.exists(String(passportId)),
      catch: (e) => new KvError({ cause: e }),
    });

    if (!exists) {
      return yield* Effect.fail(
        new NotFoundError({ entity: "Scan", id: passportId }),
      );
    }

    const ready = yield* Effect.tryPromise({
      try: () => kvClient.get(String(passportId)),
      catch: (e) => new KvError({ cause: e }),
    });

    if (ready !== "true") {
      return yield* Effect.fail(
        new UnauthorizedError({ message: "Passport not ready" }),
      );
    }

    // Look up user to check if TOTP needed
    const passport = yield* findPassportById(passportId);
    const user = yield* findUserById(passport.ownerId);

    return user.role === "admin";
  });
}

/** Consume the scan atomically */
export function consumeScan(passportId: number) {
  return Effect.gen(function* () {
    const kvClient = yield* KvService;

    const value = yield* Effect.tryPromise({
      try: () => kvClient.getdel(String(passportId)),
      catch: (e) => new KvError({ cause: e }),
    });

    if (value !== "true") {
      return yield* Effect.fail(
        new UnauthorizedError({ message: "Passport not ready for auth" }),
      );
    }
  });
}

export function verifyDoor(passportId: number, secret: string) {
  return Effect.gen(function* () {
    const passport = yield* findPassportById(passportId);

    if (!passport.activated) {
      return yield* Effect.fail(
        new PassportDisabledError({ passportId }),
      );
    }

    if (passport.secret !== secret) {
      return yield* Effect.fail(
        new UnauthorizedError({ message: "Passport secret incorrect" }),
      );
    }
  });
}

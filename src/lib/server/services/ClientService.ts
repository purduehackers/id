import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { DbService } from "../effect/layers.js";
import {
  DbError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "../effect/errors.js";
import { oauthClients } from "../db/schema.js";
import { STATIC_CLIENTS } from "../shared/clients.js";
import { randomAlphanumeric } from "../shared/random.js";

export function getAllClientNames() {
  return Effect.gen(function* () {
    const db = yield* DbService;

    const names: Array<{ id: string; name: string }> = STATIC_CLIENTS.map(
      (c) => ({
        id: c.clientId,
        name: c.name,
      }),
    );

    const dbClients = yield* Effect.tryPromise({
      try: () => db.select().from(oauthClients),
      catch: (e) => new DbError({ cause: e }),
    });

    for (const client of dbClients) {
      if (!names.some((n) => n.id === client.clientId)) {
        names.push({ id: client.clientId, name: client.name });
      }
    }

    return names;
  });
}

export function getClientsByOwner(ownerId: number) {
  return Effect.gen(function* () {
    const db = yield* DbService;

    const clients = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(oauthClients)
          .where(eq(oauthClients.ownerId, ownerId)),
      catch: (e) => new DbError({ cause: e }),
    });

    return clients.map((c) => ({
      id: c.id,
      clientId: c.clientId,
      name: c.name,
      redirectUris: c.redirectUris,
      scopes: c.defaultScope,
      isConfidential: c.clientSecret !== null,
      createdAt: c.createdAt.toISOString(),
    }));
  });
}

export function createClient(
  ownerId: number,
  userRole: string,
  req: {
    name: string;
    redirectUris: string[];
    scopes: string[];
    isConfidential: boolean;
  },
) {
  return Effect.gen(function* () {
    const db = yield* DbService;

    // Validate scopes
    const allowedScopes =
      userRole === "admin"
        ? ["user:read", "user", "admin:read", "admin"]
        : ["user:read", "user"];

    for (const scope of req.scopes) {
      if (!allowedScopes.includes(scope)) {
        return yield* Effect.fail(
          new ForbiddenError({ message: `Scope "${scope}" not allowed` }),
        );
      }
    }

    if (req.redirectUris.length === 0) {
      return yield* Effect.fail(
        new BadRequestError({ message: "At least one redirect URI required" }),
      );
    }

    for (const uri of req.redirectUris) {
      try {
        new URL(uri);
      } catch {
        return yield* Effect.fail(
          new BadRequestError({ message: `Invalid redirect URI: ${uri}` }),
        );
      }
    }

    const clientId = crypto.randomUUID();
    const clientSecret = req.isConfidential
      ? randomAlphanumeric(48)
      : null;
    const scopeStr = req.scopes.join(" ");

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(oauthClients)
          .values({
            clientId,
            clientSecret,
            ownerId,
            redirectUris: req.redirectUris,
            defaultScope: scopeStr,
            name: req.name,
            createdAt: new Date(),
          })
          .returning(),
      catch: (e) => new DbError({ cause: e }),
    });

    const model = result[0];
    return {
      id: model.id,
      clientId: model.clientId,
      name: model.name,
      redirectUris: model.redirectUris,
      scopes: model.defaultScope,
      isConfidential: model.clientSecret !== null,
      createdAt: model.createdAt.toISOString(),
      clientSecret,
    };
  });
}

export function deleteClient(clientId: number, ownerId: number) {
  return Effect.gen(function* () {
    const db = yield* DbService;

    const clients = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(oauthClients)
          .where(eq(oauthClients.id, clientId))
          .limit(1),
      catch: (e) => new DbError({ cause: e }),
    });

    if (clients.length === 0) {
      return yield* Effect.fail(
        new NotFoundError({ entity: "OAuthClient", id: clientId }),
      );
    }

    if (clients[0].ownerId !== ownerId) {
      return yield* Effect.fail(
        new ForbiddenError({ message: "Not your client" }),
      );
    }

    yield* Effect.tryPromise({
      try: () => db.delete(oauthClients).where(eq(oauthClients.id, clientId)),
      catch: (e) => new DbError({ cause: e }),
    });
  });
}

export function updateClientRedirectUris(
  clientId: number,
  ownerId: number,
  redirectUris: string[],
) {
  return Effect.gen(function* () {
    const db = yield* DbService;

    if (redirectUris.length === 0) {
      return yield* Effect.fail(
        new BadRequestError({ message: "At least one redirect URI required" }),
      );
    }

    for (const uri of redirectUris) {
      try {
        new URL(uri);
      } catch {
        return yield* Effect.fail(
          new BadRequestError({ message: `Invalid redirect URI: ${uri}` }),
        );
      }
    }

    const clients = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(oauthClients)
          .where(eq(oauthClients.id, clientId))
          .limit(1),
      catch: (e) => new DbError({ cause: e }),
    });

    if (clients.length === 0) {
      return yield* Effect.fail(
        new NotFoundError({ entity: "OAuthClient", id: clientId }),
      );
    }

    if (clients[0].ownerId !== ownerId) {
      return yield* Effect.fail(
        new ForbiddenError({ message: "Not your client" }),
      );
    }

    yield* Effect.tryPromise({
      try: () =>
        db
          .update(oauthClients)
          .set({ redirectUris })
          .where(eq(oauthClients.id, clientId)),
      catch: (e) => new DbError({ cause: e }),
    });
  });
}

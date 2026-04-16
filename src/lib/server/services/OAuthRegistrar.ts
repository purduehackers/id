import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { DbService } from "../effect/layers.js";
import { DbError, BadRequestError } from "../effect/errors.js";
import { oauthClients } from "../db/schema.js";
import { STATIC_CLIENTS } from "../shared/clients.js";

export interface ResolvedClient {
  clientId: string;
  redirectUris: string[];
  allowedScopes: string;
  clientSecret: string | null;
  name: string;
}

/** Look up a client by ID from static list + DB */
export function resolveClient(clientId: string) {
  return Effect.gen(function* () {
    // Check static clients first
    const staticClient = STATIC_CLIENTS.find((c) => c.clientId === clientId);
    if (staticClient) {
      return {
        clientId: staticClient.clientId,
        redirectUris: [staticClient.url],
        allowedScopes: `${staticClient.scope} auth`,
        clientSecret: null,
        name: staticClient.name,
      } satisfies ResolvedClient;
    }

    // Check DB
    const db = yield* DbService;
    const results = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(oauthClients)
          .where(eq(oauthClients.clientId, clientId))
          .limit(1),
      catch: (e) => new DbError({ cause: e }),
    });

    if (results.length === 0) {
      return yield* Effect.fail(
        new BadRequestError({ message: `Unknown client_id: ${clientId}` }),
      );
    }

    const client = results[0];
    return {
      clientId: client.clientId,
      redirectUris: client.redirectUris,
      allowedScopes: `${client.defaultScope} auth`,
      clientSecret: client.clientSecret,
      name: client.name,
    } satisfies ResolvedClient;
  });
}

/** Validate that a redirect_uri is allowed for a client */
export function validateRedirectUri(
  client: ResolvedClient,
  redirectUri: string,
) {
  return Effect.gen(function* () {
    if (!client.redirectUris.includes(redirectUri)) {
      return yield* Effect.fail(
        new BadRequestError({
          message: `Invalid redirect_uri for client ${client.clientId}`,
        }),
      );
    }
  });
}

/** Validate that requested scopes are a subset of allowed scopes */
export function validateScopes(
  client: ResolvedClient,
  requestedScope: string,
): string {
  const allowed = client.allowedScopes.split(/\s+/).filter((s) => s.length > 0);
  const requested = requestedScope.split(/\s+/).filter((s) => s.length > 0);

  // If no scopes requested, grant all allowed scopes
  const finalScopes =
    requested.length > 0
      ? requested.filter((s) => allowed.includes(s))
      : [...allowed];

  if (!finalScopes.includes("auth")) {
    finalScopes.push("auth");
  }

  return finalScopes.join(" ");
}

/** Check client credentials for confidential clients */
export function checkClientCredentials(
  client: ResolvedClient,
  secret: string | null,
) {
  return Effect.gen(function* () {
    if (client.clientSecret !== null) {
      if (secret !== client.clientSecret) {
        return yield* Effect.fail(
          new BadRequestError({ message: "Invalid client credentials" }),
        );
      }
    }
  });
}

import { Effect } from "effect";
import { recoverAccessToken } from "../../services/OAuthIssuer.js";
import { UnauthorizedError, ForbiddenError } from "../../effect/errors.js";
import { parseScopes, type ScopeValue } from "../../shared/scopes.js";

export interface OAuthUser {
  ownerId: number;
  clientId: string;
  scopes: string[];
}

/** Extract and validate Bearer token, checking required scopes */
export function extractBearerToken(
  authHeader: string | null,
  requiredScopes: ScopeValue[],
) {
  return Effect.gen(function* () {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return yield* Effect.fail(
        new UnauthorizedError({ message: "Missing Bearer token" }),
      );
    }

    const token = authHeader.slice(7);
    const grant = yield* recoverAccessToken(token);

    // Check required scopes
    const grantedScopes = parseScopes(grant.scope);
    for (const required of requiredScopes) {
      if (!grantedScopes.includes(required)) {
        return yield* Effect.fail(
          new ForbiddenError({
            message: `Missing required scope: ${required}`,
          }),
        );
      }
    }

    return {
      ownerId: grant.ownerId,
      clientId: grant.clientId,
      scopes: grantedScopes,
    } satisfies OAuthUser;
  });
}

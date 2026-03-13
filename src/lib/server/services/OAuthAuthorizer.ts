import { Effect } from "effect";
import { JwtService } from "../effect/layers.js";
import { JwtError } from "../effect/errors.js";
import type { TokenClaims } from "../jwt/index.js";

/** Create a JWT-based authorization code (replaces JwtAuthorizer::authorize) */
export function createAuthorizationCode(params: {
  ownerId: number;
  clientId: string;
  scope: string;
  redirectUri: string;
}) {
  return Effect.gen(function* () {
    const jwt = yield* JwtService;

    const until = new Date();
    until.setMinutes(until.getMinutes() + 10); // 10-minute expiry for auth codes

    const claims: TokenClaims = {
      sub: String(params.ownerId),
      exp: Math.floor(until.getTime() / 1000),
      iat: Math.floor(Date.now() / 1000),
      iss: "id-grant",
      aud: params.clientId,
      scope: params.scope,
      redirect_uri: params.redirectUri,
    };

    const token = yield* Effect.tryPromise({
      try: () => jwt.sign(claims),
      catch: (e) => new JwtError({ cause: e }),
    });

    return token;
  });
}

/** Extract and validate a JWT authorization code (replaces JwtAuthorizer::extract) */
export function extractAuthorizationCode(code: string) {
  return Effect.gen(function* () {
    const jwt = yield* JwtService;

    const claims = yield* Effect.tryPromise({
      try: () => jwt.verify(code, "id-grant"),
      catch: (e) => new JwtError({ cause: e }),
    });

    return {
      ownerId: parseInt(claims.sub, 10),
      clientId: claims.aud,
      scope: claims.scope,
      redirectUri: claims.redirect_uri ?? "",
      until: new Date(claims.exp * 1000),
    };
  });
}

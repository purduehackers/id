import { Effect } from "effect";
import { JwtService } from "../effect/layers.js";
import { JwtError } from "../effect/errors.js";
import type { TokenClaims } from "../jwt/index.js";

/** Issue a JWT access token (replaces JwtIssuer::issue) */
export function issueAccessToken(params: {
  ownerId: number;
  clientId: string;
  scope: string;
  redirectUri: string;
}) {
  return Effect.gen(function* () {
    const jwt = yield* JwtService;

    const until = new Date();
    until.setMonth(until.getMonth() + 1); // 1 month expiry

    const claims: TokenClaims = {
      sub: String(params.ownerId),
      exp: Math.floor(until.getTime() / 1000),
      iat: Math.floor(Date.now() / 1000),
      iss: "id",
      aud: params.clientId,
      scope: params.scope,
      redirect_uri: params.redirectUri,
    };

    const token = yield* Effect.tryPromise({
      try: () => jwt.sign(claims),
      catch: (e) => new JwtError({ cause: e }),
    });

    const expiresIn = Math.floor((until.getTime() - Date.now()) / 1000);

    return { token, expiresIn };
  });
}

/** Recover/validate an access token (replaces JwtIssuer::recover_token) */
export function recoverAccessToken(token: string) {
  return Effect.gen(function* () {
    const jwt = yield* JwtService;

    const claims = yield* Effect.tryPromise({
      try: () => jwt.verify(token, "id"),
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

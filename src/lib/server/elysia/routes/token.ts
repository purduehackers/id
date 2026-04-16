import Elysia, { t } from "elysia";
import { Effect } from "effect";
import { runEffect } from "../../effect/runtime.js";
import { extractAuthorizationCode } from "../../services/OAuthAuthorizer.js";
import { issueAccessToken } from "../../services/OAuthIssuer.js";
import { resolveClient, checkClientCredentials } from "../../services/OAuthRegistrar.js";
import { BadRequestError, errorToStatus } from "../../effect/errors.js";

export const tokenRoute = new Elysia().post(
  "/token",
  async ({ body, headers, set }) => {
    const { grant_type, code, redirect_uri, client_id, client_secret } = body;

    if (grant_type !== "authorization_code") {
      set.status = 400;
      return {
        error: "unsupported_grant_type",
        error_description: "Only authorization_code is supported",
      };
    }

    if (!code || !client_id) {
      set.status = 400;
      return {
        error: "invalid_request",
        error_description: "Missing code or client_id",
      };
    }

    try {
      const result = await runEffect(
        Effect.gen(function* () {
          const client = yield* resolveClient(client_id);

          let secret = client_secret ?? null;
          const authHeader = headers.authorization;
          if (authHeader?.startsWith("Basic ")) {
            const decoded = atob(authHeader.slice(6));
            const [, headerSecret] = decoded.split(":");
            if (headerSecret) secret = headerSecret;
          }
          yield* checkClientCredentials(client, secret);

          const grant = yield* extractAuthorizationCode(code);

          if (grant.clientId !== client_id) {
            return yield* Effect.fail(
              new BadRequestError({ message: "Code was not issued to this client" }),
            );
          }

          if (redirect_uri && grant.redirectUri !== redirect_uri) {
            return yield* Effect.fail(
              new BadRequestError({ message: "redirect_uri mismatch" }),
            );
          }

          const token = yield* issueAccessToken({
            ownerId: grant.ownerId,
            clientId: grant.clientId,
            scope: grant.scope,
            redirectUri: grant.redirectUri,
          });

          return token;
        }),
      );

      return {
        access_token: result.token,
        token_type: "bearer",
        expires_in: result.expiresIn,
      };
    } catch (e: any) {
      console.error("Token exchange failed:", e);
      const status = errorToStatus(e);
      set.status = status === 500 ? 500 : 400;
      return {
        error: status === 401 ? "invalid_client" : "invalid_grant",
        error_description: e?.message ?? "Invalid authorization code",
      };
    }
  },
  {
    body: t.Object({
      grant_type: t.String(),
      code: t.Optional(t.String()),
      redirect_uri: t.Optional(t.String()),
      client_id: t.Optional(t.String()),
      client_secret: t.Optional(t.String()),
    }),
    type: "application/x-www-form-urlencoded",
  },
);

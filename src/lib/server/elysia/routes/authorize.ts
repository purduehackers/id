import Elysia, { t } from "elysia";
import { Effect } from "effect";
import { runEffect } from "../../effect/runtime.js";
import {
  resolveClient,
  validateRedirectUri,
  validateScopes,
} from "../../services/OAuthRegistrar.js";
import { createAuthorizationCode } from "../../services/OAuthAuthorizer.js";
import { createSession, validateSession, purgeExpiredSessions } from "../../services/SessionService.js";
import { consumeScan, findPassportById } from "../../services/PassportService.js";
import { findUserById } from "../../services/UserService.js";
import { validateTotp } from "../../services/TotpService.js";
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "../../effect/errors.js";

export const authorizeRoute = new Elysia()
  .get(
    "/authorize",
    async ({ query, set }) => {
      const { client_id, redirect_uri, scope, response_type, state } = query;

      if (response_type !== "code") {
        set.status = 400;
        return { error: "unsupported_response_type" };
      }

      if (!client_id || !redirect_uri) {
        set.status = 400;
        return { error: "invalid_request", error_description: "Missing client_id or redirect_uri" };
      }

      try {
        const client = await runEffect(resolveClient(client_id));
        await runEffect(validateRedirectUri(client, redirect_uri));
        const validatedScope = validateScopes(client, scope ?? "");

        const params = new URLSearchParams({
          client_id,
          redirect_uri,
          scope: validatedScope,
          response_type: "code",
        });
        if (state) params.set("state", state);

        set.redirect = `https://id.purduehackers.com/authorize?${params.toString()}`;
      } catch (e: any) {
        if (redirect_uri) {
          const errorUrl = new URL(redirect_uri);
          errorUrl.searchParams.set("error", "invalid_request");
          errorUrl.searchParams.set("error_description", e?.message ?? "Invalid request");
          if (state) errorUrl.searchParams.set("state", state);
          set.redirect = errorUrl.toString();
        } else {
          set.status = 400;
          return { error: "invalid_request", error_description: e?.message };
        }
      }
    },
    {
      query: t.Object({
        client_id: t.Optional(t.String()),
        redirect_uri: t.Optional(t.String()),
        scope: t.Optional(t.String()),
        response_type: t.Optional(t.String()),
        state: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/authorize",
    async ({ query, cookie, set }) => {
      const {
        client_id,
        redirect_uri,
        scope,
        state,
        allow,
        id: passportIdStr,
        code: totpCode,
      } = query;

      if (!client_id || !redirect_uri) {
        set.status = 400;
        return { error: "invalid_request" };
      }

      const userWantsAllow = allow === "true";

      if (!userWantsAllow) {
        const errorUrl = new URL(redirect_uri);
        errorUrl.searchParams.set("error", "access_denied");
        if (state) errorUrl.searchParams.set("state", state);
        set.redirect = errorUrl.toString();
        return;
      }

      try {
        const result = await runEffect(
          Effect.gen(function* () {
            const client = yield* resolveClient(client_id);
            yield* validateRedirectUri(client, redirect_uri);
            const validatedScope = validateScopes(client, scope ?? "");

            let ownerId: number;

            // Check for session cookie first
            const sessionToken = cookie?.session?.value as string | undefined;
            if (sessionToken) {
              const sessionResult = yield* Effect.either(validateSession(sessionToken));
              if (sessionResult._tag === "Right") {
                ownerId = sessionResult.right.ownerId;
              } else {
                ownerId = yield* authorizeViaPassport(passportIdStr, totpCode, validatedScope);
              }
            } else {
              ownerId = yield* authorizeViaPassport(passportIdStr, totpCode, validatedScope);
            }

            const code = yield* createAuthorizationCode({
              ownerId,
              clientId: client_id,
              scope: validatedScope,
              redirectUri: redirect_uri,
            });

            const session = yield* createSession(ownerId);
            yield* purgeExpiredSessions();

            return { code, sessionToken: session.token, ownerId };
          }),
        );

        cookie.session.set({
          value: result.sessionToken,
          maxAge: 5259492,
          secure: true,
          httpOnly: true,
          path: "/",
        });

        const successUrl = new URL(redirect_uri);
        successUrl.searchParams.set("code", result.code);
        if (state) successUrl.searchParams.set("state", state);
        set.redirect = successUrl.toString();
      } catch (e: any) {
        const errorUrl = new URL(redirect_uri);
        errorUrl.searchParams.set("error", "server_error");
        errorUrl.searchParams.set("error_description", e?.message ?? "Authorization failed");
        if (state) errorUrl.searchParams.set("state", state);
        set.redirect = errorUrl.toString();
      }
    },
    {
      query: t.Object({
        client_id: t.Optional(t.String()),
        redirect_uri: t.Optional(t.String()),
        scope: t.Optional(t.String()),
        response_type: t.Optional(t.String()),
        state: t.Optional(t.String()),
        allow: t.Optional(t.String()),
        id: t.Optional(t.String()),
        code: t.Optional(t.String()),
      }),
    },
  );

function authorizeViaPassport(
  passportIdStr: string | undefined,
  totpCode: string | undefined,
  scope: string,
) {
  return Effect.gen(function* () {
    if (!passportIdStr) {
      return yield* Effect.fail(
        new BadRequestError({ message: "Passport ID required" }),
      );
    }

    const passportId = parseInt(passportIdStr, 10);
    if (isNaN(passportId)) {
      return yield* Effect.fail(
        new BadRequestError({ message: "Invalid passport ID" }),
      );
    }

    yield* consumeScan(passportId);

    const passport = yield* findPassportById(passportId);
    const user = yield* findUserById(passport.ownerId);

    const requestedScopes = scope.split(/\s+/);
    if (
      requestedScopes.some((s) => s.startsWith("admin")) &&
      user.role !== "admin"
    ) {
      return yield* Effect.fail(
        new ForbiddenError({ message: "You may not access administrator scopes!" }),
      );
    }

    if (user.totp) {
      if (!totpCode) {
        return yield* Effect.fail(
          new BadRequestError({ message: "TOTP code required" }),
        );
      }
      const valid = yield* validateTotp(user.id, user.totp, totpCode);
      if (!valid) {
        return yield* Effect.fail(
          new UnauthorizedError({ message: "Invalid TOTP code!" }),
        );
      }
    } else if (user.role === "admin") {
      return yield* Effect.fail(
        new UnauthorizedError({ message: "Admin login attempted without TOTP!" }),
      );
    }

    return user.id;
  });
}

import Elysia from "elysia";
import { Effect } from "effect";
import { runRoute } from "../../effect/runtime.js";
import { extractBearerToken } from "../middleware/oauth.js";
import { getUserWithPassport } from "../../services/UserService.js";
import { SCOPES } from "../../shared/scopes.js";

export const userRoute = new Elysia().get(
  "/user",
  async ({ headers, set }) => {
    const result = await runRoute(
      Effect.gen(function* () {
        const oauthUser = yield* extractBearerToken(
          headers.authorization ?? null,
          [SCOPES.USER_READ],
        );
        return yield* getUserWithPassport(oauthUser.ownerId);
      }),
    );
    if (!result.ok) {
      set.status = result.status;
      return { error: result.error };
    }
    return result.data;
  },
);

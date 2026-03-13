import Elysia from "elysia";
import { runEffect } from "../../effect/runtime.js";
import { extractBearerToken } from "../middleware/oauth.js";
import { getUserWithPassport } from "../../services/UserService.js";
import { SCOPES } from "../../shared/scopes.js";

export const userRoute = new Elysia().get(
  "/user",
  async ({ headers, set }) => {
    try {
      const oauthUser = await runEffect(
        extractBearerToken(headers.authorization ?? null, [SCOPES.USER_READ]),
      );

      const result = await runEffect(getUserWithPassport(oauthUser.ownerId));
      return result;
    } catch (e: any) {
      set.status = e?._tag === "UnauthorizedError" ? 401 : 500;
      return { error: e?.message ?? "Failed to get user" };
    }
  },
);

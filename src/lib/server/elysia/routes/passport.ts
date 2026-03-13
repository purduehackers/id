import Elysia from "elysia";
import { runEffect } from "../../effect/runtime.js";
import { extractBearerToken } from "../middleware/oauth.js";
import { listAllPassports } from "../../services/AdminPassportService.js";
import { SCOPES } from "../../shared/scopes.js";

export const passportRoute = new Elysia().get(
  "/passport",
  async ({ headers, set }) => {
    try {
      await runEffect(
        extractBearerToken(headers.authorization ?? null, [SCOPES.ADMIN_READ]),
      );

      const passports = await runEffect(listAllPassports());
      return passports;
    } catch (e: any) {
      set.status = e?._tag === "UnauthorizedError" ? 401 : 500;
      return { error: e?.message ?? "Failed to list passports" };
    }
  },
);

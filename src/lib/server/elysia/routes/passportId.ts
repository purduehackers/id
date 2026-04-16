import Elysia, { t } from "elysia";
import { runEffect } from "../../effect/runtime.js";
import { extractBearerToken } from "../middleware/oauth.js";
import { activatePassport } from "../../services/AdminPassportService.js";
import { errorToStatus, errorMessage } from "../../effect/errors.js";
import { SCOPES } from "../../shared/scopes.js";

export const passportIdRoute = new Elysia().post(
  "/passport/:id",
  async ({ params, headers, set }) => {
    try {
      await runEffect(
        extractBearerToken(headers.authorization ?? null, [SCOPES.ADMIN]),
      );

      const id = parseInt(params.id, 10);
      if (isNaN(id)) {
        set.status = 400;
        return { error: "Invalid passport ID" };
      }

      await runEffect(activatePassport(id));
      set.status = 200;
      return;
    } catch (e: any) {
      set.status = errorToStatus(e);
      return { error: errorMessage(e) };
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
  },
);

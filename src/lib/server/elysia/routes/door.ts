import Elysia, { t } from "elysia";
import { runEffect } from "../../effect/runtime.js";
import { verifyDoor } from "../../services/PassportService.js";
import { errorToStatus, errorMessage } from "../../effect/errors.js";

export const doorRoute = new Elysia().post(
  "/door",
  async ({ body, set }) => {
    try {
      await runEffect(verifyDoor(body.id, body.secret));
      set.status = 200;
      return "";
    } catch (e: any) {
      set.status = errorToStatus(e);
      return errorMessage(e);
    }
  },
  {
    body: t.Object({
      id: t.Number(),
      secret: t.String(),
    }),
  },
);

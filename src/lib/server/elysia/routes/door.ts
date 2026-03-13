import Elysia, { t } from "elysia";
import { runEffect } from "../../effect/runtime.js";
import { verifyDoor } from "../../services/PassportService.js";

export const doorRoute = new Elysia().post(
  "/door",
  async ({ body, set }) => {
    try {
      await runEffect(verifyDoor(body.id, body.secret));
      set.status = 200;
      return "";
    } catch (e: any) {
      const tag = e?._tag;
      if (tag === "NotFoundError") {
        set.status = 404;
        return "Passport does not exist";
      }
      if (tag === "PassportDisabledError") {
        set.status = 403;
        return "Passport disabled";
      }
      if (tag === "UnauthorizedError") {
        set.status = 401;
        return "Passport secret incorrect";
      }
      set.status = 500;
      return "Internal server error";
    }
  },
  {
    body: t.Object({
      id: t.Number(),
      secret: t.String(),
    }),
  },
);

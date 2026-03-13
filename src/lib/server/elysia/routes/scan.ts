import Elysia, { t } from "elysia";
import { runEffect } from "../../effect/runtime.js";
import { completeScan, checkScanReady } from "../../services/PassportService.js";

export const scanRoute = new Elysia().post(
  "/scan",
  async ({ body, set }) => {
    try {
      await runEffect(completeScan(body.id, body.secret));
      set.status = 200;
      return;
    } catch (e: any) {
      const tag = e?._tag;
      if (tag === "NotFoundError") {
        set.status = 404;
        return { error: "Passport not found" };
      }
      if (tag === "PassportDisabledError") {
        set.status = 403;
        return { error: "Passport disabled" };
      }
      if (tag === "BadRequestError") {
        set.status = 400;
        return { error: e.message };
      }
      set.status = 500;
      return { error: "Internal server error" };
    }
  },
  {
    body: t.Object({
      id: t.Number(),
      secret: t.String(),
    }),
  },
);

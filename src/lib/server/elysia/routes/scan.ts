import Elysia, { t } from "elysia";
import { runEffect } from "../../effect/runtime.js";
import { completeScan, checkScanReady } from "../../services/PassportService.js";
import { errorToStatus, errorMessage } from "../../effect/errors.js";

export const scanRoute = new Elysia().post(
  "/scan",
  async ({ body, set }) => {
    try {
      await runEffect(completeScan(body.id, body.secret));
      set.status = 200;
      return;
    } catch (e: any) {
      set.status = errorToStatus(e);
      return { error: errorMessage(e) };
    }
  },
  {
    body: t.Object({
      id: t.Number(),
      secret: t.String(),
    }),
  },
);

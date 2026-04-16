import Elysia, { t } from "elysia";
import { runRoute } from "../../effect/runtime.js";
import { completeScan, checkScanReady } from "../../services/PassportService.js";

export const scanRoute = new Elysia().post(
  "/scan",
  async ({ body, set }) => {
    const result = await runRoute(completeScan(body.id, body.secret));
    if (!result.ok) {
      set.status = result.status;
      return { error: result.error };
    }
    set.status = 200;
  },
  {
    body: t.Object({
      id: t.Number(),
      secret: t.String(),
    }),
  },
);

import Elysia, { t } from "elysia";
import { runRoute } from "../../effect/runtime.js";
import { verifyDoor } from "../../services/PassportService.js";

export const doorRoute = new Elysia().post(
  "/door",
  async ({ body, set }) => {
    const result = await runRoute(verifyDoor(body.id, body.secret));
    if (!result.ok) {
      set.status = result.status;
      return result.error;
    }
    set.status = 200;
    return "";
  },
  {
    body: t.Object({
      id: t.Number(),
      secret: t.String(),
    }),
  },
);

import Elysia from "elysia";
import { Effect } from "effect";
import { runRoute } from "../../effect/runtime.js";
import { extractBearerToken } from "../middleware/oauth.js";
import { listAllPassports } from "../../services/AdminPassportService.js";
import { SCOPES } from "../../shared/scopes.js";

export const passportRoute = new Elysia().get(
  "/passport",
  async ({ headers, set }) => {
    const result = await runRoute(
      Effect.gen(function* () {
        yield* extractBearerToken(headers.authorization ?? null, [
          SCOPES.ADMIN_READ,
        ]);
        return yield* listAllPassports();
      }),
    );
    if (!result.ok) {
      set.status = result.status;
      return { error: result.error };
    }
    return result.data;
  },
);

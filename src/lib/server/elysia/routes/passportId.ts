import Elysia, { t } from "elysia";
import { Effect } from "effect";
import { runRoute } from "../../effect/runtime.js";
import { extractBearerToken } from "../middleware/oauth.js";
import { activatePassport } from "../../services/AdminPassportService.js";
import { BadRequestError } from "../../effect/errors.js";
import { SCOPES } from "../../shared/scopes.js";

export const passportIdRoute = new Elysia().post(
  "/passport/:id",
  async ({ params, headers, set }) => {
    const result = await runRoute(
      Effect.gen(function* () {
        yield* extractBearerToken(headers.authorization ?? null, [
          SCOPES.ADMIN,
        ]);

        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
          return yield* Effect.fail(
            new BadRequestError({ message: "Invalid passport ID" }),
          );
        }

        yield* activatePassport(id);
      }),
    );
    if (!result.ok) {
      set.status = result.status;
      return { error: result.error };
    }
    set.status = 200;
  },
  {
    params: t.Object({
      id: t.String(),
    }),
  },
);

import Elysia, { t } from "elysia";
import { runRoute } from "../../effect/runtime.js";
import { createPassport } from "../../services/NewPassportService.js";

export const newRoute = new Elysia().post(
  "/new",
  async ({ body, set }) => {
    const result = await runRoute(
      createPassport({
        discordId: body.discord_id,
        name: body.name,
        surname: body.surname,
        dateOfBirth: body.date_of_birth,
        dateOfIssue: body.date_of_issue,
        placeOfOrigin: body.place_of_origin,
        ceremonyTime: body.ceremony_time,
      }),
    );
    if (!result.ok) {
      set.status = result.status;
      return { error: result.error };
    }
    return result.data;
  },
  {
    body: t.Object({
      discord_id: t.String(),
      name: t.String(),
      surname: t.String(),
      date_of_birth: t.String(),
      date_of_issue: t.String(),
      place_of_origin: t.String(),
      ceremony_time: t.String(),
    }),
  },
);

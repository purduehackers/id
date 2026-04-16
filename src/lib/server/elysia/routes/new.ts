import Elysia, { t } from "elysia";
import { runEffect } from "../../effect/runtime.js";
import { createPassport } from "../../services/NewPassportService.js";
import { errorToStatus, errorMessage } from "../../effect/errors.js";

export const newRoute = new Elysia().post(
  "/new",
  async ({ body, set }) => {
    try {
      const result = await runEffect(
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
      return result;
    } catch (e: any) {
      set.status = errorToStatus(e);
      return { error: errorMessage(e) };
    }
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

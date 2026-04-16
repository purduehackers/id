import { elysiaApp } from "$lib/server/elysia/index.js";
import { errorToStatus, errorMessage } from "$lib/server/effect/errors.js";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith("/api/")) {
    try {
      const response = await elysiaApp.handle(event.request);
      if (response) return response;
    } catch (e) {
      console.error("Elysia handle error:", e);
      const status = errorToStatus(e);
      return new Response(JSON.stringify({ error: errorMessage(e) }), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("Not Found", { status: 404 });
  }
  return resolve(event);
};

import { elysiaApp } from "$lib/server/elysia/index.js";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith("/api/")) {
    try {
      const response = await elysiaApp.handle(event.request);
      if (response) return response;
    } catch (e) {
      console.error("Elysia handle error:", e);
    }
    return new Response("Not Found", { status: 404 });
  }
  return resolve(event);
};

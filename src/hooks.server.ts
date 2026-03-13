import { elysiaApp } from "$lib/server/elysia/index.js";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith("/api/")) {
    const response = await elysiaApp.handle(event.request);
    return response;
  }
  return resolve(event);
};

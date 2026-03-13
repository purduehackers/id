import type { PageServerLoad } from "./$types.js";
import { runEffect } from "$lib/server/effect/runtime.js";
import { deleteSession } from "$lib/server/services/SessionService.js";

export const load: PageServerLoad = async ({ cookies }) => {
  const sessionToken = cookies.get("session");

  if (sessionToken) {
    try {
      await runEffect(deleteSession(sessionToken));
    } catch {
      // ignore errors during logout
    }
  }

  cookies.set("session", "", {
    maxAge: 0,
    secure: true,
    httpOnly: true,
    path: "/",
  });

  return { loggedOut: true };
};

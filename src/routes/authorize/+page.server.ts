import type { PageServerLoad } from "./$types.js";
import { runEffect } from "$lib/server/effect/runtime.js";
import { getAllClientNames } from "$lib/server/services/ClientService.js";
import { checkScanReady, completeScan, initiateScan } from "$lib/server/services/PassportService.js";
import { validateSession } from "$lib/server/services/SessionService.js";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ url, cookies }) => {
  const clientId = url.searchParams.get("client_id") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const scope = url.searchParams.get("scope") ?? "";
  const responseType = url.searchParams.get("response_type") ?? "code";
  const state = url.searchParams.get("state") ?? "";
  const hasSession = url.searchParams.get("session") === "true";

  let clientNames: Array<{ id: string; name: string }> = [];
  try {
    clientNames = await runEffect(getAllClientNames());
  } catch {
    // fallback to empty
  }

  // Check if user has a valid session cookie
  let sessionValid = false;
  const sessionToken = cookies.get("session");
  if (sessionToken) {
    try {
      await runEffect(validateSession(sessionToken));
      sessionValid = true;
    } catch {
      // invalid session
    }
  }

  return {
    clientId,
    redirectUri,
    scope,
    responseType,
    state,
    hasSession: hasSession || sessionValid,
    clientNames,
  };
};

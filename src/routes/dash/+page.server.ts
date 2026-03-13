import type { Actions, PageServerLoad } from "./$types.js";
import { runEffect } from "$lib/server/effect/runtime.js";
import { validateSession } from "$lib/server/services/SessionService.js";
import { findUserById } from "$lib/server/services/UserService.js";
import { getLatestActivatedPassport } from "$lib/server/services/PassportService.js";
import {
  getClientsByOwner,
  createClient,
  deleteClient,
  updateClientRedirectUris,
} from "$lib/server/services/ClientService.js";
import { fail } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ cookies }) => {
  const sessionToken = cookies.get("session");
  if (!sessionToken) {
    return { user: null, clients: [] };
  }

  try {
    const session = await runEffect(validateSession(sessionToken));
    const user = await runEffect(findUserById(session.ownerId));
    const passport = await runEffect(
      getLatestActivatedPassport(session.ownerId),
    );
    const clients = await runEffect(getClientsByOwner(session.ownerId));

    return {
      user: {
        id: user.id,
        discordId: user.discordId.toString(),
        role: user.role,
        name: passport ? `${passport.name} ${passport.surname}` : null,
      },
      clients,
    };
  } catch {
    return { user: null, clients: [] };
  }
};

export const actions: Actions = {
  create: async ({ request, cookies }) => {
    const sessionToken = cookies.get("session");
    if (!sessionToken) return fail(401, { error: "Not authenticated" });

    let session;
    try {
      session = await runEffect(validateSession(sessionToken));
    } catch {
      return fail(401, { error: "Invalid session" });
    }

    const user = await runEffect(findUserById(session.ownerId));
    const formData = await request.formData();

    const name = formData.get("name") as string;
    const redirectUrisRaw = formData.get("redirectUris") as string;
    const scopesRaw = formData.get("scopes") as string;
    const isConfidential = formData.get("isConfidential") === "true";

    if (!name || !redirectUrisRaw || !scopesRaw) {
      return fail(400, { error: "Missing fields" });
    }

    try {
      const result = await runEffect(
        createClient(session.ownerId, user.role, {
          name,
          redirectUris: JSON.parse(redirectUrisRaw),
          scopes: JSON.parse(scopesRaw),
          isConfidential,
        }),
      );
      return { created: result };
    } catch (e: any) {
      return fail(400, { error: e?.message ?? "Failed to create client" });
    }
  },

  delete: async ({ request, cookies }) => {
    const sessionToken = cookies.get("session");
    if (!sessionToken) return fail(401, { error: "Not authenticated" });

    let session;
    try {
      session = await runEffect(validateSession(sessionToken));
    } catch {
      return fail(401, { error: "Invalid session" });
    }

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string, 10);

    try {
      await runEffect(deleteClient(id, session.ownerId));
      return { deleted: true };
    } catch (e: any) {
      return fail(400, { error: e?.message ?? "Failed to delete client" });
    }
  },

  updateUris: async ({ request, cookies }) => {
    const sessionToken = cookies.get("session");
    if (!sessionToken) return fail(401, { error: "Not authenticated" });

    let session;
    try {
      session = await runEffect(validateSession(sessionToken));
    } catch {
      return fail(401, { error: "Invalid session" });
    }

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string, 10);
    const urisRaw = formData.get("redirectUris") as string;

    try {
      await runEffect(
        updateClientRedirectUris(id, session.ownerId, JSON.parse(urisRaw)),
      );
      return { updated: true };
    } catch (e: any) {
      return fail(400, { error: e?.message ?? "Failed to update URIs" });
    }
  },
};

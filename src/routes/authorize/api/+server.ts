import { json, type RequestHandler } from "@sveltejs/kit";
import { runEffect } from "$lib/server/effect/runtime.js";
import { completeScan, checkScanReady } from "$lib/server/services/PassportService.js";

/** POST /authorize/api - called from the client to submit passport scan */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { id, secret } = body;

  try {
    await runEffect(completeScan(id, secret));
    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "Scan failed" }, { status: 400 });
  }
};

/** GET /authorize/api?id=N - poll scan status */
export const GET: RequestHandler = async ({ url }) => {
  const idStr = url.searchParams.get("id");
  if (!idStr) {
    return json({ error: "Missing id" }, { status: 400 });
  }

  const id = parseInt(idStr, 10);
  try {
    const totpNeeded = await runEffect(checkScanReady(id));
    return json({ ready: true, totpNeeded });
  } catch {
    return json({ ready: false });
  }
};

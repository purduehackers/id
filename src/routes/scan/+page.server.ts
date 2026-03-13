import type { PageServerLoad } from "./$types.js";
import { runEffect } from "$lib/server/effect/runtime.js";
import { completeScan } from "$lib/server/services/PassportService.js";

export const load: PageServerLoad = async ({ url }) => {
  const idStr = url.searchParams.get("id");
  const secret = url.searchParams.get("secret") ?? "";

  if (!idStr) {
    return { status: "error" as const, message: "Missing passport ID" };
  }

  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return { status: "error" as const, message: "Invalid passport ID" };
  }

  try {
    await runEffect(completeScan(id, secret));
    return { status: "success" as const };
  } catch (e: any) {
    return { status: "error" as const, message: e?.message ?? "Scan failed" };
  }
};

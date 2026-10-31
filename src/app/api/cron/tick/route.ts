import { adminDb } from "@/server/ctx";
import { catchUpRecurringAll, runTick, verifyCronSecret } from "@/server/tick";
import { recordTickHeartbeat } from "@/server/status";

// Called every 5 minutes by Supabase pg_cron (see supabase/migrations).

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const presented = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  if (!(await verifyCronSecret(adminDb(), presented))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await runTick();
  // Missed recurring tasks move to their latest occurrence.
  await catchUpRecurringAll().catch((e) => result.errors.push(e instanceof Error ? e.message : String(e)));
  await recordTickHeartbeat(adminDb(), result).catch(() => {});
  if (result.errors.length) console.error("[tick]", result.errors);
  return Response.json(result);
}

export const GET = POST;

import { getRuntime, MissingConfigError } from "@/lib/debate-engine/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/debates/[id]">,
) {
  const { id } = await ctx.params;
  try {
    const debate = getRuntime().store.get(id);
    if (!debate) {
      return Response.json({ error: "Debate not found" }, { status: 404 });
    }
    return Response.json({ debate });
  } catch (error) {
    if (error instanceof MissingConfigError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    console.error("[api] failed to load debate:", error);
    return Response.json({ error: "Failed to load debate" }, { status: 500 });
  }
}

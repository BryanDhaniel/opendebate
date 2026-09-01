import { getRuntime, MissingConfigError } from "@/lib/debate-engine/runtime";
import { LIMITS, MODELS } from "@/lib/config";
import { sanitizeTopic } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = sanitizeTopic(
    (body as { topic?: unknown } | null)?.topic,
  );
  if (!validation.ok) {
    return Response.json({ error: validation.error }, { status: 422 });
  }

  try {
    const app = getRuntime();
    if (app.store.activeCount() >= LIMITS.maxActiveDebates) {
      return Response.json(
        { error: "Too many active debates. Try again shortly." },
        { status: 429 },
      );
    }
    const debate = await app.store.create({
      topic: validation.topic,
      debaterModel: MODELS.debater,
    });
    return Response.json({ debate }, { status: 201 });
  } catch (error) {
    if (error instanceof MissingConfigError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    console.error("[api] failed to create debate:", error);
    return Response.json({ error: "Failed to create debate" }, { status: 500 });
  }
}

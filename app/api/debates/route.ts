import { getRuntime, MissingConfigError } from "@/lib/debate-engine/runtime";
import { LIMITS, MODELS } from "@/lib/config";
import { sanitizeTopic } from "@/lib/validation";
import { creationRateLimiter, clientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // REVIEW C1: an unauthenticated POST triggers paid LLM work. Guard it with an
  // opt-in shared secret (set OPENDABATE_API_KEY to require it) and a creation
  // rate limit (per-IP + global). Both run before any provider/config touch.
  const apiKey = process.env.OPENDABATE_API_KEY;
  if (apiKey) {
    const header = request.headers.get("authorization");
    const provided =
      header?.startsWith("Bearer ") ? header.slice(7) : request.headers.get("x-api-key");
    if (provided !== apiKey) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const decision = creationRateLimiter.check(clientIp(request));
  if (!decision.allowed) {
    return new Response(
      JSON.stringify({ error: "Too many debates created. Try again shortly." }),
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(decision.retryAfterMs / 1000)),
          "X-RateLimit-Limit": String(decision.limit),
        },
      },
    );
  }

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

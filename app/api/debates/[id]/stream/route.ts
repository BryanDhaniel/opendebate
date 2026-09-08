import { isTerminal } from "@/lib/domain/state-machine";
import {
  isTerminalEvent,
  synthesizeTerminalEvent,
  type DebateEvent,
} from "@/lib/domain/events";
import {
  getRuntime,
  MissingConfigError,
  type Runtime,
} from "@/lib/debate-engine/runtime";
import { RateLimitError } from "@/lib/debate-engine/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 15_000;

function sseEncode(event: DebateEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/debates/[id]/stream">,
) {
  const { id } = await ctx.params;

  let app: Runtime;
  try {
    app = getRuntime();
  } catch (error) {
    if (error instanceof MissingConfigError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }

  const debate = app.store.get(id);
  if (!debate) {
    return Response.json({ error: "Debate not found" }, { status: 404 });
  }

  try {
    app.runner.startIfIdle(id);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const state = {
        closed: false,
        unsubscribe: undefined as (() => void) | undefined,
        heartbeat: undefined as ReturnType<typeof setInterval> | undefined,
      };
      const close = () => {
        if (state.closed) return;
        state.closed = true;
        if (state.heartbeat) clearInterval(state.heartbeat);
        state.unsubscribe?.();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      const send = (event: DebateEvent) => {
        if (state.closed) return;
        try {
          controller.enqueue(sseEncode(event));
        } catch {
          close();
        }
      };

      // Replay history so reconnecting clients rebuild state.
      let last: DebateEvent | undefined;
      for (const event of app.bus.replay(id)) {
        send(event);
        last = event;
      }

      // If the debate ended before this connection (or the server restarted
      // and the event log is gone), emit the current state and finish. The
      // terminal event is synthesised by the domain layer, not hand-built here.
      if (isTerminal(debate.stage)) {
        if (!last || !isTerminalEvent(last)) {
          send(synthesizeTerminalEvent(debate, last?.seq ?? 0));
        }
        close();
        return;
      }

      state.unsubscribe = app.bus.subscribe(id, (event) => {
        send(event);
        if (isTerminalEvent(event)) close();
      });

      state.heartbeat = setInterval(() => {
        if (state.closed) return;
        try {
          controller.enqueue(new TextEncoder().encode(": ping\n\n"));
        } catch {
          close();
        }
      }, HEARTBEAT_MS);

      request.signal.addEventListener("abort", () => {
        // If the client abandoned the stream before the engine moved the debate
        // off "idle", reclaim the slot now instead of waiting for the idle TTL
        // (REVIEW C2). The store owns the idle-reclaim policy; we only signal
        // that the client is gone.
        app.store.reclaimIfIdle(id);
        close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

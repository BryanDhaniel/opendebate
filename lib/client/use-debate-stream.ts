"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { Debate } from "@/lib/domain/types";
import { isTerminal } from "@/lib/domain/state-machine";
import { isTerminalEvent, type DebateEvent } from "@/lib/domain/events";

type Status = "idle" | "creating" | "live" | "closed" | "error";

/**
 * Health of the connection to the debate event stream.
 * Distinct from `status`, which describes the debate lifecycle itself.
 */
export type ConnectionState =
  | "idle"
  | "creating"
  | "connecting"
  | "live"
  | "reconnecting"
  | "closed"
  | "error";

interface State {
  status: Status;
  connection: ConnectionState;
  debate: Debate | null;
  lastEvent: DebateEvent | null;
  researchStartedAt: string | null;
  updatedAt: string | null;
  error: string | null;
  /** Topic being submitted — kept so a failed creation can be retried. */
  pendingTopic: string | null;
  /** Bumped to force the SSE effect to tear down and re-subscribe. */
  streamKey: number;
}

type Action =
  | { type: "creating"; topic: string }
  | { type: "event"; event: DebateEvent }
  | { type: "create_failed"; error: string }
  | { type: "stream_open" }
  | { type: "stream_reconnecting" }
  | { type: "stream_error" }
  | { type: "retry" }
  | { type: "reset" };

const initialState: State = {
  status: "idle",
  connection: "idle",
  debate: null,
  lastEvent: null,
  researchStartedAt: null,
  updatedAt: null,
  error: null,
  pendingTopic: null,
  streamKey: 0,
};

function isDebateOver(debate: Debate | null): boolean {
  return !!debate && isTerminal(debate.stage);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "creating":
      return {
        ...initialState,
        status: "creating",
        connection: "creating",
        pendingTopic: action.topic,
      };

    case "event": {
      const { event } = action;
      const terminal = isTerminalEvent(event);
      return {
        ...state,
        status: terminal ? "closed" : "live",
        connection: terminal ? "closed" : "live",
        debate: event.debate,
        lastEvent: event,
        updatedAt: event.at,
        researchStartedAt:
          event.type === "research_started"
            ? event.at
            : state.researchStartedAt,
        error:
          event.type === "debate_failed"
            ? (event.detail ?? "The debate failed.")
            : state.error,
        pendingTopic: null,
      };
    }

    case "create_failed":
      return { ...state, status: "error", connection: "error", error: action.error };

    case "stream_open":
      return {
        ...state,
        connection: isDebateOver(state.debate) ? "closed" : "live",
      };

    case "stream_reconnecting":
      return {
        ...state,
        connection: isDebateOver(state.debate) ? "closed" : "reconnecting",
      };

    case "stream_error":
      return {
        ...state,
        status: isDebateOver(state.debate) ? "closed" : "error",
        connection: isDebateOver(state.debate) ? "closed" : "error",
        error: isDebateOver(state.debate)
          ? state.error
          : "Connection to the debate was lost.",
      };

    case "retry":
      return {
        ...state,
        error: null,
        streamKey: state.streamKey + 1,
        connection: isDebateOver(state.debate)
          ? "closed"
          : state.debate
            ? "connecting"
            : "idle",
      };

    case "reset":
      return initialState;
  }
}

export function useDebateStream() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const debateId = state.debate?.id ?? null;

  // Read inside the SSE effect so re-subscribing is driven only by debateId /
  // streamKey — not by every status change, which would churn the connection.
  const debateOverRef = useRef(false);
  useEffect(() => {
    debateOverRef.current = isDebateOver(state.debate);
  }, [state.debate]);

  useEffect(() => {
    if (!debateId || debateOverRef.current) return;

    const source = new EventSource(`/api/debates/${debateId}/stream`);

    source.onopen = () => {
      dispatch({ type: "stream_open" });
    };

    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as DebateEvent;
        dispatch({ type: "event", event });
        if (isTerminalEvent(event)) source.close();
      } catch {
        // ignore malformed frame
      }
    };

    source.onerror = () => {
      // EventSource retries transient drops itself (readyState CONNECTING);
      // CLOSED means it gave up and will not recover on its own.
      if (source.readyState === EventSource.CLOSED) {
        source.close();
        dispatch({ type: "stream_error" });
      } else {
        dispatch({ type: "stream_reconnecting" });
      }
    };

    return () => source.close();
  }, [debateId, state.streamKey]);

  const start = useCallback(async (topic: string) => {
    dispatch({ type: "creating", topic });
    try {
      const response = await fetch("/api/debates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = (await response.json().catch(() => null)) as
        | { debate?: Debate; error?: string }
        | null;
      if (!response.ok || !data?.debate) {
        dispatch({
          type: "create_failed",
          error: data?.error ?? `Failed to create debate (${response.status})`,
        });
        return;
      }
      dispatch({ type: "event", event: syntheticStart(data.debate) });
    } catch {
      dispatch({
        type: "create_failed",
        error: "Network error while creating the debate.",
      });
    }
  }, []);

  /**
   * Recover from a failure: re-attempt creation if the debate never started,
   * otherwise re-open the event stream from the last known state.
   */
  const retry = useCallback(() => {
    if (state.pendingTopic && !state.debate) {
      void start(state.pendingTopic);
      return;
    }
    dispatch({ type: "retry" });
  }, [state.pendingTopic, state.debate, start]);

  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  return {
    status: state.status,
    connection: state.connection,
    debate: state.debate,
    lastEvent: state.lastEvent,
    researchStartedAt: state.researchStartedAt,
    updatedAt: state.updatedAt,
    error: state.error,
    start,
    retry,
    reset,
  };
}

function syntheticStart(debate: Debate): DebateEvent {
  return {
    seq: 0,
    type: "debate_started",
    stage: debate.stage,
    debate,
    at: new Date().toISOString(),
  };
}

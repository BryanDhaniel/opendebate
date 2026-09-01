"use client";

import { useCallback, useEffect, useReducer } from "react";
import type { Debate } from "@/lib/domain/types";
import { isTerminal } from "@/lib/domain/state-machine";
import { isTerminalEvent, type DebateEvent } from "@/lib/domain/events";

type Status = "idle" | "creating" | "live" | "closed" | "error";

interface State {
  status: Status;
  debate: Debate | null;
  lastEvent: DebateEvent | null;
  researchStartedAt: string | null;
  error: string | null;
}

type Action =
  | { type: "creating" }
  | { type: "event"; event: DebateEvent }
  | { type: "create_failed"; error: string }
  | { type: "stream_error" }
  | { type: "reset" };

const initialState: State = {
  status: "idle",
  debate: null,
  lastEvent: null,
  researchStartedAt: null,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "creating":
      return { ...initialState, status: "creating" };
    case "event": {
      const { event } = action;
      return {
        ...state,
        status: isTerminalEvent(event) ? "closed" : "live",
        debate: event.debate,
        lastEvent: event,
        researchStartedAt:
          event.type === "research_started" ? event.at : state.researchStartedAt,
        error: event.type === "debate_failed" ? (event.detail ?? null) : state.error,
      };
    }
    case "create_failed":
      return { ...initialState, error: action.error };
    case "stream_error":
      return {
        ...state,
        status: state.debate && isTerminal(state.debate.stage) ? "closed" : "error",
        error:
          state.debate && isTerminal(state.debate.stage)
            ? null
            : "Connection to the debate was lost.",
      };
    case "reset":
      return initialState;
  }
}

export function useDebateStream() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const debateId = state.debate?.id ?? null;

  useEffect(() => {
    if (!debateId || state.status === "closed" || state.status === "error") return;
    const source = new EventSource(`/api/debates/${debateId}/stream`);
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
      if (source.readyState === EventSource.CLOSED) {
        source.close();
        dispatch({ type: "stream_error" });
      }
    };
    return () => source.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debateId]);

  const start = useCallback(async (topic: string) => {
    dispatch({ type: "creating" });
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
          error:
            data?.error ?? `Failed to create debate (${response.status})`,
        });
        return;
      }
      dispatch({ type: "event", event: syntheticStart(data.debate) });
    } catch {
      dispatch({
        type: "create_failed",
        error: "Network error while creating debate",
      });
    }
  }, []);

  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  return {
    status: state.status,
    debate: state.debate,
    lastEvent: state.lastEvent,
    researchStartedAt: state.researchStartedAt,
    error: state.error,
    start,
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

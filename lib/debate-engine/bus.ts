import type { DebateEvent } from "../domain/events";

type Subscriber = (event: DebateEvent) => void;

export class DebateBus {
  private logs = new Map<string, DebateEvent[]>();
  private subscribers = new Map<string, Set<Subscriber>>();

  publish(
    debateId: string,
    event: Omit<DebateEvent, "seq"> & { seq?: number },
  ): DebateEvent {
    const log = this.logs.get(debateId) ?? [];
    const full: DebateEvent = { ...event, seq: log.length + 1 };
    log.push(full);
    this.logs.set(debateId, log);
    for (const subscriber of this.subscribers.get(debateId) ?? []) {
      try {
        subscriber(full);
      } catch (error) {
        console.error("[bus] subscriber threw:", error);
      }
    }
    return full;
  }

  subscribe(debateId: string, subscriber: Subscriber): () => void {
    const set = this.subscribers.get(debateId) ?? new Set();
    set.add(subscriber);
    this.subscribers.set(debateId, set);
    return () => {
      set.delete(subscriber);
    };
  }

  replay(debateId: string): DebateEvent[] {
    return [...(this.logs.get(debateId) ?? [])];
  }
}

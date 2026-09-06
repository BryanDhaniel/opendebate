import { LIMITS } from "../config";

/**
 * In-memory sliding-window limiter. Each key accumulates timestamps of
 * consumptions within `windowMs`; a consumption is allowed while the count in
 * the window is below `max`. Intentionally process-local: it resets on server
 * restart, which is acceptable for a single-instance deployment guarding against
 * runaway LLM spend (REVIEW C1).
 */
export class WindowedLimiter {
  private buckets = new Map<string, number[]>();

  constructor(
    private readonly _windowMs: number,
    private readonly _max: number,
  ) {}

  /** The configured ceiling for this limiter. */
  get capacity(): number {
    return this._max;
  }

  /** The configured sliding-window length in milliseconds. */
  get windowMs(): number {
    return this._windowMs;
  }

  /** Count of consumptions for `key` still inside the window. */
  peek(key: string, now: number = Date.now()): number {
    const cutoff = now - this._windowMs;
    const list = this.buckets.get(key);
    if (!list) return 0;
    return list.filter((t) => t > cutoff).length;
  }

  /**
   * Records a consumption for `key` if allowed. Returns whether it was allowed
   * and, when denied, how long until the oldest entry leaves the window.
   */
  consume(
    key: string,
    now: number = Date.now(),
  ): { allowed: boolean; retryAfterMs: number; limit: number; remaining: number } {
    const cutoff = now - this._windowMs;
    const list = (this.buckets.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length >= this._max) {
      this.buckets.set(key, list);
      const retryAfterMs = Math.max(0, list[0] + this._windowMs - now);
      return { allowed: false, retryAfterMs, limit: this._max, remaining: 0 };
    }
    list.push(now);
    this.buckets.set(key, list);
    return {
      allowed: true,
      retryAfterMs: 0,
      limit: this._max,
      remaining: this._max - list.length,
    };
  }
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterMs: number;
  limit: number;
  remaining: number;
}

/**
 * Two-bucket limiter for debate creation: a per-client-IP bucket and a global
 * bucket. Both must have headroom; the stricter (lower remaining) decision
 * wins. Construction is side-effect-free until `check` is called, so tests can
 * drive it with an explicit `now`.
 */
export class CreationRateLimiter {
  private perIp: WindowedLimiter;
  private global: WindowedLimiter;

  constructor(
    windowMs: number,
    maxPerIp: number,
    maxGlobal: number,
  ) {
    this.perIp = new WindowedLimiter(windowMs, maxPerIp);
    this.global = new WindowedLimiter(windowMs, maxGlobal);
  }

  check(ip: string, now: number = Date.now()): RateLimitDecision {
    // Peek both before consuming so a denied request does not burn a token.
    const globalCount = this.global.peek("global", now);
    const ipCount = this.perIp.peek(ip, now);
    if (globalCount >= this.global.capacity) {
      return {
        allowed: false,
        retryAfterMs: this.global.windowMs,
        limit: this.global.capacity,
        remaining: 0,
      };
    }
    if (ipCount >= this.perIp.capacity) {
      return {
        allowed: false,
        retryAfterMs: this.perIp.windowMs,
        limit: this.perIp.capacity,
        remaining: 0,
      };
    }
    this.global.consume("global", now);
    this.perIp.consume(ip, now);
    return {
      allowed: true,
      retryAfterMs: 0,
      limit: this.perIp.capacity,
      remaining: this.perIp.capacity - ipCount - 1,
    };
  }
}

/** Best-effort client IP from proxy headers, falling back for localhost. */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return "local";
}

/** Singleton wired to the configured limits; persists across requests. */
export const creationRateLimiter = new CreationRateLimiter(
  LIMITS.rateLimitWindowMs,
  LIMITS.maxCreatesPerIp,
  LIMITS.maxCreatesGlobal,
);

# Code Review — OpenDebate

Review date: 2026-09-04
Scope: correctness, security, performance, maintainability + removal of unnecessary files.

## Verdict

The code is in good shape for a project at this stage: strict TypeScript, a clean
client/server split, a genuinely considered accessibility layer, and a domain
model that is well separated from the AI plumbing. Typecheck, lint and the full
test suite all pass.

The findings below are not stylistic. The two **Critical** items were the ones
that matter if this ever leaves localhost: the API was unauthenticated and
triggers paid LLM work, and the in-memory store leaks slots permanently, which
can wedge the app into a permanent 429 with only five abandoned requests.
**Both Critical items (C1, C2) are now RESOLVED — see the per-item notes.**

---

## Verification story

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | **0 errors** |
| `npx eslint .` | **0 problems** |
| `npx vitest run` | **9 files, 83 tests, all passing** |
| `next dev` + `curl /` | **HTTP 200**, all expected copy rendered, no runtime errors |

**Note on `npm run build`:** it cannot complete in this sandbox. Next's Turbopack
cache cleanup attempts a 50+ file bulk delete, which trips the environment's
safe-delete guard. Compilation itself is clean (tsc + dev server both pass), so
this is an environment limitation, not a code defect. Verify on an unrestricted
machine before deploying.

**Note on the test suite:** the previously-reported "full-suite SIGTERM" did not
reproduce. All 6 files now run together in ~2s.

---

## Files removed

| File | Why |
| --- | --- |
| `smoke-home.html` | Stray 12.7 KB `curl` output dump from an earlier smoke test. Untracked, zero references. |
| `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | `create-next-app` scaffold assets. Verified zero references anywhere in the project (they were git-tracked, so recoverable via `git checkout`). |
| `tsconfig.tsbuildinfo` | Build artifact, already gitignored. |
| `@radix-ui/react-tabs` (dependency) | Installed but never imported — only `@radix-ui/react-progress` is used. Removed via `npm uninstall`. |

`public/` is now empty. Next.js does not require it; kept as a placeholder.

---

## Fixed during this review

1. **Three stale test assertions** in `tests/components.smoke.test.tsx` that
   asserted pre-redesign copy (`"Start Debate"` → `"Open the debate"`,
   `"Or try one"` → `"Or start from a prompt"`, `"0/500 characters"` → `"0/500"`,
   `"DEBATER A"` → `"Debater A"`). These were the only 3 of 53 tests failing.
2. **`MAX_ACTIVE_DEBATES` silently disabling the concurrency cap** — see Important #7.
3. **Redundant `sideBorderFor()` helper** in `components/Transcript.tsx` that
   re-implemented the ternary already computed one function above it. The border
   class is now passed down explicitly.

---

## Critical

### C1 — Unauthenticated API triggers paid LLM work — **[RESOLVED in 77a8023]**

`app/api/debates/route.ts`, `app/api/debates/[id]/stream/route.ts`

`POST /api/debates` had no authentication and no per-client rate limit. Anyone
who could reach the deployment could start a debate, and each one costs roughly
two research rounds (each up to 5 Tavily searches + 2 LLM calls), ten generation
calls, and one judge call.

The only guard was:

```ts
if (app.store.activeCount() >= LIMITS.maxActiveDebates) return 429
```

That is a **concurrency** limiter, not a rate limiter. It caps how many debates
run at once; it does nothing about how many run in total. A trivial loop script
could drain an OpenAI budget continuously.

**Fix (landed):** `POST` now (a) requires a shared-secret bearer token when
`OPENDABATE_API_KEY` is set (`Authorization: Bearer` or `x-api-key`), and
(b) enforces per-IP + global sliding-window creation limits via
`lib/server/rate-limit.ts` (429 + `Retry-After` + `X-RateLimit-Limit`) before
any body parse or provider touch. The concurrency cap is kept *in addition*.
Defaults: 5 creates/IP and 20 global per 60s, all tunable via env. No hard
spend cap yet (see open follow-up below).

### C2 — In-memory store leaks slots permanently — **[RESOLVED in 77a8023]**

`lib/debate-engine/store.ts`

`DebateStore.debates` was a plain `Map` with no eviction. `create()` inserts a
debate at stage `"idle"` and the route returns 201. The debate only leaves
`"idle"` when someone opens `/api/debates/:id/stream` and `startIfIdle` fires.

If the client never opened the stream — closed the tab, network blip, a bot
probing the endpoint — that debate stayed `"idle"` forever. `"idle"` is not
terminal, so `activeCount()` counted it forever. **Five abandoned creations wedged
the endpoint into a permanent 429 for every user until the process restarts.**
There was no TTL, no reaper, and no DELETE endpoint.

`data/debates/*.json` grew without bound for the same reason (see S3).

**Fix (landed):** `DebateStore` gained a `sweepIdle()` that drops `"idle"`
debates older than `LIMITS.idleTtlMs` (default 10 min), called by both
`create()` and `activeCount()` so the active-cap self-heals. A new `delete(id)`
removes the in-memory entry and best-effort `unlink`s its JSON. The stream route
also calls `delete(id)` on abort when the debate is still `"idle"`, reclaiming
the slot immediately instead of waiting for the TTL.

---

## Important

### I1 — `withTimeout` never cancels the abandoned promise

`lib/debate-engine/engine.ts:56`

```ts
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, ...);
  });
}
```

It races the promise against a timer and resolves early — but the original
promise keeps running. When the 60-second research budget expires, the in-flight
searches and LLM calls continue to completion, burning tokens and holding
sockets for work whose result is already discarded. Each research branch can
have up to 5 concurrent searches plus synthesis outstanding.

`OpenAIProvider` already accepts an `abortSignal`. Thread one through and abort
on timeout.

### I2 — `withRetry` has no backoff and retries blindly

`lib/debate-engine/engine.ts:428`

```ts
async function withRetry(fn) {
  try { await fn(); }
  catch { console.warn(...); await fn(); }   // immediate, unconditional
}
```

Two problems. It retries **immediately**, so a 429 or transient outage gets a
second request at once — the worst possible response to backpressure. And it
retries **unconditionally**, so non-retryable failures (a schema validation
error, a bad model name) fail identically twice, doubling cost for no benefit.

**Fix:** exponential backoff with jitter, and retry only on retryable errors.

*Partial — 2026-09-08:* the retry policy was extracted out of `engine.ts` into
`lib/debate-engine/stage-guard.ts` (alongside `guardStageOutput`), so it is now
isolated and directly unit-testable (`tests/stage-guard.test.ts`). This is the
first, mechanical step — the *behavioral* fix (backoff + retry-on-retryable-only)
is still TODO. Having the policy in one place makes that follow-up a one-function
change.

### I3 — SSE frames are O(n²) in transcript size

`lib/debate-engine/engine.ts:38`, `emit()`

Every event does `JSON.parse(JSON.stringify(debate))` and ships the **entire**
debate — topic, both research objects with all sources, and the whole transcript
accumulated so far. With ~30 events over a debate, both server CPU and bandwidth
scale quadratically with transcript length.

Harmless at today's sizes. It becomes the dominant cost the moment transcripts
get longer.

**Fix:** send deltas (the new message, the new stage) and let the client
accumulate. Keep a full-state frame only for reconnect replay, which already
exists via `bus.replay()`.

### I4 — Third-party URLs rendered as links without scheme validation

`components/SourcesPanel.tsx:83`

`source.url` comes straight from the Tavily response and goes into `<a href>`.
A compromised or hostile search result can supply a `javascript:` or `data:` URL.
React's own handling of dangerous URL schemes is not something to lean on as the
only control.

**Fix:** validate the scheme is `http:`/`https:` — ideally at ingest in
`AiDebater.research()` where sources are constructed, so the check is
server-side and applies to the Markdown export too.

### I5 — Reconnect storm on a dead debate ID

`lib/client/use-debate-stream.ts:151`

`EventSource` reconnects automatically. If the server restarted, `store.get(id)`
returns 404 with a JSON content-type — which the browser cannot distinguish from
a transient drop. It will retry on its own schedule indefinitely, hammering the
server for a debate that no longer exists.

This is more likely than it sounds, because (per C2) the in-memory store is the
only source of truth: a server restart orphans every in-flight debate.

**Fix:** treat 404 as terminal — close the stream and surface a "this debate is
no longer available" state instead of reconnecting.

### I6 — Transition rules are tested but not enforced

`lib/domain/state-machine.ts`

`canTransition` / `assertTransition` / `nextStage` have no production caller —
only `tests/state-machine.test.ts`. The engine sets `debate.stage` directly:

```ts
const setStage = (stage: DebateStage) => { debate.stage = stage; };
```

So the stage graph that the tests validate is not actually enforced at runtime.
That is not a bug today (the engine is linear and correct by construction), but
it is a latent trap: the tests give false confidence that invalid transitions are
impossible. Either call `assertTransition` in `setStage`, or drop the helpers and
keep `PROTOCOL_STAGES` + `isTerminal`.

### I7 — `MAX_ACTIVE_DEBATES` could disable the cap entirely *(fixed)*

`lib/config.ts:23`

```ts
maxActiveDebates: Number(process.env.MAX_ACTIVE_DEBATES ?? 5),
```

`Number("abc")` is `NaN`, and **every** comparison against `NaN` is false — so
`activeCount() >= NaN` is never true and the cap silently becomes "unlimited". A
typo in an env var would have disabled the only guard in C1.

Fixed by routing it through a `positiveInt()` helper that falls back when the
value is unset, non-numeric, or non-positive.

---

## Suggestions

### S1 — Side-styling ternary duplicated across four components

`isA ? "text-for" : "text-against"` (plus `-soft` and `-border` variants) is
hand-copied in `Transcript.tsx`, `DebateArena.tsx`, `ResultPanel.tsx` and
`SourcesPanel.tsx`. Extract one lookup:

```ts
export const SIDE_STYLES: Record<Speaker, { text: string; soft: string; border: string }> = {
  A: { text: "text-for",     soft: "bg-for-soft",     border: "border-for-border" },
  B: { text: "text-against", soft: "bg-against-soft", border: "border-against-border" },
};
```

### S2 — Magic-number coupling between header height and sticky offset

`app/page.tsx` hardcodes `h-14` on the header; `components/StageIndicator.tsx`
hardcodes `sticky top-14`. Change one and the other breaks silently. Use a
single `--header-h` custom property referenced by both.

### S3 — `data/` is written but never read back

`DebateStore` imports `mkdir, rename, writeFile` — never `readFile`. `get()` reads
only the in-memory Map. The persisted JSON is write-only: it produces unbounded
disk growth with no recovery benefit after a restart, because nothing loads it.
Either implement load-on-startup (which would also fix I5 for real) or stop
persisting.

### S4 — Dead code

Confirmed zero references:

- `transcriptToText()` — `lib/export.ts:50`
- `defaultProviderTimeout()` — `lib/ai/openai-provider.ts:63`
- `DebateStore.speakerOf()` — `lib/debate-engine/store.ts:68`
- `useDebateStream` returns `lastEvent` and `updatedAt` — never consumed

### S5 — Cosmetic: `failed` renders as 100% progress

`StageIndicator.tsx` special-cases `progress = 100` when `stage === "failed"`, so
a failed debate shows a completely full progress bar. It is labelled "Aborted"
and coloured with `text-danger`, so the state is not ambiguous — but showing a
full bar for a failure reads oddly. Consider freezing at the last reached stage.

### S6 — `.next/` holds a partial build

Compiled output with no `BUILD_ID`, from the aborted build noted above. Safe to
delete; it regenerates.

---

## What looked good

- **Client/server boundary.** `process.env` is confined to `lib/config.ts`; shared
  constants live in `lib/domain/constants.ts`, so no client component pulls
  server env into the browser bundle. Verified: no `.tsx` imports `@/lib/config`.
- **Theme handling.** `useSyncExternalStore` over `localStorage` + OS preference,
  with a blocking init script — correct, flash-free, and it satisfies React 19's
  `set-state-in-effect` rule rather than suppressing it.
- **Accessibility.** Curated live regions instead of dumping every message, an
  `aria-live="off"` countdown with the reasoning documented, proper
  `role="progressbar"`/`timer"`/`region"`, skip link, `rel="noopener noreferrer"`
  on external links, and `prefers-reduced-motion` handled in both CSS and JS.
- **`sanitizeTopic()`.** Strips tags and control characters server-side — defence
  in depth even though React escapes on render.
- **Blind judging.** The judge sees `position1`/`position2`, never debater
  labels, and `validateJudgeResult()` cross-checks that scores sum correctly and
  the winner actually has the higher score. That is the domain invariant that
  matters, and it is enforced.

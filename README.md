# OpenDebate

Two AI debaters are given the same topic. They independently research it for a limited time, argue opposing positions, rebut each other, cross-examine one another, and an **independent AI Judge** scores the debate on a transparent rubric and declares a winner.

The system prioritizes **fairness, evidence, reasoning, and transparency** over entertaining AI chatter. The winner is decided by evidence quality, argument strength, rebuttal quality, logical reasoning, engagement with the opponent, and clarity — never by confidence, length, or vocabulary.

## How it works

```
Topic
  ├── Debater A (FOR)      ── researches independently, 60s budget ──┐
  ├── Debater B (AGAINST)  ── researches independently, 60s budget ──┤
  │                                                                 │
  ├── Opening A → Opening B → Rebuttal A → Rebuttal B              │
  ├── Cross examination (A asks B, B asks A)                        │
  ├── Closing A → Closing B                                         │
  └── AI Judge (anonymized, rubric-based scoring) ◄─────────────────┘
                          ↓
                    Winner + scores
```

- The debate protocol is a **strict server-side state machine** (`lib/debate-engine/engine.ts`); agents never decide what happens next.
- Research is **parallel and isolated**: each debater gets its own budget (60s, 5 searches, 10 sources) and never sees the opponent's research.
- The Judge receives **anonymized** positions (POSITION 1 / POSITION 2, randomly assigned) to avoid positional bias, and must return structured, arithmetically-validated scores.
- Live updates stream to the UI over **Server-Sent Events** with full state snapshots, so reconnecting clients rebuild instantly.

## Getting started

```bash
npm install
cp .env.example .env.local   # add your OPENAI_API_KEY (and TAVILY_API_KEY for research)
npm run dev
```

Open http://localhost:3000, enter a topic, and watch the debate unfold live.

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | yes | Powers debaters and judge |
| `TAVILY_API_KEY` | no | Enables the research phase (debates still run without it) |
| `OPENAI_DEBATER_MODEL` | no | Default `gpt-4o-mini` |
| `OPENAI_JUDGE_MODEL` | no | Default `gpt-4o` |
| `OPENAI_BASE_URL` | no | Point at any OpenAI-compatible endpoint (e.g. local model) |
| `DATA_DIR` | no | Debate JSON storage (default `./data/debates`) |
| `MAX_ACTIVE_DEBATES` | no | Concurrency cap (default 5) |

## Project layout

```
lib/domain/          Debate types, stage machine, judge result validation
lib/ai/              Provider / Debater / Judge abstractions + OpenAI impl
lib/research/        Tavily search tool
lib/prompts/         All LLM prompts, separate from logic
lib/debate-engine/   State machine runner, event bus, JSON file store
lib/client/          SSE hook (useDebateStream)
app/api/debates/     Create · fetch · SSE stream endpoints
components/          Arena, stage indicator, transcript, sources, results
tests/               Vitest suites (state machine, research isolation, judge, engine)
```

## Scripts

```bash
npm run dev        # start dev server
npm run build      # production build
npm start          # run production build
npm run lint       # eslint
npx tsc --noEmit   # typecheck
npx vitest run     # tests
```

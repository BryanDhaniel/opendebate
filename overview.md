# OpenDebate — UI Redesign (Anti-Slop Overhaul)

A redesign of the OpenDebate Next.js 16 + Tailwind v4 app, executed with the
`design-taste-frontend` methodology: **audit first, then redesign from the
concept outward** rather than restyling the same generic template.

## Design read
Real-time AI debate product UI for debate-watchers and the curious, with an
editorial "arena" language — two adversaries facing off. Diales: Variance 7,
Motion 5, Density 4. Dual light/dark, IA and copy preserved (redesign-overhaul).

## The "AI slop" tells that were removed
- **Amber/yellow accent** (the default AI palette) replaced by an ink-on-paper
  system where the only chroma are two *semantically meaningful* opponent colours.
- **Emoji** (🤖 / 🏆) replaced: lettered speaker marks (A/B) and a Tabler gavel.
- **`tracking-[0.3em]` micro-label spam** cut to a few functional labels.
- **Generic stacked centered cards** replaced by a concept-driven versus layout.
- **Hand-rolled SVGs** replaced with `@tabler/icons-react` (one icon family).

## New design system ("Ink & Arena")
- **Neutrals**: cool near-white paper (`#f2f3f5` / `#16181d` dark), ink text
  (`#15171c`), no pure black/white.
- **FOR = teal `#0e8a6e`**, **AGAINST = vermillion `#b8442b`** — the only colours,
  and they map to the debate's actual structure.
- **Brand accent = ink**: primary actions are confident black buttons, not a
  glowing coloured CTA.
- **Radius lock**: panels 14px, controls 10px, pills full — applied everywhere.

## Layout changes
- **Home**: asymmetric editorial hero (headline + topic form on the left, a real
  debate-protocol stepper on the right) instead of a lone centered card.
- **Arena**: topic banner → slim sticky stage bar → **two debater cards flanking a
  VS badge** (they literally face each other).
- **Transcript**: a **two-rail conversation with a center spine** — FOR messages in
  the left rail, AGAINST in the right, hugging the dividing line. Collapses to a
  single column with speaker-coloured borders on mobile.
- **Result**: gavel verdict, winner-coloured border, two-column score comparison
  using the opponent colours.

## Files changed
- `app/globals.css` — full token + radius + reveal-animation system
- `app/layout.tsx` — theme-color aligned to new palette
- `app/page.tsx` — editorial hero + protocol stepper
- `components/TopicForm.tsx`, `DebateArena.tsx`, `StageIndicator.tsx`,
  `Transcript.tsx`, `SourcesPanel.tsx`, `ResultPanel.tsx`,
  `ConnectionStatus.tsx`, `ThemeToggle.tsx`

## Verification
- `npx tsc --noEmit` → 0 errors (all Tabler imports + component props correct).
- `next dev` → homepage returns HTTP 200 with all redesigned copy, no runtime
  errors. Live arena requires an `OPENAI_API_KEY` to fully exercise.
- `next build` could not be completed in this sandbox: Next's Turbopack cache
  cleanup hits the environment's bulk-delete safety guard. Compilation itself is
  clean (typecheck passes, dev renders). Build normally on an unrestricted
  machine via `npm run build`.

## Run it
```bash
npm install
cp .env.example .env.local   # add OPENAI_API_KEY (and TAVILY_API_KEY)
npm run dev                  # http://localhost:3000
```

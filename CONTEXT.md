# OpenDebate

A platform where two independent AI debaters research a shared topic, argue opposing positions through a structured debate format, and an independent AI Judge decides the winner based on evidence and reasoning — not rhetoric.

## Language

### Debate Structure

**Debate**:
A structured adversarial exchange between two AI debaters on a single Topic, judged by an independent Judge.
_Avoid_: Conversation, chat, discussion, session

**Topic**:
The question or statement the debaters argue about. User-provided, 1–500 characters.
_Avoid_: Subject, prompt, query

**DebateStage**:
The current phase of a Debate in its fixed protocol (researching, opening_a, rebuttal_b, judging, …). Controlled exclusively by the DebateEngine.
_Avoid_: Phase, step, round

**Transcript**:
The ordered sequence of all DebateMessages in a Debate.
_Avoid_: Log, history, record

**DebateMessage**:
A single transcript entry: a question, answer, statement, or rebuttal tagged with its stage and speaker.
_Avoid_: Entry, line, post

### Roles

**Debater**:
An AI assigned to argue one Position. Two per Debate: Debater A and Debater B. Researches independently and cannot see the opponent's research.
_Avoid_: Agent, participant, player, bot

**Position**:
The side a Debater defends: FOR or AGAINST. Exactly one of each per Debate.
_Avoid_: Side, stance, opinion

**Judge**:
An independent AI that evaluates the completed Debate against the scoring rubric and determines the winner. Never participates in the debate, never generates new arguments, and receives anonymized debater labels to prevent positional bias.
_Avoid_: Referee, evaluator, arbiter, moderator

### Research

**ResearchResult**:
The structured output of a Debater's research: key claims, evidence, sources, counter-arguments, and uncertainties.
_Avoid_: Findings, notes, dossier

**Source**:
A reference retrieved by the ResearchTool during research, with title, URL, publisher, and relevance. Never fabricated; unverifiable links are not presented as verified.
_Avoid_: Reference, citation, link

**ResearchBudget**:
The per-debater research limits: time (60s), searches (5), and sources (10). Hard-enforced to keep both debaters on equal footing and control cost.
_Avoid_: Limit, quota, cap

### Judging

**JudgeResult**:
The Judge's structured output: winner, per-Debater total scores, per-criterion breakdown, decisive argument, weakest argument, and explanation. The per-criterion scores must sum to each total.
_Avoid_: Verdict, decision, scorecard

**ScoringCriterion**:
One of the six weighted rubric categories: Evidence Quality (25), Argument Strength (25), Rebuttal Quality (20), Logical Reasoning (15), Response to Opponent (10), Clarity (5).
_Avoid_: Category, metric, axis

### Infrastructure

**DebateEngine**:
The server-side state machine that owns the debate protocol: stage transitions, turn order, and event emission. The Debaters and Judge never decide what happens next.
_Avoid_: Orchestrator, controller, manager, runner

**AIProvider**:
The abstraction over the LLM backend used by Debaters and the Judge. Providers are interchangeable; the debate system never talks to a specific model directly.
_Avoid_: LLM, model, client

**DebateEvent**:
A live update emitted by the DebateEngine over the event stream (e.g. research_started, opening_completed, judging_completed) that drives the UI.
_Avoid_: Notification, message, signal

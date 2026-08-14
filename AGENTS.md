# Mr. Boobins' Pet Club operating contract

## Mission

Implement the project's documented objective while preserving user work, project conventions, and safety boundaries.

Applied Codex Project Kit profiles: software, visual-design

## Required workflow

1. Inspect relevant files and commands before asking discoverable questions.
2. For non-trivial work, state objective, scope, verification, and definition of done before editing.
3. Use one writer per checkout. Use read-only agents for independent exploration or review.
4. Run the exact checks in `docs/QUALITY_GATES.md`.
5. Use `$run-review-fix-loop` only after the user explicitly approves an eligible audit or explicitly invokes that skill. Ordinary deterministic checks and read-only review do not require an audit.
6. Preserve unmanaged files and treat modified managed files as conflicts.
7. Resolve logical model profiles through `.codex-kit/model-routing.json`. User overrides win; unavailable models produce a proposal, never silent substitution.

## Task operating model

- `00 — Project Q&A (Read-Only)` and `01 — Tooling & Alternatives (Paid · Free · Open Source)` are the lean permanent baseline.

- `03 — Goals & Delivery Monitor (Read-Only)` is recommended because: multiple milestones, multiple build tracks, persistent goal, multi-artifact release, multiple approval gates.
- `04 — Master Orchestrator (Coordinator)` is recommended for multiple build tracks; it coordinates at most three workers and never writes project files.
- Read-only tasks may inspect, browse, explain, compare, and produce decision-complete handoffs. They cannot edit files or documentation; change Git, dependencies, tasks, or external systems; or implement work.
- Use temporary `Build — <Milestone>`, `Review — <Milestone>`, and approved `Audit — <Milestone>` tasks for authorized work. Keep one writer per checkout and archive temporary tasks after durable results are recorded.
- See `docs/PROJECT_OPERATING_MODEL.md`, `docs/TASK_CHARTERS.md`, and `docs/MODEL_ROUTING.md` for the complete rules.

## Bounded review/fix loop

- Maximum three review passes total and two fix rounds.
- Stop on repeated failure, no measurable progress, missing decisions, scope expansion, secrets, destructive/external actions, or the pass limit.
- Never auto-commit, merge, push, create a PR, publish, deploy, or contact third parties.

Deterministic quality gates run after every implementation. Before the first reviewable milestone, run those gates without offering an audit unless the user explicitly requests one. Offer the first bounded audit only after the concrete milestone criteria in `docs/PROJECT_BRIEF.md` are satisfied. After the first audit—or after a declined first offer—offer another audit only following a material change with meaningful regression or safety risk. Every audit remains opt-in. If declined, create no audit task. If approved, freeze scope and acceptance criteria, use one writer plus independent read-only review, and store a dated report under `docs/audits/`.

## Human gates

Require explicit approval for destructive operations, credentials, writes outside this workspace, commits, pushes, PRs, releases, publishing, deployment, and material product decisions.

## Definition of done

- Requested behavior and acceptance criteria are satisfied.
- Required checks pass with evidence.
- No unresolved critical/high review finding remains.
- Visual artifacts are rendered or opened when layout matters.
- Documentation matches actual behavior and remaining risks are reported.

## Code Review Rules

1. Flag any silent overwrite of an unmanaged or locally changed file. Safe alternative: preview and report a conflict.
2. Flag success claims without command or artifact evidence. Safe alternative: run the documented verifier.
3. Flag any broadened permission, rule, or command prefix. Safe alternative: use the narrowest exact scope and an approval gate.

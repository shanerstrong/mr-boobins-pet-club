# Project operating model

## Permanent read-only tasks

### 00 — Project Q&A (Read-Only)

May inspect, browse, explain, compare, and plan. It cannot mutate files or documentation; Git; dependencies; tasks; or external systems. It converts requested work into a decision-complete implementation handoff.

### 01 — Tooling & Alternatives (Paid · Free · Open Source)

Compares paid/managed, free-tier, open-source/self-hosted, build-it-ourselves, and defer/no-tool options. Recommendations optimize total value and revalidate pricing, licensing, and product status from dated primary sources.

This project is not currently classified as Shaner Strong or fitness-related, so no Media Integration task is proposed.

### 03 — Goals & Delivery Monitor (Read-Only)

Helps define a measurable objective and definition of done. Tracks milestones, approvals, dependencies, risks, deadline confidence, authoritative files, renders, tests, exports, Git state, task status, overlapping writers, and shared-resource conflicts. It produces decision-complete Build handoffs but never edits project files, Git, dependencies, designs, credentials, external services, or other tasks, and never claims completion without requirement-by-requirement artifact evidence. Default routing is efficient / medium; escalation is reserved for a difficult completion audit.

### 04 — Master Orchestrator (Coordinator)

Coordinates authorized parallel build tracks, monitors ownership, and consolidates outcomes. It supervises at most three active workers, never writes project files, and never expands scope.

## Temporary work tasks

Use `Build — <Milestone>`, `Review — <Milestone>`, and explicitly approved `Audit — <Milestone>` tasks. Keep one writer per checkout, record durable decisions and results in project documentation, and archive temporary tasks after completion. Re-running bootstrap must detect exact-title matches and never duplicate permanent tasks.

## Production control

The repository is authoritative for code, runtime assets, plans, decisions, tests, and evidence. Google Drive contains curated review mirrors and phone-viewable exports. The production-manager conversation is the approval and coordination surface, but durable state must be recorded in the repository.

`docs/production/PRODUCTION_DASHBOARD.md` records the current milestone, blockers, work ownership, evidence, and next approval. Only one reviewable milestone may be active. At most three independent work lanes may run after shared schemas, IDs, interfaces, and visual specifications are stable; shared-state architecture, persistence, integration, and source-of-truth documentation remain sequential unless worktrees and ownership are explicitly isolated.

Scheduled monitoring is read-only by default. It may compare current evidence with the dashboard and recommend the next assignment, but it may not modify files, launch workers, commit, publish, or make product decisions. Routine checks use deterministic scripts and efficient routing; expensive reasoning and asset generation are reserved for uncertain or high-risk work.

## Audit policy

Deterministic gates run after every implementation. Before the first reviewable milestone, do not offer an audit unless the user explicitly requests one. Define the milestone concretely in `docs/PROJECT_BRIEF.md`: a usable end-to-end demo for software, a complete rendered draft for documents/media, a functioning testable workflow for automation/configuration, or a complete reproducible output for data work.

When the milestone criteria and deterministic gates pass, offer the first bounded audit. If declined, create no audit task. If approved, freeze scope, baseline, acceptance criteria, checks, and human gates; use one writer and independent read-only review; allow no more than three review passes and two fix rounds; stop on repeated failure, no measurable progress, missing decisions, scope expansion, secrets, destructive actions, or external writes; and save a dated report under `docs/audits/` with status `pass`, `fail`, or `needs-decision`. After the first audit—or after a declined first offer—offer another only following a material change with meaningful regression or safety risk; category or diff size alone does not qualify.

Record the date and outcome of the first eligible offer in `PLANS.md`. A decline creates no audit task or report, but the durable marker prevents repeated offers from later tasks unless a qualifying risk change occurs.

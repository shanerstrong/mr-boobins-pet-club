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
8. Read `docs/production/CREATIVE_DIRECTION.md` before visual or media work. Mark's explicit likes and rejections are binding production evidence.

## Task operating model

- `00 — Project Q&A (Read-Only)` and `01 — Tooling & Alternatives (Paid · Free · Open Source)` are the lean permanent baseline.

- `03 — Goals & Delivery Monitor (Read-Only)` is recommended because: multiple milestones, multiple build tracks, persistent goal, multi-artifact release, multiple approval gates.
- `04 — Master Orchestrator (Coordinator)` is recommended for multiple build tracks; it coordinates at most three workers and never writes project files.
- Read-only tasks may inspect, browse, explain, compare, and produce decision-complete handoffs. They cannot edit files or documentation; change Git, dependencies, tasks, or external systems; or implement work.
- Use temporary `Build — <Milestone>`, `Review — <Milestone>`, and approved `Audit — <Milestone>` tasks for authorized work. Keep one writer per checkout and archive temporary tasks after durable results are recorded.
- See `docs/PROJECT_OPERATING_MODEL.md`, `docs/TASK_CHARTERS.md`, and `docs/MODEL_ROUTING.md` for the complete rules.

## Lean production control

- Treat `docs/production/PRODUCTION_DASHBOARD.md` as the current delivery view and keep durable product decisions in `docs/DECISIONS.md`.
- Advance one reviewable milestone at a time. Permit at most three independent work lanes only after their shared contracts and file ownership are stable.
- Keep the repository as the development source of truth. Google Drive is a curated phone-review mirror, not a competing code or asset library.
- For this project, use Google Drive only for approved external review or preservation workflows; do not introduce iCloud as a second storage path. If a future request proposes iCloud, first explain the Android/cross-platform, collaborator-access, automation/connector, and source-of-truth tradeoffs and wait for a new decision.
- Use deterministic scripts for repeatable checks before spending model time on judgment. Use reference → inexpensive concept → approval → production asset → integration → verification for visual and media work.
- Keep technical validation and subjective approval separate. Only Mark can mark subjective work accepted or locked; Codex may report objective checks but cannot self-approve the look.
- A clear creative rejection stops that method or direction. Do not keep polishing, quietly retrying, or praising it; propose a materially different approach or reference set first.
- Apply the four-tier asset policy in `docs/production/asset-policy.v1.json`: normal Git for code, manifests, licenses, small runtime assets, and representative evidence; path-scoped LFS only for canonical editable sources; checksum-indexed cold archive for rejected/raw/redundant bulk; and private local storage with recoverable backup for non-public material.
- Inventory and hash existing work before classifying it. Never ignore, relocate, archive, remove, or make a current file subject to LFS conversion until its preservation destination is approved and verified. A checksum is identity evidence, not a backup.
- Keep GitHub Pages runtime assets in normal Git unless the deployment workflow explicitly fetches and verifies LFS objects.
- Keep scheduled production checks read-only and quiet when nothing material changed. Do not add a custom API control plane until measured coordination cost justifies maintaining another product.
- See `docs/production/CREATIVE_DIRECTION.md`, `docs/production/ASSET_PIPELINE.md`, and `docs/production/EXPANSION_ARCHITECTURE.md` for content-production contracts.

## Bounded review/fix loop

- Maximum three review passes total and two fix rounds.
- Stop on repeated failure, no measurable progress, missing decisions, scope expansion, secrets, destructive/external actions, or the pass limit.
- Never auto-commit, merge, push, create a PR, publish, deploy, or contact third parties.

Deterministic quality gates run after every implementation. Before the first reviewable milestone, run those gates without offering an audit unless the user explicitly requests one. Offer the first bounded audit only after the concrete milestone criteria in `docs/PROJECT_BRIEF.md` are satisfied. After the first audit—or after a declined first offer—offer another audit only following a material change with meaningful regression or safety risk. Every audit remains opt-in. If declined, create no audit task. If approved, freeze scope and acceptance criteria, use one writer plus independent read-only review, and store a dated report under `docs/audits/`.

## Human gates

Require explicit approval for destructive operations, credentials, writes outside this workspace, commits, pushes, PRs, releases, publishing, deployment, and material product decisions.

When exact approval or authorization wording, commands, IDs, or other copy-sensitive text is required, provide the complete paste-ready text in a fenced `text` block so Mark can copy it in one action. Do not put ordinary conversational questions in code blocks unnecessarily.

## Google Drive mobile-review mirror

- Mirror user-facing design, image, document, and media deliverables to the Google Drive folder [`apps/Mr. Boobins' Pet Club`](https://drive.google.com/drive/folders/1Y_StiGFl17ATHM-nmiicHmHckcbujcpZ) before handing them off so Mark can review them on a phone.
- Keep repository files as the development source of truth. Treat Drive copies as review mirrors unless Mark explicitly promotes a Google file to source-of-truth status.
- Prefer stable filenames and update an existing Drive file in place when practical instead of creating duplicate versions. Verify the completed upload or update and return observed Drive links.
- Upload phone-viewable exports alongside editable/source artifacts when useful. Do not upload private reference photos, secrets, credentials, logs, raw user data, build caches, or unrelated project files without separate explicit approval.
- The separately approved private preservation root is not the phone-review mirror. Keep cold-archive and private-backup material restricted, in their designated preservation subfolders, and out of public/link sharing.

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

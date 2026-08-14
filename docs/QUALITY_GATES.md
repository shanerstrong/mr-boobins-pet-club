# Quality gates

Run the applicable commands before declaring the V0 implementation complete:

- Current Project Kit/documentation gate: `git diff --check`.
- Current configuration parse gate: `powershell.exe -NoProfile -Command "Get-Content -Raw '.codex-kit/model-routing.json' | ConvertFrom-Json | Out-Null; Get-Content -Raw '.codex-kit/manifest.json' | ConvertFrom-Json | Out-Null"`.
- Lint: `npm run lint`.
- Type check: `npm run typecheck`.
- Deterministic unit tests: `npm test`.
- Production web export: `npm run export:web`.
- Static-export smoke check (run after export): `npm run smoke`.
- Dependency/security check: `npm run check:deps` (fails only for critical production dependency advisories; report moderate/high findings as release risks rather than hiding them).
- Simulation and persistence tests cover accelerated need decay, care effects, elapsed time, backward clock protection, large-jump capping, exact persisted-state validation, and save/load round trips. Loading distinguishes missing, valid, invalid, and unavailable storage; invalid raw saves are retained until an explicit reset, while unavailable storage is session-only.
- Visual QA captures the primary color pet-room screen, one action response, and a persisted refresh at a 390px phone viewport plus a desktop viewport. LCD, classic controls, and Boop reaction captures are deferred outside V0.
- Accessibility checks cover labels, logical focus order, readable contrast, reduced motion, no audio, and 44px-or-larger touch targets.

## Required evidence

- Capture the command and exit status.
- Report skipped checks and why they could not run.
- Render or open artifacts when visual layout matters.
- Do not weaken a gate merely to make a change pass.

## GitHub Pages export configuration

`app.config.ts` defaults to `/` for local and root-hosted use. The public project Pages build uses:

`EXPO_PUBLIC_BASE_URL=/mr-boobins-pet-club/ npm run export:web`

For local PowerShell verification, use:

`$env:EXPO_PUBLIC_BASE_URL='/mr-boobins-pet-club/'; npm run export:web`

`.github/workflows/deploy-pages.yml` runs the public build after `npm ci`, lint, type checking, and tests, then uploads `dist/` to GitHub Pages.

## Review limits

Allow at most three review passes and two fix rounds. Stop on repeated failure, no improvement, missing product decisions, scope expansion, secrets, or consequential external actions.

## Prototype-first audit gate

Run deterministic gates after every implementation without asking. Before the first reviewable milestone, do not offer an audit unless the user explicitly requests one. Define the project's concrete milestone criteria in `docs/PROJECT_BRIEF.md` using the applicable baseline: a usable end-to-end demo for software, a complete rendered draft for documents/media, a functioning testable workflow for automation/configuration, or a complete reproducible output for data work.

When those criteria and the deterministic gates pass, offer the first bounded audit. If declined, create no audit task. If approved, freeze scope, baseline, acceptance criteria, checks, and human-gated actions; use one writer and independent read-only review; allow non-destructive fixes inside the frozen scope; permit no more than three review passes and two fix rounds; and save a dated report under `docs/audits/` with status `pass`, `fail`, or `needs-decision`.

After the first audit—or after a declined first offer—offer another audit only following a material change with meaningful regression or safety risk. Potential categories include new user-facing features or major UI flows; architecture, dependencies, build configuration, or data-model changes; authentication, sensitive data, payments, security, or privacy work; persistence, migrations, import/export, release, or deployment changes; and cross-cutting refactors. Category or diff size alone does not qualify. A material change before the first reviewable milestone still receives proportionate deterministic checks but does not independently trigger an audit offer.

Record the date and outcome of the first eligible offer in `PLANS.md`. A declined offer creates no audit task or report, but the durable marker prevents a fresh task from re-offering without a later qualifying risk change.

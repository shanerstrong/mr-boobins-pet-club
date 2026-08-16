# Quality gates

Run the applicable commands before declaring the V0 implementation complete:

- Current Project Kit/documentation gate: `git diff --check`.
- Current configuration parse gate: `powershell.exe -NoProfile -Command "Get-Content -Raw '.codex-kit/model-routing.json' | ConvertFrom-Json | Out-Null; Get-Content -Raw '.codex-kit/manifest.json' | ConvertFrom-Json | Out-Null"`.
- Asset-control gate: `npm run check:assets` (validates required manifests and provenance records, captured hashes, budgets, runtime imports, LFS pointers, ordinary-Git size limits, and representative-evidence retention).
- Lint: `npm run lint`.
- Type check: `npm run typecheck`.
- Deterministic unit tests: `npm test` (including adaptive idle/play/sleep music selection, stable no-restart transitions, and the exact 3000ms PLAY policy).
- Training tests cover Sit/Paw/Up end to end, guarded single-treat transitions, stale event rejection, celebration-only replay, strict separate progress loading/saving/failures, learned-state persistence, deterministic three-celebration rotation, and exact agreement with the approved V2 command/contact/eating/celebration manifest.
- Production web export: `npm run export:web`.
- Static-export smoke check (run after export): `npm run smoke`.
- Dependency/security check: `npm run check:deps` (fails only for critical production dependency advisories; report moderate/high findings as release risks rather than hiding them).
- Simulation and persistence tests cover V1/V2/V3/V4/V5→V6 migration, strict V6 schema, trimmed 1–12 character nicknames, persistent Cozy/Blue/Garden themes, separate strict audio preferences and failures, virtual-clock boundaries/midnight/accelerated rates, hygiene thresholds, all cleaning phases, every Boop priority/cooldown/restriction/no-mutation rule, starvation/death and frozen state, reset-ready Baby creation, meal-and-time growth boundaries, hunger-cycle feed-farming prevention, switching continuity, timed naps, fractional ticks, rollback/large jumps, and pet save/load failures. Pet loading distinguishes missing, valid, invalid, and unavailable storage; malformed and parseable-but-schema-invalid raw pet saves are retained until an explicit reset, while unavailable storage is session-only.
- Visual QA captures the title, pet hub, primary living room, settings, feeding, three-second PLAY/zoomies, cleaning, Boop, horizontal timed-sleep/wake, dirty, tired, death, and persisted refresh behavior at 390×844 and 1440×900. Confirm the mobile scene is about 380–410px high, needs use a compact 2×2 arrangement, all controls remain reachable without horizontal overflow, Jack reads as a white floppy-eared dog with a blue collar and tail behind, and reduced motion preserves state meaning. LCD and classic controls remain outside V0.6.
- Training visual QA covers the command picker, completed command pose, one-tap Give Treat state, visible treat travel/contact, eating, each of the three celebrations, Show Again/Done, learned status after refresh, modal accessibility isolation, and muted comprehension at 320×568, 390×844, and 430×932; confirm the existing room and desktop composition remain intact at 1440×900.
- Meshy/3D runtime QA verifies the bundled Baby V2 all-clips GLB loads without runtime errors, camera controls remain absent, Baby/Little Puppy use the fixed scene, unsupported age skins and reduced motion retain the pixel fallback, direct object/nose targets remain accessible above the canvas, Sit/Paw/Up hold their named reward-wait poses, treat contact and celebration-only replay remain guarded, and the room has no horizontal overflow at 320×568, 390×844, and 1440×900.
- Accessibility checks cover labels, logical focus order, readable contrast, reduced motion (including modal animation suppression), individually reachable modal controls, muted-by-default local audio that only follows a user gesture, and 44px-or-larger touch targets.
- Audio QA verifies the playback-only Expo Audio plugin configuration (no recording or background media permissions), original WAV headers/durations including shower/sneeze/huff and idle/play/sleep music, default-off separate SFX/music preferences, the ENTER/VISIT ROOM gesture gate, mutually exclusive adaptive looping music (idle normally, play only for the three-second PLAY state, sleep while asleep), stable no-restart transitions, and immediate SFX mute/pause behavior.

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

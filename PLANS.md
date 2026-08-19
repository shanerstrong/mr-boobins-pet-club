# Plans

## Lean production-control framework — 2026-08-16

Production now uses one manager/approval surface, one repository source of truth, a curated Google Drive review mirror, and temporary bounded worker tasks. `docs/production/PRODUCTION_DASHBOARD.md` is the concise current-state view. One reviewable milestone advances at a time; at most three isolated lanes may run only after shared contracts and ownership are stable. Scheduled monitoring remains read-only, and a custom OpenAI API control plane is deferred until measured coordination cost justifies building and maintaining it.

The recoverable V0.6–V0.8 baseline, Safe Return, and Alpha Inspect checkpoints are committed locally; their asset inventory, restricted Drive preservation, append-only context history, and deterministic verifier remain authoritative. The active uncommitted working scope is Health, Attention, Status & Medicine through strict V7 migration. After its complete gate handoff, the ordered path is LCD presentation, then classic-control parity for the original first reviewable milestone. Expansion readiness is limited to stable content IDs, pack manifests, compatibility/fallback rules, and an entitlement adapter boundary; storefronts, payments, and paid packs remain deferred.

## Health, Attention, Status & Medicine — 2026-08-18

The strict V7 pet schema adds health, attention, and an independent wellbeing timestamp while leaving every V1–V6 schema strict and migratable. Migration initializes health at `100` and attention at `80` without applying pre-upgrade decay; Safe Return still advances legacy needs, age, and sleep once at fixed 1× with a four-pet-hour offline cap and no offline death. Attention decays `0.10` awake or `0.04` sleeping per pet-minute and PLAY restores `28`. Health has no unconditional decay or passive recovery: it loses only the additive approved rates while hunger, hygiene, or attention are below `20`. Health zero is nonfatal; active starvation remains the sole death path.

Status is a read-only App-used typed intent that shows all six needs, Great/Needs Care/Unwell/Very Unwell health bands, and one deterministic recommendation in the approved order. Medicine is a separate typed intent available only while alive, awake, care-reachable, and below `80`; it restores `25` capped at `100` and has no inventory, cost, cooldown, network path, age effect, starvation effect, or resurrection authority. Deterministic simulation, migration, delayed-Clean journal, App-policy, lifecycle, rollback, offline-cap, starvation/death, and focus/isolation tests preserve the earlier Safe Return and reset/retry contracts. LCD presentation, classic controls, cinematic work, assets, dependencies, and unrelated balance remain outside this slice.

Future visual work follows reference → inexpensive concept → Mark's direction approval → production asset → integration → rendered verification. `docs/production/CREATIVE_DIRECTION.md` is the durable taste record: objective technical success never counts as subjective approval, only Mark can accept or lock a look, and one clear rejection stops that method until the approach or references materially change. Meshy or another 3D tool may create consistent characters and reusable poses, but generated geometry is never treated as proof of anatomy, exercise technique, likeness, licensing, or accessibility.

## Safe Return and Baby Day 1 closure — 2026-08-16

Player time now defaults to 1×. The production app has no acceleration control or configuration; test acceleration exists only as an injected lifecycle input and cannot change offline results. One lifecycle authority settles foreground care-room time, pauses active ticks on title/hub/settings and while backgrounded, applies fixed-1× offline advancement once on resume, caps it at four pet-hours, stamps the full current time, and routes long suspensions through the same safe offline path. Pre-adoption state stamps time without decay. Offline advancement preserves starvation exactly and cannot turn an alive pet dead; already-dead saves remain frozen. Active cartoony death remains possible only after 120 zero-hunger pet minutes in the reachable foreground care room. The strict V6 schema and malformed-save retention contract remain unchanged.

The bounded review fix round makes care reachability explicit at every Sleep, Training, Restart, and cleaning-lock boundary. The coordinator records foreground/background state before pet hydration, so a save loaded while hidden retains the full absence for exactly one resume catch-up. Delayed Clean completes first-care guidance only in the same uncancelled callback that commits hygiene; background/unmount cancellation changes neither. App and deterministic integration tests execute these exported coordinator, clean-commit, and Sleep-focus seams directly without a new dependency.

The persistence-closure milestones make the delayed Clean and explicit New Baby pairs durable without trusting wall-clock, independent promise ordering, or a rejected storage promise as proof that no write landed. One App-used serialization authority orders ordinary pet/guide saves, Clean, background cancellation, and resets. A strict V2 prepared journal records the exact readable before snapshot and post-Clean V6 pet/guide pair before the separate keys; operation-tagged V3 remains the preservation-only background/cancellation supersession path. Prepared V2/V3 recovery accepts only before/before, after/before, or after/after, while cross-generation and impossible before-pet/after-guide records are rejected. Committed residue never replaces current state, so same-generation Feed/PLAY/sleep/theme changes survive even when the device clock is backward. Deliberate START FRESH and confirmed Restart instead use strict V4 `explicit-reset`, which records the exact raw pet/guide values (including malformed or missing raw), the exact reset-ready Baby pair, and the target generation before either legacy key is replaced. For V2 and V4, an initial journal rejection requires strict read-back: exact prepared raw continues as durable; a missing key publishes/applies nothing and returns a truthful retry; unavailable or nonexact/malformed/mismatched raw retains the exact authorized intent and a conflicting-write barrier while the UI says the save outcome is still being safely checked. Foreground, restored storage, or process reload then rechecks and completes only an exact surviving prepared transaction, without granting automatic explicit-reset authority. Once prepared, the serialized App recovery seam completes only a legal before/before → after/before → after/after path and writes the missing pet, guide, then committed marker before time stamping, ordinary saves, or publication. A committed-but-unpublished reset or recovered Clean retains a publication barrier so hidden/stale UI cannot overwrite it; foreground/reload publishes once and acknowledges the exact durable pair before later gameplay saves resume. Raw divergence, impossible ordering, malformed journal data, target mismatch, and unavailable storage remain unmasked; committed V4 residue is cleanup-only. Automatic/background V3 still refuses malformed/unavailable raw. App and failure-injection tests execute the same serialized journal save/load/controller seams across every boundary.

App-level policy/component regressions cover adoption and route boundaries, repeated foreground/background events, clock rollback and very large jumps, all offline-cap boundaries, reload-persistent first-care guidance, sleeping/disabled-action suppression, live return summaries without an away-death branch, single ADOPT/VISIT CTA behavior, and sleep-dialog initial focus, focus trapping/isolation, Escape close, and trigger-focus restoration. Representative live captures use the established five Baby Day 1 evidence paths at exact 390×844 phone and 1440×900 desktop viewports. Health/attention/status/medicine, LCD mode, classic controls, publishing, dependency changes, and commerce remain outside this tranche.

The command, browser, capture-dimension, checksum, remaining-risk, and no-external-action record is `docs/production/SAFE_RETURN_VERIFICATION.md`.

## Studio production roadmap and Baby Day 1 slice — 2026-08-15

The end-to-end greenlight → pre-production → vertical slice → production → alpha → beta → release-candidate → operations plan is recorded in `docs/GAME_PRODUCTION_PLAN.md`. The current working build is classified as a pre-alpha representative slice. It proves the technical spine but does not yet satisfy the original first reviewable milestone.

The first implementation slice improved the child-facing adoption and return loop without changing the V6 simulation schema. It replaced duplicate ADOPT/VISIT actions with one context-aware action, persisted first-care completion in a separate strict record, derived return guidance from live pet state, limited 3D Boop to the authored nose target, removed eager GLB preload, extended modal accessibility isolation, placed initial focus inside the sleep dialog, added visible focus treatment to shared controls, and strengthened static-export asset verification. The follow-up Safe Return tranche resolves the formerly open clock/death policy without changing that schema.

The combined Baby Day 1 and Safe Return work deliberately excludes health/attention/medicine, LCD/classic parity, more pets, all-age 3D integration, cloud/accounts/analytics/monetization, native packaging, publishing, and deployment. Verification uses every exact deterministic gate in `docs/QUALITY_GATES.md` plus rendered mobile/desktop interaction checks. It is done when the new flow works at 390×844 and 1440×900, the lifecycle/return/component tests pass, the export contains all required runtime assets, and existing care/training/persistence behavior remains intact. Stop for a requested scope change, destructive/Git/external action, or a conflict that cannot preserve the committed V0.6–V0.8 baseline and excluded originals.

## V0.8 Meshy Baby Jack runtime integration — 2026-08-15

The browser room now loads the validated Meshy-derived Baby V2 all-clips GLB inside one fixed-camera original low-poly dollhouse. The adapter maps existing care and Training Mode states onto the locked V2 clip vocabulary, holds Sit/Paw/Up at their approved pose markers while Give Treat awaits input, and restarts celebration-only replay through a presentation revision without duplicating rewards. Code-native HUD, modal, object targets, and action controls remain the functional accessibility layer.

Baby and Little Puppy use 3D when WebGL and the model load successfully. Reduced motion, unsupported rendering, and Puppy/Young Dog/Adult stages retain the existing pixel scene until their V2 age skins are independently compatible and approved. Verification includes manifest-backed clip mapping, production GLB bundling, runtime error inspection, responsive visual checks at 320×568, 390×844, and 1440×900, one-treat Training flow, celebration-only replay, and pixel fallback preservation.

## V0.7 pixel Training Mode — 2026-08-15

V0.7 adds an approved, child-friendly Training Mode to the existing pixel living room. The mobile fifth action is now **Train** and Settings moves to a 44px top-panel gear. Training keeps Jack visible while a compact modal progresses through Sit, Paw, or Up; one unlimited treat; treat contact and eating; and a deterministic no-repeat rotation of Happy Hop, Spin-and-Wag, and Goofy Shimmy. Show Again replays only the earned celebration and Done returns to the room.

Training uses a guarded pure state machine and the approved V2 animation event contract. Command completion, `treat_contact`, eating completion, and celebration completion advance the flow; stale callbacks, overlapping commands, and duplicate treats are rejected. Learned booleans and a hidden celebration cursor use a separate strict local V1 record, leaving the V6 pet simulation/save untouched. There is no inventory, currency, purchase, streak, penalty, punishment, account, microphone, advertising, network dependency, or child-data path.

Verification includes the exact project gates plus training reducer/persistence/manifest tests, muted text comprehension, reduced-motion still poses, modal accessibility isolation, all three browser-driven command loops, persisted refresh, and visual checks at 320×568, 390×844, 430×932, and 1440×900.

## V0.6 local polish milestone — 2026-08-14

V0.6 focuses on room readability and Jack's personality without changing the V6 save format. The room now gives the code-native dog scene visual priority, compresses needs into a two-column grid, and uses a stable two-row care dock with 48px actions. Jack remains provisional, completely white, and blue-collared, but now has a rounded canine head and muzzle, two floppy ears, four readable paws, a collar tag, and a tail layered behind his body.

The original soundtrack is adaptive after the existing player-gesture gate: a slow calm loop plays while Jack is idle, the prior upbeat melody plays only during the full three-second PLAY/zoomies response, and a soft lullaby plays while he sleeps. Music transitions pause other tracks and do not restart because of unrelated state or SFX changes. Reduced motion removes zoom travel while preserving the same three-second readable PLAY state. This visual/audio polish is intentionally implemented before any new bounded audit.

## V0.5 local milestone — 2026-08-14

V0.5 implements the approved Figma-first title → pet hub → living-room flow at mobile and desktop sizes. Every launch begins on the silent title screen, then shows Jack and a locked coming-soon pet card before entering the room. Strict V6 saves rename `introCompleted` to `adoptionCompleted`, replace `backgroundId` with persisted Cozy/Blue/Garden `roomTheme`, retain V1–V5 migrations and invalid-save retention, and keep the accelerated clock rate session-only. Remembered SFX/music preferences are stored separately and remain playback-gated until ENTER or VISIT ROOM.

The room derives its digital clock and automatic Morning/Day/Dusk/Night lighting from virtual age. It adds a completely white, blue-collared Jack with his tail behind his body; nose and BOOP control parity; condition-priority Boop responses without need changes; three hygiene appearances; the 1.5-second water → washout → shake → sparkle cleaning sequence; and fixed-position care controls/messages. Existing meal-and-time growth, starvation/death, timed sleep, forced wake, original local audio, and reduced-motion behavior remain in scope. The authoritative design handoff is `docs/V0.5_FIGMA_HANDOFF.md`.

## V0.4 local milestone — 2026-08-14

V0.4 introduces strict V5 saves, persistent Sunny Room/Moonlight Room/Backyard scene selection, deterministic zero-hunger starvation and a gentle permanent death state, while retaining V4 meal-and-time growth. It adds a fixed-height live message slot, treat-to-mouth feed response, bounded zoomies, and a code-native Baby Jack intro. The standing post-implementation audit remains a separate human-gated phase and no V0.4 audit report is created by this build turn.

## V0.3 local milestone — 2026-08-14

V0.3 adds the first-time **Meet Baby Jack** introduction, a confirmed **New Baby** restart for existing saves, five code-native growth stages gated by both 0/5/10/15/20 accumulated pet-hour checkpoints and earned meal credits, player-directed timed naps with automatic wake feedback, a distinct lying-down sleep pose, richer need-aware poses/emotes, and separate opt-in SFX and looping music controls. Strict V4 saves migrate V1/V2/V3 needs, age, and prior sleeping state safely; invalid saves remain unreplaced until the player chooses Start Fresh. The broader LCD/classic-control milestone remains deferred.

## Current objective

Deliver a locally verified, GitHub-Pages-ready V0 web demo of the original color pet room. It is a deliberately smaller pre-milestone slice of the broader prototype described in `docs/PROJECT_BRIEF.md`.

Current scope status:

- Product identity and the broader future milestone boundary are recorded.
- V0 uses Expo / React Native / TypeScript with static web export and a configurable Pages base URL.
- V0 has one original, code-native provisional white pixel Jack; no reference likeness has been approved yet.
- V0.6 includes adaptive local opt-in playback-only music, compact care controls, and a more recognizable provisional Jack, but still excludes LCD mode, classic controls, health/medicine, discipline, accounts, cloud, native packaging, and multiple playable pets.

## V0 implementation charter — 2026-08-14

**Objective and user outcome.** A player can meet Baby Jack in an original retro pet room, restart safely as a fresh baby when desired, see five visible growth steps from accumulated pet time, choose a timed nap, observe his horizontal sleeping pose and automatic wake reaction, care for him with clear direct controls, and return to the same local save after refresh or browser reopen.

**Scope and architecture.** `App.tsx` uses a deterministic mount gate before storage/audio runtime initialization, then owns title/hub/room/settings presentation and an accessibility-aware animation/audio layer. `src/simulation.ts` is a pure deterministic V6 state model with a 1× player clock, injected test-only acceleration, virtual daylight, Boop/hygiene/cleaning rules, clamped care effects, backward-clock protection, timed virtual-age sleep targets, earned growth-meal credits, and fixed-1× offline advancement capped at four pet-hours without offline death. `src/app-lifecycle.ts` limits active starvation to the foreground care room and applies offline catch-up once on resume. `src/persistence.ts` stores the pet and strict audio preferences through separate AsyncStorage keys. `src/pixel-dog.tsx` contains the original code-native living room and white pixel Jack. There is no network call or account flow.

**Responsive and visual rules.** Phone-first single column; desktop uses a balanced split room. The mobile pet stage is about 390px high, need cards form a compact 2×2 grid, care actions form a stable shallow dock, and every touch target remains at least 44px. Controls and modals have explicit accessible labels, contrast is intentionally high, local SFX/music starts off and follows a gesture, and reduced-motion users receive readable still action states without decorative travel.

**Verification.** Run every exact command in `docs/QUALITY_GATES.md`; then open the local web app at a phone and desktop viewport if browser tooling is available. Capture the primary room, an action response, and a persisted-refresh result in `evidence/`.

**Definition of done.** The listed V0 behaviors work, deterministic simulation and persistence tests pass, production static export contains `dist/index.html` and Expo assets, documentation describes actual commands and architecture, and no Git or external-system mutation occurs.

**Stop conditions.** Stop for a changed scope, missing approved Jack reference art, a security finding that needs a dependency-level decision, external publishing/authentication, or any requested Git operation.

Before non-trivial implementation, record:

- Objective and intended user outcome.
- In-scope and out-of-scope behavior.
- Interfaces, data flow, and compatibility constraints.
- The concrete first reviewable milestone from `docs/PROJECT_BRIEF.md`; do not offer the first audit until it is satisfied.
- Verification commands and artifact checks.
- Definition of done and stop conditions.

Keep active plans decision-complete. Move durable architectural decisions into `docs/DECISIONS.md`.

## Audit lifecycle

- Standing user preference: after every user-requested implementation, run the bounded audit workflow automatically before offering publication or release actions, while preserving all existing human gates for Git, external writes, deployment, credentials, and product decisions.
- First eligible audit: explicitly approved, started, and passed on 2026-08-14 after two fix rounds and three review passes.
- Current report status: `pass`; see `docs/audits/2026-08-14-v0.3.md`. No publication is authorized by this lifecycle record.
- V0.4 formal audit: approved and passed on 2026-08-14 after three review passes and two fix rounds. See `docs/audits/2026-08-14-v0.4.md`. No publication is authorized by this lifecycle record.
- V0.5 bounded audit: approved and passed on 2026-08-14 after three review passes and two fix rounds. See `docs/audits/2026-08-14-v0.5.md`. The documented dependency release risk remains; no publication is authorized by this lifecycle record.

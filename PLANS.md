# Plans

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
- V0.5 includes local opt-in playback-only SFX/music and Boop the Snoot, but still excludes LCD mode, classic controls, health/medicine, discipline, accounts, cloud, native packaging, and multiple playable pets.

## V0 implementation charter — 2026-08-14

**Objective and user outcome.** A player can meet Baby Jack in an original retro pet room, restart safely as a fresh baby when desired, see five visible growth steps from accumulated pet time, choose a timed nap, observe his horizontal sleeping pose and automatic wake reaction, care for him with clear direct controls, and return to the same local save after refresh or browser reopen.

**Scope and architecture.** `App.tsx` uses a deterministic mount gate before storage/audio runtime initialization, then owns title/hub/room/settings presentation and an accessibility-aware animation/audio layer. `src/simulation.ts` is a pure deterministic V6 state model with a 12× default test clock, virtual daylight, Boop/hygiene/cleaning rules, clamped care effects, backward-clock protection, timed virtual-age sleep targets, earned growth-meal credits, and a 24-hour real-time catch-up cap. `src/persistence.ts` stores the pet and strict audio preferences through separate AsyncStorage keys. `src/pixel-dog.tsx` contains the original code-native living room and white pixel Jack. There is no network call or account flow.

**Responsive and visual rules.** Phone-first single column; content centers at 760px on wider screens. Care buttons maintain at least 64px height and supporting controls at least 44px, all controls and modals have explicit accessible labels, contrast is intentionally high, local SFX/music starts off and follows a gesture, and reduced-motion users receive a still sprite rather than idle/action movement.

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

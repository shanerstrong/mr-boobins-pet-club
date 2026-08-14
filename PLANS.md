# Plans

## Current objective

Deliver a locally verified, GitHub-Pages-ready V0 web demo of the original color pet room. It is a deliberately smaller pre-milestone slice of the broader prototype described in `docs/PROJECT_BRIEF.md`.

Current scope status:

- Product identity and the broader future milestone boundary are recorded.
- V0 uses Expo / React Native / TypeScript with static web export and a configurable Pages base URL.
- V0 has one original, code-native provisional pixel Jack; no reference likeness has been approved yet.
- V0 deliberately excludes LCD mode, classic controls, snoot-booping, audio, health/medicine, discipline, accounts, cloud, native packaging, and multiple pets.

## V0 implementation charter — 2026-08-14

**Objective and user outcome.** A player can open Jack's original retro pet room in a phone or desktop browser, see four needs decay on an accelerated test clock, care for him with clear direct controls, observe an idle/action reaction, and return to the same local save after refresh or browser reopen.

**Scope and architecture.** `App.tsx` owns presentation and an accessibility-aware animation layer. `src/simulation.ts` is a pure deterministic state model with a 12× test clock, clamped care effects, backward-clock protection, and a 24-hour real-time catch-up cap. `src/persistence.ts` stores the versioned state through AsyncStorage (web local storage today, mobile-compatible later). `src/pixel-dog.tsx` contains original code-native rectangle pixel art. There is no network call or account flow.

**Responsive and visual rules.** Phone-first single column; content centers at 760px on wider screens. Care buttons maintain at least 84px height, all controls have explicit accessible labels, audio is absent, contrast is intentionally high, and reduced-motion users receive a still sprite rather than idle/action movement.

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

- Current state: `pre-milestone`; the first audit offer has not been made.
- When the first eligible offer is made, record its date and outcome here. A decline creates no audit task or report, but the marker prevents repeated offers unless a later material change introduces meaningful regression or safety risk.

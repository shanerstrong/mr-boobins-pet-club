# Project brief: Mr. Boobins' Pet Club

## Goal

Create **Mr. Boobins' Pet Club**, an original virtual-pet game inspired by the care rhythm of classic keychain pets without copying Tamagotchi branding or protected expression. The first playable pet is Jack, whose nickname is Mr. Boobins; the product must support additional pets later.

## Audience

The initial players are Rose and her niece and nephew. They should be able to adopt a pet, understand what it needs, care for it in short sessions, and enjoy expressive reactions without needing gaming experience.

## Success criteria

- A player can create or load a local pet and return to the same state after closing the app.
- Hunger, happiness, hygiene, health, energy, age, and attention change predictably over time.
- Feeding, playing, cleaning, resting, medicine/health care, discipline/training, and status inspection produce visible feedback.
- Touching the pet's nose triggers a distinct, funny **Boop the Snoot** reaction.
- The same underlying pet state works in both an LCD-inspired monochrome presentation and a full-color retro pixel presentation.
- Both classic three-button navigation and a clearly labeled direct-control mode can complete the core care loop.
- All shipped characters, sprites, icons, sounds, text, and screen compositions are original or properly licensed.
- The prototype is usable without an account, network connection, advertising, purchases, or uploading a child's data.

## First reviewable milestone

The first reviewable milestone is a usable end-to-end local prototype on the selected primary platform in which a player can:

1. start a new game with Jack;
2. view needs changing through a testable accelerated clock;
3. feed, play with, clean, rest, inspect, and care for Jack;
4. boop Jack's nose and receive an animated/audio reaction;
5. switch between LCD and color-pixel presentation without losing state;
6. complete the same core actions using classic and direct controls; and
7. close and reopen the app with pet state preserved.

The milestone also requires passing the project-specific deterministic checks recorded in `docs/QUALITY_GATES.md` and capturing representative screens for both presentation modes and both control schemes.

Before this milestone, continue running deterministic quality gates without offering an audit unless the user explicitly requests one.

## In scope

- One local player profile and one playable pet: Jack.
- Core need simulation, care actions, feedback, persistence, and safe clock handling.
- LCD-inspired and full-color pixel display modes using an original visual system.
- Classic three-button and direct touch-control modes.
- Boop the Snoot interaction.
- A data model that can add pets later without rewriting the core simulation.

## Out of scope

- App Store submission, trademark filing, publishing, deployment, and monetization.
- Accounts, cloud synchronization, social features, analytics, advertising, and in-app purchases.
- User photo upload, image-to-pixel-pet generation, or remote image processing.
- Multiple playable species, breeding, online trading, and live events.
- A one-to-one reproduction of Tamagotchi artwork, characters, wording, sounds, menus, shell design, or screen layouts.

## Constraints

- Choose the primary app stack before feature implementation and then replace provisional checks with commands that actually exist.
- Prefer offline-first, local-only storage for the first milestone.
- Treat future pet photos as private user content; do not transmit or retain them externally without a separate approved privacy design.
- Do not collect personal data from children in the first milestone.
- Keep controls readable and forgiving for children and inexperienced players; avoid dark patterns and punitive monetization.
- Preserve pet-state integrity across clock changes, backgrounding, crashes, and version upgrades.
- Use original visual/audio assets and a distinct overall presentation.
- Support reduced motion, muted audio, readable contrast, and touch targets appropriate for the selected platform.

## Source of truth

- This brief and durable decisions in `docs/DECISIONS.md`.
- Accepted implementation plans recorded in `PLANS.md`.
- Future approved design tokens, state diagrams, and original Jack reference photos stored inside this repository.
- `docs/QUALITY_GATES.md` for completion evidence.

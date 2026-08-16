# Mr. Boobins' Pet Club — studio production plan

Status: active production roadmap<br>
Baseline assessed: 2026-08-15 working tree (V0.8 representative slice)<br>
Product source of truth: `docs/PROJECT_BRIEF.md` and `docs/DECISIONS.md`

## 1. Executive production call

Mr. Boobins' Pet Club is in **pre-alpha / representative-slice** development. The current build proves the difficult technical spine: deterministic care simulation, strict local saves and migrations, direct controls, Training Mode, original audio, responsive web UI, Baby/Little-Puppy 3D presentation, and a pixel fallback. It is not yet feature-complete against the first reviewable milestone.

The production strategy is:

1. stabilize and playtest the Baby Day 1 return loop;
2. complete the documented first reviewable milestone;
3. turn that milestone into a measured family vertical slice;
4. enter feature/content production only after the slice is understood without coaching;
5. freeze features at alpha, freeze content at beta, and publish only through a separately approved release gate; and
6. operate the finished game as a local/offline product, not as a child-focused live service.

No engine rewrite is planned. Expo, React Native, TypeScript, AsyncStorage, Expo Audio, Three.js/React Three Fiber, GLB runtime assets, and the pure policy modules are suitable for the intended compact game.

## 2. Product pillars and non-negotiables

| Pillar | Production test |
| --- | --- |
| A pet, not a dashboard | Jack's expression and reaction make the next care choice understandable before the numbers do. |
| Kind daily care | Returning after an ordinary family absence is understandable and emotionally safe. |
| One state, several ways to play | Direct/classic controls and LCD/color presentations call the same domain actions over the same save. 3D is additive until a durable decision says otherwise. |
| Local and private | The playable game needs no account, ads, analytics, cloud, social graph, purchases, microphone, camera, or child-data upload. |
| Original and traceable | Every shipped visual, sound, font, model, animation, and line of copy has an original or licensed source recorded in a ledger. |
| Forgiving by construction | Save recovery, clock rollback, reduced motion, muted play, keyboard access, and fallback rendering are product behavior, not late polish. |

## 3. The player loops

### Five-minute session loop

1. Return to Jack and understand his current condition.
2. Choose the most relevant care or play action.
3. See, hear, or read an unmistakable reaction.
4. Make one small piece of progress: restore a need, learn a command, or advance toward growth.
5. Leave with a valid local save and a clear expectation for the next visit.

### Multi-day progression loop

1. Keep Jack healthy through repeated short visits.
2. Earn growth through elapsed pet time plus genuine feeding cycles.
3. Teach commands and collect expressive celebrations without currency, streak pressure, or punishment.
4. Reach adulthood, continue caring, or intentionally begin a new Baby Jack through confirmation.

Before additional pets or rooms enter production, supervised players should understand both loops without developer coaching.

## 4. Professional lifecycle and exit gates

| Phase | Required work and artifacts | Exit gate for this game |
| --- | --- | --- |
| 0 — Greenlight | Vision, audience, platform, release posture, scope, budget/schedule assumptions, IP/privacy scan, risk register, success measures | Human decisions below are resolved; current V0.8 user work is safely baselined; the team agrees what “family build” and “public release” mean. |
| 1 — Pre-production | Living game design, core-loop map, architecture/data flow, save plan, control/presentation contracts, art and audio bibles, asset ledger, performance budgets, test strategy, prototypes of the riskiest behavior | Baby Day 1 works; safe-return policy is approved; one shared interaction contract is credible; representative device budgets are measured. |
| 2 — Vertical slice | One short session at representative final quality: adopt, understand a need, care, train, Boop, sleep/wake, inspect, leave, and return | Every first-milestone action works through direct and classic controls and LCD/color presentations over one save; intended players complete the slice without coaching. |
| 3 — Production | Time-boxed system/content tracks, remaining growth-stage presentation, final animation/audio mapping, integrated builds, weekly playtests | Feature-complete alpha: the complete adoption-to-adult/restart lifecycle works and no major placeholder blocks the experience. |
| 4 — Alpha stabilization | Feature freeze, balance, regression, save corruption/recovery, clock/background tests, accessibility, performance/memory, bug triage | No unresolved critical/high defect; supported old saves upgrade safely; the whole game can be played repeatedly. |
| 5 — Beta/content lock | Final art/audio/text, browser/device matrix, guardian-approved external playtests, compliance/store material if needed, localization if approved | Content complete; release candidate passes regression, accessibility, performance, provenance, privacy, and playtest gates. |
| 6 — Release candidate and launch | Immutable tested build, versioning, release notes, screenshots/metadata, license manifest, privacy disclosure, ratings, rollback/support runbooks, staged rollout | The exact build is approved by a human; recovery is ready; publication/deployment is separately authorized. |
| 7 — Operations | Patch cadence, support intake, incident levels, dependency/platform maintenance, save-compatible updates, changelog, eventual sunset/export plan | Every update repeats migration, regression, accessibility, security, and release gates. |

## 5. Current baseline and gap map

| System | V0.8 state | Required next state |
| --- | --- | --- |
| Adoption and return | Title and hub always appear; ADOPT and VISIT have the same result | One context-aware CTA, first-session guidance, useful return summary |
| Needs | Hunger, happiness, energy, hygiene | Add health and attention with deterministic, comprehensible rules |
| Care | Feed, Play, Clean, Rest/Wake, Training, Boop | Add Status and Health/Medicine; define discipline's relationship to Training |
| Persistence | Strict V6 pet record plus separate audio/training records | V7 migration for new needs; interrupted-write and golden-path browser coverage |
| Controls | Direct touch/mouse/semantic controls | Shared action contract plus classic three-button parity |
| Presentation | Color room, 3D early-stage web default, pixel fallback | LCD plus color-pixel switch over one state; explicitly classify 3D |
| Character art | V2 runtime Baby; validated V2.2 age outputs exist | Reconcile V2/V2.2 and integrate only after slice/performance gates |
| Audio | Functional provisional SFX/music plus cue contract | Route the app through the versioned cue manifest and finish provenance/mastering |
| Accessibility | Reduced motion, labels, target sizes, muted default | Focus-visible states, consistent modal isolation, keyboard parity, intended-player observation |
| QA | Strong pure unit tests; manual visual evidence | Browser golden path, save fixtures, device matrix, performance and long-session measurements |
| Release | Static export and Pages workflow | Version policy, artifact policy, RC checklist; deployment remains human-gated |

## 6. Milestone roadmap

### M0 — Preserve and reconcile V0.8

Outcome: a reproducible, known-good baseline before broader work.

- Preserve all current dirty/untracked user work.
- Run the existing deterministic gates and record results.
- Reconcile V2 versus V2.2 runtime/asset documentation.
- Decide which of the roughly 500 MB of source/evidence belongs in Git, Git LFS, a release archive, or local-only storage.
- Align package/app/document version labels.

Exit: V0.8 can be rebuilt from its chosen source set and its limitations are accurately documented.

### M1 — Baby Day 1: guided care and return

Outcome: a first-time child can adopt Jack, understand one need, act, Boop the authored nose target, learn one command, leave, and return with progress intact.

- One adoption/return CTA instead of duplicate actions.
- First-care hint and returning condition summary.
- True nose-only Boop in 3D.
- Accelerated QA time separated from the approved player-time policy.
- Consistent modal accessibility isolation and visible keyboard focus.
- No eager 3D-model fetch before the room needs it.
- Browser golden-path and payload/first-room measurements on a named reference device.

Exit: five-minute uncoached playtest at 390×844, complete keyboard run on desktop, deterministic safe-return evidence, no critical/high defect.

Implementation checkpoint — 2026-08-15: the context-aware hub, persisted first-care guide, live return summary, authored nose-only Boop, deferred GLB request, modal isolation/initial focus, export verifier, representative browser checks, and independent review are complete. The exit gate remains blocked because the 12× player clock/offline-death policy is still awaiting Mark's decision; this checkpoint is not being called a completed M1.

### M2 — First reviewable milestone / interaction parity

Outcome: satisfy `docs/PROJECT_BRIEF.md` exactly.

Track A — domain and care:

- Migrate strict V6 saves to V7 with health and attention.
- Specify decay, illness/neglect triggers, recovery, medicine, attention, and death/terminal interactions as pure policies.
- Add Status and Health/Medicine flows.
- Preserve rollback, large-jump, interrupted-storage, invalid-save retention, and all previous migrations.

Track B — control contract:

- Extract typed player intents from `App.tsx`.
- Map direct controls and classic left/select/right navigation to the same intents.
- Prove parity for Feed, Play, Clean, Rest/Wake, Status, Health/Medicine, Training/Discipline, and Boop.

Track C — presentation contract:

- Build original LCD and color-pixel presenters from the same read-only view model.
- Switch presentations without advancing or mutating pet state.
- Treat 3D as an additive presenter until the durable product decision is resolved.

Exit: every numbered first-milestone acceptance criterion passes; representative screens exist for both presentation modes and both control schemes.

### M3 — Family vertical slice

Outcome: the milestone feels like a small finished game, not a systems demo.

- Finalize Baby art direction across character, room, shell UI, animation, and audio.
- Add stage-up comprehension and a returning-player summary.
- Balance a complete day and multi-day growth loop.
- Conduct guardian-approved observation sessions with the intended players; record task outcomes and notes, not child personal data.
- Establish cold-start, payload, FPS, memory, and soak budgets on a named low-end target.

Exit: intended players complete the golden path unassisted; production scope and cost are credible.

### M4 — Content production and feature-complete alpha

- Integrate approved age-stage art/animation through the validated runtime contract.
- Finish final audio set and asset/license ledgers.
- Complete all approved progression, state reactions, themes, tutorials, and copy.
- Keep additional pets, cloud, social, monetization, and live events out unless separately greenlit.

Exit: complete adoption-to-adult/restart lifecycle, no major placeholders, full regression pass.

### M5 — Stabilization and beta

- Freeze features, then content.
- Run fresh install, every migration fixture, malformed/invalid/unavailable storage, interrupted write, rollback/jump, background/foreground, WebGL failure, reduced motion, muted audio, keyboard, and screen-reader scenarios.
- Verify browsers and real devices, including one named low-end phone.
- Close critical/high bugs; document accepted lower-severity risks.

Exit: release-candidate checklist passes and the user approves entering RC work.

### M6 — Release candidate, optional launch, and operations

- Create the exact signed/tested artifact and immutable version record.
- Prepare store/privacy/rating material only for an approved public release.
- Stage rollout and rollback; never publish or deploy without explicit approval.
- Preserve save compatibility across patches and keep an incident/support runbook.

Exit: separately approved launch or a stable private family build with documented maintenance.

## 7. Architecture to grow into

The code should converge on these boundaries without a risky rewrite:

```text
Input adapters                 Presentation adapters
direct | classic              LCD | color pixel | 3D
        \                         /
         typed player intents / read-only view model
                       |
              game session controller
                       |
       pure simulation + interaction policies
                       |
        versioned persistence repositories
```

Rules:

- Renderers never mutate pet state.
- Control modes never implement domain rules.
- Timers emit typed events; pure policies decide outcomes.
- Pet, preferences, and training/other progress records remain separately versioned unless an approved migration requires consolidation.
- Every schema has strict validation, fixtures for each prior version, and explicit missing/invalid/unavailable outcomes.
- `App.tsx` is reduced incrementally by extracting tested controllers and screens when a milestone touches them; no rewrite-only milestone.

## 8. Team model for a small studio

One person may hold several roles, but each artifact has one accountable owner.

| Role | Accountability |
| --- | --- |
| Product owner / game designer | Vision, audience, care cadence, progression, scope, playtest decisions |
| Producer | Milestones, dependencies, risks, integration cadence, exit-gate evidence |
| Gameplay/systems engineer | Simulation, interaction policies, training, balance, save integrity |
| Client/UI engineer | Expo application, controllers, controls, accessibility, persistence wiring |
| Technical artist / animator | Jack and room sources, rigs, clips, GLB optimization, export validation |
| 2D/UI artist | LCD/color visual systems, shell UI, icons, responsive compositions |
| Audio designer | Cue mapping, original/licensed sources, mix, mastering, provenance |
| Independent QA/accessibility/release owner | Test plans, device matrix, regression, performance, release evidence |
| Privacy/IP specialist before public release | Child-directed product, store policy, COPPA/privacy, licenses, trademarks |

This checkout keeps one writer. Independent agents/reviewers are read-only unless a separately isolated worktree and ownership boundary are explicitly created.

## 9. Verification strategy

### Every implementation

Run the exact commands in `docs/QUALITY_GATES.md`, including lint, type checking, unit tests, production export, export smoke test, dependency check, configuration parse, and `git diff --check`. Record commands, exit status, skipped checks, and reasons. Never weaken a gate to make a build pass.

### Vertical slice onward

- Browser golden path: new game → adopt → care → Boop → train → sleep/wake → inspect → presentation/control switch → reload.
- Save fixtures: every historical schema, missing, malformed, schema-invalid, unavailable, and interrupted write.
- Time: fractional ticks, midnight/dayparts, rate switches, rollback, large jump, background/foreground, and offline-return policy.
- Rendering: WebGL loss/load failure, pixel fallback, all themes/stages, reduced motion, no horizontal overflow.
- Accessibility: keyboard completion, visible focus, modal isolation, labels/live regions, contrast, target size, muted comprehension.
- Performance: cold start, first room render, entry payload, GLB/audio payload, frame time, peak memory, and long-session storage churn.
- Provenance: manifests and license ledgers agree with every shipped asset.

The independent bounded audit remains opt-in and follows the limits in `docs/QUALITY_GATES.md`.

## 10. Greenlight decisions reserved for Mark

These choices materially change the product and must be explicit before their dependent work is called complete:

1. **Release posture:** private family web build first, or a public child-directed mobile/store product.
2. **Age band and devices:** intended player age range and named minimum/reference devices.
3. **Return/death policy:** normal player clock, offline decay cap or grace, and whether neglect can cause permanent death while the app is closed.
4. **Presentation hierarchy:** 3D as additive, new default, or replacement; the current brief still promises LCD and color pixel.
5. **Discipline semantics:** Training Mode as the positive replacement for discipline, or a separate non-punitive discipline system.
6. **Repository asset policy:** Git, Git LFS, external archive, and retention rules for large editable 3D sources and generated evidence.

Until resolved, implementation must preserve reversibility and must not claim public-release readiness.

## 11. Initial risk register

| Risk | Severity | Current mitigation / next action |
| --- | --- | --- |
| Default 12× offline advancement can kill a fresh Jack in about 32 real minutes | Critical product risk | Separate QA acceleration from player time; obtain explicit return/death policy before claiming safe return |
| Dirty V0.6–V0.8 baseline and large untracked asset/evidence set | High delivery risk | Preserve, inventory, decide storage policy, then baseline through a separately approved Git action |
| Full-body 3D click triggered signature nose Boop | Resolved in current tranche | Runtime Boop is restricted to the semantic nose target; retain browser regression coverage |
| Brief and 3D/pixel documentation disagree | High scope risk | Resolve presentation hierarchy and update durable decisions before large art production |
| V2 runtime versus promoted V2.2 assets | High asset-integration risk | Reconcile manifests, performance, and age-stage support before switching runtime files |
| No browser/component end-to-end suite | High regression risk | Add a golden-path browser test after interaction seams are extracted |
| 6.3 MB main web entry remains large | Medium performance risk | Eager GLB fetch is removed; measure named devices, then split/lazy-load where evidence warrants |
| Per-second state save | Medium storage/performance risk | Measure churn; separate display ticks from meaningful persistence commits |
| Provisional/unversioned audio remains wired directly | Medium provenance/release risk | Route final app cues through the versioned audio manifest and finish the ledger |
| Child-directed public distribution increases compliance cost | High release risk | Keep local/offline posture; conduct legal/store review before any public greenlight |

## 12. External production and platform references

The phase model follows the common pre-production, production, post-production, and operations lifecycle described in [Unity's game production-cycle guidance](https://learn.unity.com/pathway/game-development/unit/iterate-on-your-game/tutorial/the-games-production-cycle).

Accessibility work begins with the representative slice, consistent with [Microsoft Game Accessibility Testing Service guidance](https://learn.microsoft.com/en-us/xbox/accessibility/mgats), and web UI targets [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

Runtime 3D delivery continues to use the Khronos glTF contract documented in the [glTF registry](https://registry.khronos.org/glTF/). Native preview/submission planning, if later approved, should follow [Expo EAS Build](https://docs.expo.dev/build/introduction/) and [EAS Submit](https://docs.expo.dev/deploy/submit-to-app-stores/), plus [Apple TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/) or [Google Play testing tracks](https://support.google.com/googleplay/android-developer/answer/9845334).

A public child-directed release requires a separate review of [Apple Kids guidance](https://developer.apple.com/kids/), [Google Families policy](https://support.google.com/googleplay/android-developer/answer/9893335), and [FTC COPPA guidance](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions).

## 13. Definition of finished

The game is finished only when:

- the approved product scope and complete adoption-to-adult/restart experience work on every supported target;
- intended players understand the core loop without coaching;
- direct/classic controls and required presentations have tested parity over one state;
- all deterministic, browser, device, accessibility, performance, migration, provenance, privacy, and release checks pass;
- no unresolved critical/high finding remains;
- documentation and shipped behavior agree;
- the exact artifact is approved through the applicable human gate; and
- rollback/support and save-compatible update plans exist.

Publishing, deployment, store submission, commits, pushes, releases, and third-party contact remain outside this plan's automatic authority.

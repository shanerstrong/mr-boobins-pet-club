# Mr. Boobins' Pet Club — studio production plan

Status: active production roadmap<br>
Baseline assessed: 2026-08-16 committed V0.6–V0.8 checkpoint plus bounded Safe Return working tranche<br>
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
| Adoption and return | One context-aware CTA, reload-persistent first-care guidance, live return summary, explicit lifecycle authority, and safe fixed-1× offline catch-up | Retain regressions while the first reviewable milestone adds the remaining systems |
| Needs | Hunger, happiness, energy, hygiene | Add health and attention with deterministic, comprehensible rules |
| Care | Feed, Play, Clean, Rest/Wake, Training, Boop | Add Status and Health/Medicine; define discipline's relationship to Training |
| Persistence | Strict V6 pet record plus separate audio/training/first-care records; V1–V5 migration and malformed-save retention preserved | Strict migration for new needs; interrupted-write and expanded golden-path browser coverage |
| Controls | Direct touch/mouse/semantic controls | Shared action contract plus classic three-button parity |
| Presentation | Color room, 3D early-stage web default, pixel fallback | LCD plus color-pixel switch over one state; explicitly classify 3D |
| Character art | Provisional V2.3 complete-canine awake-care runtime for Baby/Little Puppy; stable code-native Sleep/death/Training fallbacks | Review awake care motion in context; author proper 3D rest and command cycles rather than shipping rejected donor poses; validate later age-stage presentation separately |
| Audio | Functional provisional SFX/music plus cue contract | Route the app through the versioned cue manifest and finish provenance/mastering |
| Accessibility | Reduced motion, labels, target sizes, muted default, sleep-modal initial focus/isolation/trap/restore | Complete keyboard parity and intended-player observation |
| QA | Strong pure unit tests; manual visual evidence | Browser golden path, save fixtures, device matrix, performance and long-session measurements |
| Release | Static export and Pages workflow | Version policy, artifact policy, RC checklist; deployment remains human-gated |

## 6. Milestone roadmap

### M0 — Preserve and reconcile V0.8

Outcome: a reproducible, known-good baseline before broader work.

- Preserve all current dirty/untracked user work.
- Run the existing deterministic gates and record results.
- Reconcile Teen/Adult runtime support only after their age-stage presentation gates; Baby/Little Puppy awake non-training 3D states use the provisional V2.3 complete-canine candidate while Sleep/death/Training remain on stable semantic fallbacks.
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

Implementation checkpoint — 2026-08-16: the context-aware hub, persisted first-care guide, live return summary, authored nose-only Boop, deferred GLB request, modal isolation/focus behavior, export verifier, and representative browser checks are implemented. Safe Return now uses 1× player time, test-injected acceleration only, no pre-adoption decay, no active starvation outside actually reachable foreground care, a once-per-resume four-pet-hour fixed-1× offline cap, and no alive→dead offline transition. Sleep, Training, Restart, and cleaning locks are exact access boundaries; visibility remains authoritative before hydration; interrupted Clean cannot complete either hygiene or guidance. Successful delayed Clean writes a recoverable pet-plus-guide journal before the legacy keys, so partial storage failure cannot reload completed guidance without its exact hygiene mutation; strict V6 and legacy separate-guide saves remain compatible. Deterministic and live-browser closure is recorded in `docs/production/SAFE_RETURN_VERIFICATION.md`; the remaining M1 exit activity is the human uncoached playtest, not an unresolved clock/death policy.

### M2 — First reviewable milestone / interaction parity

Outcome: satisfy `docs/PROJECT_BRIEF.md` exactly.

Track A — domain and care:

- Migrate strict V6 saves to V7 with health and attention.
- Specify decay, illness/neglect triggers, recovery, medicine, attention, and death/terminal interactions as pure policies.
- Add Status and Health/Medicine flows.
- Preserve rollback, large-jump, interrupted-storage, invalid-save retention, and all previous migrations.

Implementation checkpoint — 2026-08-18: Track A is implemented pending final evidence and gates. Strict V1–V6 records migrate to six-need V7 with health `100`, attention `80`, and a separate wellbeing timestamp that prevents retroactive pre-upgrade decay while legacy needs, age, and Safe Return catch-up remain exact. Attention decays at the approved awake/sleeping rates and PLAY restores `28`; health changes only through additive approved neglect decay or bounded Medicine. Health zero is nonfatal and active starvation remains the only death path. The App exposes read-only Status and a separate typed Medicine intent with deterministic health bands, recommendations, reachability, sleeping, dead, and healthy-state guards. Delayed-Clean journals normalize embedded V6 pets without weakening raw-before or malformed-save protections.

Commit checkpoint — 2026-08-19: Track A is committed locally at `398bd7e`; its candidate/report exclusions and every paused cinematic path remain outside the implementation scope.

Track B — control contract:

- Extract typed player intents from `App.tsx`.
- Map direct controls and classic left/select/right navigation to the same intents.
- Prove parity for Feed, Play, Clean, Rest/Wake, Status, Health/Medicine, Training/Discipline, and Boop.

Track C — presentation contract:

- Build original LCD and color-pixel presenters from the same read-only view model.
- Switch presentations without advancing or mutating pet state.
- Treat 3D as an additive presenter until the durable product decision is resolved.

Implementation checkpoint — 2026-08-19: the provisional Quiet Care Monitor prototype is committed and remains unaccepted/unlocked creative work. A deep-frozen V7 `PetPresentationModel` exposes the same ordered six needs, status/recommendation, medicine availability, warnings, and semantic activity to every presenter. Session-only `three-d`, `color-pixel`, and `lcd` selection defaults to 3D, never writes storage, and explicitly renders the existing code-native pixel scene for Color Pixel. Quiet Care Monitor is code-native, uses only system text and two/three-frame state treatments, retains meaningful reduced-motion end frames and non-color-only warning cues, and leaves typed actions outside the presenter.

Track B implementation checkpoint — 2026-08-19: Direct remains the session/reload default. Classic uses one Left/Select/Right adapter over the exact existing room, Status/Medicine, Sleep, and Training callbacks; it creates no save key and never advances or replaces pet state while switching modes. The room selection order is deterministic and wraps both directions. Disabled actions remain highlighted with their truthful reason and Select performs no mutation. The direct/native controls remain present in Direct and inside dialogs; Classic adds keyboard shortcuts, screen-reader selected/live state, 44px targets, modal focus containment, Escape close, and trigger restoration.

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
3. **Return/death policy (resolved 2026-08-16):** 1× player time, four-pet-hour offline cap, and no alive→dead transition while closed; active cartoony death remains limited to reachable foreground care-room play.
4. **Presentation hierarchy:** 3D as additive, new default, or replacement; the current brief still promises LCD and color pixel.
5. **Discipline semantics:** Training Mode as the positive replacement for discipline, or a separate non-punitive discipline system.
6. **Repository asset policy:** Git, Git LFS, external archive, and retention rules for large editable 3D sources and generated evidence.

Until resolved, implementation must preserve reversibility and must not claim public-release readiness.

## 11. Initial risk register

| Risk | Severity | Current mitigation / next action |
| --- | --- | --- |
| Former 12× player clock and offline death | Resolved in current tranche | Player time is 1×; QA acceleration is injection-only; fixed-1× offline advancement is capped at four pet-hours and cannot turn an alive pet dead |
| V0.6–V0.8 baseline and large excluded asset/evidence set | Controlled delivery risk | Baseline `9c8a821`, immutable inventory, restricted-Drive preservation, and deterministic classification are in place; retain originals and keep LFS/cleanup separately gated |
| Full-body 3D click triggered signature nose Boop | Resolved in current tranche | Runtime Boop is restricted to the semantic nose target; retain browser regression coverage |
| Brief and 3D/pixel documentation disagree | High scope risk | Resolve presentation hierarchy and update durable decisions before large art production |
| Provisional V2.3 complete-canine motion and missing production rest/command cycles | High visible-quality risk | Review the awake non-training CC0 canine-derived candidate in context; keep the rejected donor Sleep/death/Sit/Paw/Up cycles out of runtime and use stable semantic illustrations until authored 3D replacements pass phone/desktop live QA. Do not describe technical validation as subjective acceptance. |
| Browser golden path is evidence-driven rather than continuously automated | Medium regression risk | Keep App-level lifecycle/component tests deterministic; expand browser automation after typed interaction seams are extracted |
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

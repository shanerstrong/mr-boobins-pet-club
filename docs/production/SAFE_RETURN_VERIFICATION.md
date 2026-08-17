# Safe Return and Baby Day 1 verification — 2026-08-16

## Scope verified

- Player time defaults to 1×; production exposes no acceleration control or configuration.
- Test/QA acceleration is an injected session/test seam and cannot alter fixed-1× offline results.
- Pre-adoption time is stamped without need decay or replayable gaps.
- Only the foreground room with actually reachable care accrues active starvation; title, hub, settings, background state, Sleep/Training/Restart modals, and cleaning/care locks do not.
- Resume applies offline advancement once, caps it at four pet-hours, stamps the full current time, preserves starvation exactly, and cannot turn an alive pet dead.
- Foreground/background state remains authoritative before pet hydration; a save loaded while hidden retains its original timestamp until one resume catch-up.
- Delayed Clean commits hygiene and first-care completion together; cancellation before 1.5 seconds commits neither. One App authority serializes ordinary pet, ordinary guide, Clean, background cancellation, and reset pair writes. Successful Clean first writes a strict V2 prepared journal with the exact readable before snapshot and exact post-Clean pair, then writes pet, guide, and commit marker in order. Background/cancellation uses operation-tagged V3 and remains preservation-only: malformed or unavailable raw data is never replaced. Only deliberate START FRESH or confirmed Restart uses strict V4 `explicit-reset`; it records both exact raw pre-reset values (including missing or malformed bytes), the exact reset-ready Baby pair, and the target generation before either legacy key is written. For both V2 and V4, a rejected initial journal write is classified only after strict read-back: the exact prepared raw continues as durable, a confirmed missing key returns a truthful retry with no publication, and unavailable or nonexact/malformed/mismatched read-back retains the exact authorized intent plus a serialized barrier while the App reports that the save outcome is still being safely checked. The barrier blocks ordinary pet/guide, Clean, and background writes without granting automatic explicit-reset authority. Foreground or restored storage rechecks the exact prepared or committed raw; process reload rolls a surviving exact prepared journal forward once, while a missing journal leaves the prior pair untouched. Once prepared, the serialized App load/recovery seam accepts only before/before, after/before, or after/after, rechecks the strict before member before each missing write, and completes pet → guide → committed marker before time stamping, ordinary saves, or publication. A committed-but-unpublished reset or recovered Clean retains an in-memory publication barrier across background/foreground transitions so stale UI and generic effects cannot overwrite it; foreground or hydration publishes the exact durable pair and acknowledges the barrier before later gameplay resumes. Recovery failures remain retryable across process loss and never mask raw divergence, impossible cross-pairs, malformed journals, generation mismatch, or unavailable keys. Committed V4 residue is cleanup-only.
- Existing V1–V6 saves, strict V6 round trips, and malformed-save no-overwrite behavior remain unchanged; already-dead saves remain dead and frozen.
- First-care guidance, live return summaries, single ADOPT/VISIT CTA behavior, and Sleep-dialog focus behavior are covered at policy/component and live-App layers.

## Deterministic coverage

Focused Safe Return and Day 1 verification passed **6 test files / 170 tests** before the complete suite. The narrower persistence/App-used V2/V4 pair passes **2 files / 106 tests**. Coverage includes:

- default 1× and isolated injected QA multipliers;
- pre-adoption, title, hub, settings, foreground care-room, background, resume, and repeated-lifecycle boundaries;
- exact reachable→blocked→reachable settlement for Sleep, Training, Restart, and `careLocked`, including starvation `119`, long blocked intervals, repeated events, and the remaining active second after reopening;
- background-before-hydration followed by a greater-than-five-minute resume, with exactly one catch-up;
- offline durations below, exactly at, and above four hours; full-`now` stamping; immediate reopen; backward, invalid, and very large clock jumps;
- hunger crossing zero offline with starvation at `0`, fractional, and `119` preserved; no offline death transition; already-dead frozen state;
- active starvation at `119` reaching death after exactly one active pet-minute, and feeding before the threshold resetting starvation;
- sleep wholly within an absence and sleep ending partway through one;
- all historical migrations, strict round trip, missing storage, malformed/schema-invalid no-overwrite, and unavailable storage behavior;
- first-care persistence across reload, suppression during sleep/disabled care, delayed-Clean cancellation versus atomic hygiene/guide completion, live return-summary derivation, and absence of an away-death message branch;
- serialized deferred ordinary-pet and ordinary-guide saves before Clean; pending Clean followed by background/cancel or explicit Reset; post-await App UI-generation checks; strict durable-Clean write order; operation-tagged V3 background supersession; strict V4 START FRESH/Restart after delayed Clean; exact raw V4 before values for valid, missing, malformed, and mixed pet/guide inputs; V2 and V4 initial-journal reject-before-write, write-then-reject, exact, absent, unavailable, malformed, and mismatched read-backs; retained same-process barriers and process-reload recovery; truthful still-checking versus confirmed-failure publication; ordinary pet/guide/Clean/background blocking; durable V2 and V4 pet, guide, and final-marker recovery failures both before and after a write lands; repeated process loss and restored storage access; exact/strict before-member recheck; no duplicate transaction or publication; no publication until recovery is fully committed; hidden/background completion before preparation, after preparation, and before the commit marker; blocked stale ordinary pet/guide/timestamp writes; foreground publication and acknowledgement; successful reload without returning to malformed-save recovery; later legitimate gameplay after acknowledgement; exact raw-divergence, impossible-boundary, malformed-journal, non-Baby-target, and generation-mismatch rejection; committed V4 cleanup-only behavior after later valid gameplay; proof V3 background supersession still refuses malformed raw; legacy V1/V2/V3/V4 compatibility; same-generation Feed/PLAY/sleep/wake/theme preservation at equal or earlier clocks; unrelated audio/training record preservation; and no mutation or success presentation after confirmed initial preparation absence;
- the exact dialog-focus controller wired into Sleep: meaningful first focus, Tab and Shift+Tab wrapping, Escape cancellation, listener cleanup, and opener restoration.

The complete current suite passes **10 test files / 213 tests**; the Safe Return-focused subset remains 6 files / 170 tests. The additional current tests include the separately reconciled audio work without changing this milestone's ownership.

The App imports and executes the same exported `createAppTimeCoordinator`, `createPetGuidePersistenceAuthority`, `finishDelayedCleanDurably`, `finishExplicitResetDurably`, `recoverExplicitResetForPublicationDurably`, serialized `loadAndRecover`, and `installDialogFocusBoundary` seams used by these integration tests. The persistence authority orders every App pet/guide key writer. Clean and explicit-reset controllers publish only when their authority/App generation remains current; a reset additionally requires durable recovery completion and exact publication acknowledgement. No source-string proxy or new component-test dependency is used.

## Required command results

| Command | Exit | Evidence |
| --- | ---: | --- |
| `git diff --check` | 0 | No whitespace errors; only the configured working-copy LF→CRLF notices are emitted by other Git inspection commands. |
| Project Kit JSON parse command from `docs/QUALITY_GATES.md` | 0 | Both configuration documents parse. |
| `npm run check:assets` | 0 | Required manifests/provenance, immutable inventory and normalization anchors, exact evidence-refresh mapping, hashes, budgets, imports, pointer rules, and evidence retention pass. The corrected verifier passed twice consecutively before the final full-gate run. |
| `npm run check:audio` | 0 | The separately reconciled audio lane verifies 30 manifest assets, 63 local files, 57 inspected WAVs, and 30 master candidates. Planned-release warnings retain four full-scale raw sources (happy bark, sneeze, treat crunch, and wet shake); the corresponding mastered runtime candidates verify separately. |
| `npm run lint` | 0 | ESLint reports zero warnings/errors. |
| `npm run typecheck` | 0 | TypeScript completes with no error. |
| `npm test` | 0 | 10 files, 213 tests pass in the current checkout. |
| `npm run export:web` | 0 | Three static routes; web entry 6.3 MB; vision bundle 141 KB. |
| `npm run smoke` | 0 | Non-empty index, one non-empty web entry, and 22 non-empty referenced runtime assets. |
| `npm run check:deps` | 0 | Configured critical threshold passes with 0 critical advisories; npm reports 16 high and 7 moderate transitive Expo/Metro advisories. The offered full fix is breaking and was not applied. |

The dependency audit required the already-approved npm registry/cache access after its sandboxed attempt could not reach the registry or write normal cache logs. No dependency or lockfile changed.

The focused closure command passed 6 files / 170 tests, including the narrower 2-file / 106-test V2/V4 App-used pair. BOM-aware JSON parsing, the frozen post-baseline V3/audio/V4 governed-set proof, package identities, evidence identities, and final staged-path count are rerun after the append-only managed-context refresh below.

## Live App/browser results

At a page-reported **390×844** phone viewport:

- the hub exposed exactly one context-aware ADOPT/VISIT CTA;
- first-care guidance remained after a real reload, disappeared after valid Feed care, and did not recommend disabled care while Jack slept;
- production exposed zero acceleration controls;
- the Sleep dialog gave meaningful initial focus to `Sleep for 1 pet hour`, exposed one dialog and one inert/ARIA-hidden background, wrapped Shift+Tab/Tab inside the dialog, closed with Escape, and restored focus to the Rest trigger;
- Training and Restart each exposed one blocking dialog and one inert background, then returned to reachable room care;
- a new Baby began at hygiene 88 with first-care guidance visible; starting Clean and immediately leaving/unmounting before 1.5 seconds reloaded at hygiene 88 with guidance still visible and no completion message; a subsequent uninterrupted journaled Clean produced hygiene 100, removed guidance, showed the completion message, and reloaded at hygiene 100 with guidance still complete;
- after completing first care, closing the app at `2026-08-16T15:01:57.911Z`, and reopening more than five real minutes later, the hub exposed one `VISIT JACK` action and the room reported: `Welcome back! Jack is doing well. His lowest need is energy at 72%.` No away-death copy or branch appeared.

At a page-reported **1440×900** desktop viewport, all five primary care controls and Settings were present with no horizontal overflow. The complete room/root capture remains the same 1440×900 bitmap. The fix round changed timing/control seams rather than pixels, so the five representative JPEGs were not rewritten; no subjective creative acceptance is claimed.

## Representative captures

| Path | Dimensions | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `evidence/baby-day1/adoption-hub-390x844.jpg` | 390×844 | 32,427 | `5ad22672a08fd83204075cf85db87b088c71c390f0ddb73473f5b3b5fc3017eb` |
| `evidence/baby-day1/guided-care-room-390x844.jpg` | 390×844 | 39,825 | `c5df99fceb43dfe4da6fac0d289cbfca43aefa660fa09dc1a45d001dd939980a` |
| `evidence/baby-day1/returning-hub-390x844.jpg` | 390×844 | 31,293 | `405476c22c01857467b26d6c94d8329c7c48a436a71dde4aa9b714d5ce196549` |
| `evidence/baby-day1/sleep-dialog-keyboard-390x844.jpg` | 390×844 | 35,346 | `39c78e1d7481240c45b17ce51edbb285ee9dd09d652e15edb52321452307a0da` |
| `evidence/baby-day1/room-desktop-1440x900.jpg` | 1440×900 | 68,692 | `0c23f58ded06c574273def072ac813342beea8ba9a61ceb2886b070c74111400` |

`V0.6-V0.8_EVIDENCE_REFRESH.json` maps each prior committed identity to the current identity above. The verifier proves prior bytes from baseline `9c8a821`; the immutable prepolicy inventory is unchanged.

## Remaining milestone work and exclusions

- Health, attention, status, medicine, strict migration for those new fields, LCD presentation, classic three-button controls, and full mode/control representative evidence remain required for the first reviewable milestone.
- Human uncoached intended-player observation remains a production exit activity; deterministic and live-App checks do not self-approve usability or visual taste.
- The existing 16 high and 7 moderate transitive dependency advisories remain a release risk; no critical advisory is present and no breaking fix was authorized.
- No staged file, commit, push, LFS upload/configuration, Drive write, cleanup, dependency change, publication, deployment, or bounded audit is part of this tranche.

# Production dashboard

Updated: 2026-08-19

## Outcome

Deliver a child-friendly, expansion-ready virtual-pet base game through small verified playable milestones while controlling rework, model usage, asset cost, and shared-file conflicts.

## Current state

- Product stage: pre-alpha representative slice.
- Last committed checkpoint: Quiet Care Monitor LCD prototype (`cfcf124`), built over V7 Gameplay, Alpha Inspect, Safe Return, and the recoverable V0.6–V0.8 baseline.
- Current working scope: bounded Jack Animation Completion over the completed Classic/LCD/V7 working slice. Awake non-training 3D presentation now compares against the materially different V2.3 complete-canine candidate; rejected rest/command cycles are contained behind stable semantic fallbacks, and the paused cinematic concepts plus rejected elementary intro direction remain untouched.
- Baseline-control state: the committed candidate, immutable prepolicy inventory, four-tier classification, restricted-Drive preservation manifests, and 21-file raw→normalized mapping are durable and gate-enforced. The five canonical editable sources remain full local bytes under `assets/source/`; GitHub LFS upload/configuration remains pending and separately gated.
- Primary risk: remote LFS preservation remains unverified because current no-charge capacity could not be proven. All superseded local/Drive artifacts and excluded originals remain retained pending separate cleanup approval.
- Dependency risk: the fresh production audit passes the configured critical threshold with 0 critical advisories, but 16 high and 7 moderate advisories remain. A breaking `npm audit fix --force` downgrade is not authorized.
- First full reviewable milestone remains incomplete: health/attention/status/medicine and the provisional LCD/Color Pixel slice are committed; Classic parity is implemented and independently confirmed in the current uncommitted working slice; animation quality and remaining human evidence gates are still open.

## Ordered delivery

1. Complete the bounded Jack Animation Completion through V2.3 awake-care runtime integration, stable rest/Training fallbacks, transition/grounding checks, exact asset routing, final gates, and Mark's visual review.
2. Preserve committed LCD/V7, Alpha Inspect camera/grounding behavior, Safe Return, and the rejected intro/cinematic boundaries unchanged.
3. Close the remaining first-reviewable-milestone human evidence gates without adding another gameplay architecture.
4. Only after the concrete milestone criteria pass, offer the next bounded-audit decision.
5. Add expansion content through the approved pack contract; defer commerce until the base game and content-loading path are validated.

## Work-in-progress limits

- One active reviewable milestone.
- One writer per checkout.
- No parallel writer in the current checkout until a recoverable baseline is approved.
- After baseline stabilization, at most three independent lanes with explicit files, interfaces, acceptance criteria, and stop conditions.
- Research, concept exploration, approved asset production, and read-only verification may overlap; shared schemas, persistence, navigation, integration, and source-of-truth changes are serialized.

## Source hierarchy

1. `docs/PROJECT_BRIEF.md` and `docs/DECISIONS.md` — requirements and durable decisions.
2. `PLANS.md` — accepted implementation boundaries and current audit state.
3. `docs/production/` — current production control and content contracts.
4. Source, tests, and runtime assets in the repository — implementation truth.
5. `docs/QUALITY_GATES.md` and `evidence/` — completion proof.
6. Google Drive — curated phone-review mirror plus a separately restricted preservation root; neither replaces repository implementation truth.

## Cost and cadence

- Run deterministic inventory, lint, type, test, build, asset, and diff checks before model-based review.
- Use efficient routing for monitoring and inventory; reserve stronger reasoning for architecture, difficult defects, migrations, security, and final acceptance.
- Produce inexpensive concepts before polished assets or multiple variants.
- Read `CREATIVE_DIRECTION.md` before visual work. Only Mark grants subjective approval, and one clear rejection stops that method until the approach or references materially change.
- Proposed cadence, not yet scheduled: a concise weekday read-only change brief and one weekly milestone review; report nothing when no meaningful state changed.
- Do not build a custom API production console until manual coordination repeatedly consumes more time than the console would cost to build and maintain.

## Active approvals and blockers

- Approved product direction: safe return, child-friendly cartoony active-play ending, future paid rooms/skins/tricks, and a lean no-custom-API control plane.
- Safe Return implementation: 1× player time; injected session/test-only acceleration; no pre-adoption decay; no active starvation outside actually reachable foreground care, including Sleep/Training/Restart/cleaning locks; foreground state retained before hydration; once-per-resume fixed-1× offline advancement capped at four pet-hours; no alive→dead offline transition; one App authority serializes pet/guide/Clean/reset writes. Delayed Clean uses legal-boundary exact-snapshot V2 recovery; background/cancellation uses preservation-only V3 and still refuses malformed/unavailable raw; only deliberate START FRESH or confirmed Restart uses strict V4 `explicit-reset` with exact raw-before identity and an exact reset-ready Baby after-pair. Rejected initial V2/V4 journal writes are strict-read-back classified as exact-durable, definitely absent, or ambiguous; ambiguous unavailable/nonexact/malformed/mismatched outcomes preserve raw and retain the exact authorized intent plus a conflicting-write barrier while foreground/storage recovery keeps checking. Exact prepared V2/V4 journals durably complete pet → guide → committed marker before hydration/resume can stamp, save, or publish; committed-but-unpublished pairs block stale ordinary/background writes until the exact durable pair is published once and acknowledged. Changed, illegal, malformed, or unavailable raw remains unmasked, and committed V4 residue stays cleanup-only. Strict V7 plus V1–V6 migration and legacy V1/V2/V3/V4 journal/guide behavior remain compatible.
- Health/status contract: V1–V6 migration initializes health `100` and attention `80` without retroactive decay. Attention decays `0.10` awake or `0.04` sleeping per pet-minute; PLAY adds `28`. Health has no passive recovery or unconditional decay and loses only additive neglect rates while hunger, hygiene, or attention are below `20`. Health zero is nonfatal. Read-only Status reports the four approved health bands and deterministic priority recommendation; separate Medicine restores `25` up to `100` only when Jack is alive, awake, care-reachable, and below `80`.
- Provisional presentation/control contract: 3D remains the presentation default; explicit Color Pixel always renders the established code-native pixel presenter; Quiet Care Monitor is an original code-native LCD prototype over the same immutable V7 model. Direct remains the control reload default. Classic is session-only and routes Left/Select/Right through the existing Status, Feed, Play, Clean, Rest/Wake, Train, Boop, and Medicine callbacks. Switching either selector causes no simulation, migration, persistence, state replacement, or storage-key change. Mark has not accepted or locked the LCD look.
- Binding creative rejection: do not continue crude single-image Blender reconstructions of Jack or describe self-judged visual output as good. The current 3D and pixel assets remain provisional unless Mark explicitly accepts or locks them.
- Binding intro rejection: the current pre-alpha intro looks elementary and includes visibly broken-looking placeholder elements. Keep it labeled provisional; do not polish or self-approve the same visual concept. A later redesign must begin with materially different reference-led concepts for Mark's comparison.
- Approved alpha inspection: normal play retains the authored fixed camera. Supported full-motion 3D may opt into a session-only, no-pan Alpha Inspect View with bounded orbit/zoom and exact reset/off restoration; direct canvas actions are unavailable during inspection and fallback modes expose no broken controls. Jack uses the GLB's authored y=0 ground origin against the rug at y=0 with a measured `0.005` clearance rather than static bottom-centering plus a manual lift; only the existing Sit/Paw/Up held markers receive their exact sampled contact offsets.
- Animation repair status: Mark rejected the procedural V2 motion and the mixed V2.2 package was not a complete fix. Baby/Little Puppy awake, living, non-training 3D care states now use the provisional V2.3 complete-canine candidate with all 28 source slots replaced, a `0.22s` crossfade, and bounded Hips-travel removal for Sleep/Wake/Death and Sit/Paw/Up. Live QA rejected the donor rest collapse and command silhouettes, so Sleep/death/Training intentionally use the stable code-native semantic illustrations until proper authored 3D cycles exist. No simulation, persistence, camera, balance, or action timing changed; Mark has not accepted or locked the awake care motion.
- Dependency gate: Mark approved the npm-registry disclosure and the exact audit passed at the critical threshold; high/moderate findings remain a documented release risk, not a completed fix.
- Storage provider: Google Drive only for this project. The private preservation root and its Cold Archive/Private Backup subfolders are restricted and separate from the phone-review mirror; iCloud is out of scope.
- Preservation progress: the final 17-part cold set (each part at most 45,000,000 bytes), cold manifest, private bundle, and private manifest all match authenticated Drive downloads. Both folders are restricted and separate from the phone-review mirror. The earlier five- and eight-part local sets and one unverified superseded Drive part remain retained pending separate cleanup approval. GitHub LFS object upload is still pending because no-charge capacity could not be verified.
- Candidate-correction preservation: 21 raw text originals / 121,449 bytes are retained in a 42,387-byte restricted Cold Archive ZIP plus private manifest; both authenticated-download hashes match. Their repository forms now use LF and only the exact approved Markdown/whitespace/blank-EOF corrections; the immutable raw→normalized mapping is gate-enforced.
- Project Kit staging: generic provider-selection and copy-safe authorization guardrails were applied only to the existing 0.6.0 staging copy; `skill-creator` validation and a fresh no-write bootstrap preview pass. Global installation remains unauthorized and unchanged.
- Not authorized: commit, push, publish, deploy, storefront, payments, analytics, accounts, dependency changes, external evidence upload, or unattended project writes.
- Next coordination gate: finish exact runtime-asset/context reconciliation and all quality gates for the V2.3 awake-care repair, then let Mark judge the live result. Stable rest/Training fallbacks are intentional alpha containment, not a claim that final all-3D animation is done. Any commit, push, deployment, publication, cleanup, LFS action, or external write still needs its own approval.

## Definition of production-control success

- Mark receives one concise current-state report and only decisions that require him.
- Every worker has one bounded assignment and an unambiguous owner.
- Every milestone ends in a playable or renderable artifact with recorded evidence.
- Repository and Drive never become competing sources of truth.
- Automation reduces repeated work without creating unattended product or publishing risk.

# Production dashboard

Updated: 2026-08-17

## Outcome

Deliver a child-friendly, expansion-ready virtual-pet base game through small verified playable milestones while controlling rework, model usage, asset cost, and shared-file conflicts.

## Current state

- Product stage: pre-alpha representative slice.
- Last committed checkpoint: Safe Return (`372b82d`), built from the recoverable V0.6–V0.8 baseline.
- Current working scope: bounded Alpha Inspect Camera & Jack Grounding presentation work over preserved concurrent scene edits. The intro remains functional/provisional and its current elementary visual direction is explicitly rejected rather than being redesigned inside this slice.
- Baseline-control state: the committed candidate, immutable prepolicy inventory, four-tier classification, restricted-Drive preservation manifests, and 21-file raw→normalized mapping are durable and gate-enforced. The five canonical editable sources remain full local bytes under `assets/source/`; GitHub LFS upload/configuration remains pending and separately gated.
- Primary risk: remote LFS preservation remains unverified because current no-charge capacity could not be proven. All superseded local/Drive artifacts and excluded originals remain retained pending separate cleanup approval.
- Dependency risk: the fresh production audit passes the configured critical threshold with 0 critical advisories, but 16 high and 7 moderate advisories remain. A breaking `npm audit fix --force` downgrade is not authorized.
- First full reviewable milestone remains incomplete: health/attention/medicine, LCD presentation, and classic-control parity are still required.

## Ordered delivery

1. Close the bounded Alpha Inspect Camera & Jack Grounding slice without changing simulation, persistence, dependencies, model bytes, or the rejected intro design.
2. Add health, attention, status, and medicine through a strict save migration.
3. Add LCD-inspired presentation over the same pet state.
4. Map classic three-button controls to the same typed player intents as direct controls.
5. Capture representative evidence for both presentation modes and both control schemes, satisfy every first-milestone criterion, and only then offer the next bounded-audit decision.
6. Add expansion content through the approved pack contract; defer commerce until the base game and content-loading path are validated.

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
- Safe Return implementation: 1× player time; injected session/test-only acceleration; no pre-adoption decay; no active starvation outside actually reachable foreground care, including Sleep/Training/Restart/cleaning locks; foreground state retained before hydration; once-per-resume fixed-1× offline advancement capped at four pet-hours; no alive→dead offline transition; one App authority serializes pet/guide/Clean/reset writes. Delayed Clean uses legal-boundary exact-snapshot V2 recovery; background/cancellation uses preservation-only V3 and still refuses malformed/unavailable raw; only deliberate START FRESH or confirmed Restart uses strict V4 `explicit-reset` with exact raw-before identity and an exact reset-ready Baby after-pair. Rejected initial V2/V4 journal writes are strict-read-back classified as exact-durable, definitely absent, or ambiguous; ambiguous unavailable/nonexact/malformed/mismatched outcomes preserve raw and retain the exact authorized intent plus a conflicting-write barrier while foreground/storage recovery keeps checking. Exact prepared V2/V4 journals durably complete pet → guide → committed marker before hydration/resume can stamp, save, or publish; committed-but-unpublished pairs block stale ordinary/background writes until the exact durable pair is published once and acknowledged. Changed, illegal, malformed, or unavailable raw remains unmasked, and committed V4 residue stays cleanup-only. Strict V6 and legacy V1/V2/V3/V4 journal/guide behavior remain compatible.
- Binding creative rejection: do not continue crude single-image Blender reconstructions of Jack or describe self-judged visual output as good. The current 3D and pixel assets remain provisional unless Mark explicitly accepts or locks them.
- Binding intro rejection: the current pre-alpha intro looks elementary and includes visibly broken-looking placeholder elements. Keep it labeled provisional; do not polish or self-approve the same visual concept. A later redesign must begin with materially different reference-led concepts for Mark's comparison.
- Approved alpha inspection: normal play retains the authored fixed camera. Supported full-motion 3D may opt into a session-only, no-pan Alpha Inspect View with bounded orbit/zoom and exact reset/off restoration; direct canvas actions are unavailable during inspection and fallback modes expose no broken controls. Jack uses the GLB's authored y=0 ground origin against the rug at y=0 with a measured `0.005` clearance rather than static bottom-centering plus a manual lift; only the existing Sit/Paw/Up held markers receive their exact sampled contact offsets.
- Dependency gate: Mark approved the npm-registry disclosure and the exact audit passed at the critical threshold; high/moderate findings remain a documented release risk, not a completed fix.
- Storage provider: Google Drive only for this project. The private preservation root and its Cold Archive/Private Backup subfolders are restricted and separate from the phone-review mirror; iCloud is out of scope.
- Preservation progress: the final 17-part cold set (each part at most 45,000,000 bytes), cold manifest, private bundle, and private manifest all match authenticated Drive downloads. Both folders are restricted and separate from the phone-review mirror. The earlier five- and eight-part local sets and one unverified superseded Drive part remain retained pending separate cleanup approval. GitHub LFS object upload is still pending because no-charge capacity could not be verified.
- Candidate-correction preservation: 21 raw text originals / 121,449 bytes are retained in a 42,387-byte restricted Cold Archive ZIP plus private manifest; both authenticated-download hashes match. Their repository forms now use LF and only the exact approved Markdown/whitespace/blank-EOF corrections; the immutable raw→normalized mapping is gate-enforced.
- Project Kit staging: generic provider-selection and copy-safe authorization guardrails were applied only to the existing 0.6.0 staging copy; `skill-creator` validation and a fresh no-write bootstrap preview pass. Global installation remains unauthorized and unchanged.
- Not authorized: commit, push, publish, deploy, storefront, payments, analytics, accounts, dependency changes, external evidence upload, or unattended project writes.
- Next coordination gate: complete every exact gate and independent read-only review for Alpha Inspect/grounding, then return to the narrowly bounded health/attention/status/medicine slice. Any commit, push, deployment, publication, cleanup, LFS action, or external write still needs its own approval.

## Definition of production-control success

- Mark receives one concise current-state report and only decisions that require him.
- Every worker has one bounded assignment and an unambiguous owner.
- Every milestone ends in a playable or renderable artifact with recorded evidence.
- Repository and Drive never become competing sources of truth.
- Automation reduces repeated work without creating unattended product or publishing risk.

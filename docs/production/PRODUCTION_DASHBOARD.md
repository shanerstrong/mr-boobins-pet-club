# Production dashboard

Updated: 2026-08-16

## Outcome

Deliver a child-friendly, expansion-ready virtual-pet base game through small verified playable milestones while controlling rework, model usage, asset cost, and shared-file conflicts.

## Current state

- Product stage: pre-alpha representative slice.
- Last committed checkpoint: V0.5 (`23cf28f`).
- Current working scope: substantial uncommitted V0.6–V0.8 code, 3D assets, and verification evidence.
- Baseline-control state: the received dirty tree is hash-indexed; four-tier classification and deterministic verification are implemented; five canonical editable sources have byte-identical `assets/source/` copies; all current cold/private bundles are authenticated-download verified; and the 21 raw text originals from the aborted first commit attempt are separately preserved before deterministic LF/whitespace correction. GitHub LFS remains pending, and no checkpoint is staged or committed.
- Primary risk: the refreshed normal-Git candidate is not yet frozen or reapproved. Remote LFS preservation remains unverified because current no-charge capacity could not be proven. All superseded local/Drive artifacts remain retained pending separate cleanup approval.
- Dependency risk: the fresh production audit passes the configured critical threshold with 0 critical advisories, but 16 high and 7 moderate advisories remain. A breaking `npm audit fix --force` downgrade is not authorized.
- First full reviewable milestone remains incomplete: health/attention/medicine, LCD presentation, and classic-control parity are still required.

## Ordered delivery

1. Complete the approved raw→normalized candidate correction, prove the exact staged candidate passes `git diff --cached --check`, return the index to zero staged paths, and request a fresh exact commit approval. Keep GitHub LFS and cleanup separately pending.
2. Implement the approved safe-return contract: 1× player time, test acceleration separated, no pre-adoption decay, no starvation outside the reachable care room, four pet-hour offline catch-up, and no offline death.
3. Close the known Baby Day 1 return-summary, first-care guidance, and modal-focus gaps with component or end-to-end coverage.
4. Complete health/attention/medicine, LCD presentation, and classic-control parity.
5. Pass the complete first-milestone gates and request the next audit decision only when eligible.
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
- Binding creative rejection: do not continue crude single-image Blender reconstructions of Jack or describe self-judged visual output as good. The current 3D and pixel assets remain provisional unless Mark explicitly accepts or locks them.
- Dependency gate: Mark approved the npm-registry disclosure and the exact audit passed at the critical threshold; high/moderate findings remain a documented release risk, not a completed fix.
- Storage provider: Google Drive only for this project. The private preservation root and its Cold Archive/Private Backup subfolders are restricted and separate from the phone-review mirror; iCloud is out of scope.
- Preservation progress: the final 17-part cold set (each part at most 45,000,000 bytes), cold manifest, private bundle, and private manifest all match authenticated Drive downloads. Both folders are restricted and separate from the phone-review mirror. The earlier five- and eight-part local sets and one unverified superseded Drive part remain retained pending separate cleanup approval. GitHub LFS object upload is still pending because no-charge capacity could not be verified.
- Candidate-correction preservation: 21 raw text originals / 121,449 bytes are retained in a 42,387-byte restricted Cold Archive ZIP plus private manifest; both authenticated-download hashes match. Their repository forms now use LF and only the exact approved Markdown/whitespace/blank-EOF corrections; the immutable raw→normalized mapping is gate-enforced.
- Project Kit staging: generic provider-selection and copy-safe authorization guardrails were applied only to the existing 0.6.0 staging copy; `skill-creator` validation and a fresh no-write bootstrap preview pass. Global installation remains unauthorized and unchanged.
- Not authorized: commit, push, publish, deploy, storefront, payments, analytics, accounts, or unattended project writes.
- Next human gate: after the refreshed candidate receives a controlled stage/diff-check/unstage proof and all final gates pass, Mark must approve the new exact candidate hashes. Earlier commit approval no longer applies.

## Definition of production-control success

- Mark receives one concise current-state report and only decisions that require him.
- Every worker has one bounded assignment and an unambiguous owner.
- Every milestone ends in a playable or renderable artifact with recorded evidence.
- Repository and Drive never become competing sources of truth.
- Automation reduces repeated work without creating unattended product or publishing risk.

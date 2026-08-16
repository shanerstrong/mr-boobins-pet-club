# Visual and 3D asset pipeline

## Purpose

Produce consistent game assets with fewer expensive iterations while preserving originals, provenance, technical compatibility, and accessible coded interaction.

## Promotion path

1. **Intake:** record the asset ID, purpose, approved references, ownership/license, privacy restrictions, target viewports, and runtime budget. Never overwrite an original.
2. **Specification:** define silhouette, palette, dimensions, states, camera, rig/animation contract, file format, naming, and acceptance views before polished generation.
3. **Cheap concept:** create the smallest useful draft—thumbnail, blockout, low-detail model, or test render—and label it exploratory rather than praising or presenting it as complete.
4. **Taste gate:** compare the candidate with approved references in fixed views. Record Mark's accepted or rejected direction in `CREATIVE_DIRECTION.md`; only Mark can approve the subjective result.
5. **Production source:** only after direction approval, build the reusable high-quality source. For 3D, preserve the editable model, textures, rig, animation names, units, and tool/version metadata.
6. **Technical validation:** check origin, scale, topology, texture paths, material support, clip inventory, file size, licensing, and fallback behavior. A technical pass does not grant visual approval.
7. **Integration:** export only the runtime derivative, keep interaction and accessibility in code, and map it through stable content/animation IDs.
8. **Rendered verification:** inspect the asset inside the real room at required phone and desktop sizes, including motion-reduced and failure fallbacks.
9. **Promotion:** mark the source and derivative approved only after both the technical gate and Mark's creative gate pass; store evidence and update the content catalog. Variants begin only after the base asset passes.

## 3D reference rules

- A reference-derived 3D model is useful for consistent likeness, camera, lighting, pose, and repeated screenshots; it is not automatically a faithful likeness or technically valid rig.
- One rejected modeling method is not permission to keep refining the same method. Stop, preserve the feedback, and change the references, approach, or tool before producing another candidate.
- Keep UI labels, arrows, hit targets, status communication, and controls as code/vector layers instead of baking them into rendered textures.
- Do not infer unseen identity details from an incomplete reference. Obtain consent before modeling a private person's likeness and keep private references out of Drive review mirrors unless separately approved.
- Generated geometry or imagery is never proof of anatomy, biomechanical correctness, safety, or licensing. Any fitness/medical use in another project requires a qualified domain review, with arrows and labels added from a verified anatomy map after rendering.

## Repository layout policy

Do not move the existing V0.6–V0.8 asset library until the working baseline is secured. New assets should converge on this logical separation when introduced or deliberately migrated:

```text
assets/references/<asset-id>/   approved local references; private by default
assets/source/<asset-id>/       editable production source
assets/runtime/<category>/      optimized files consumed by the application
evidence/assets/<asset-id>/     validation renders and manifests
```

Runtime code must not depend on private references, evidence, absolute paths, sibling projects, or Drive URLs.

## Four-tier storage policy

`asset-policy.v1.json` is the machine-readable classification and budget contract. `V0.6-V0.8_PREPOLICY_INVENTORY.json` is the immutable received-work anchor; its hashes establish file identity but do not create a backup.

1. **Normal Git:** code, documentation, manifests, license/provenance records, small runtime assets, and a bounded representative evidence set. Runtime files required by the GitHub Pages export remain here unless the deployment workflow explicitly fetches and verifies LFS objects.
2. **Path-scoped Git LFS:** canonical editable production-source binaries only. Five byte-identical canonical copies now use the narrow `assets/source/jack-v1/` and `assets/source/jack-v2/` convention and match the prospective LFS attributes. They are local full-byte files with expected LFS OIDs; no remote LFS preservation, staging, or conversion is claimed until no-charge capacity and fetch-back verification are proven.
3. **Checksum-indexed cold archive:** rejected iterations, redundant checkpoints, raw candidates, unused derivatives, and bulk evidence. The current 17-part archive and manifest are locally member-verified and authenticated-download SHA-256 verified in the restricted Drive Cold Archive folder. Originals and superseded staging remain untouched until a separate cleanup approval.
4. **Private/local with recoverable backup:** private references, logs, caches, and non-public material. Keep these out of Git and Drive review mirrors. The approved private bundle and manifest are authenticated-download SHA-256 verified in the restricted Drive Private Backup folder; raw private paths remain only in the non-public manifest.

Before adding an ignore or LFS rule, prove against the captured inventory that it does not hide or transform current unpreserved work. Run `npm run check:assets` after any asset, manifest, policy, import, evidence, or Git-attribute change.

## Checkpoint records

- `V0.6-V0.8_PREPOLICY_INVENTORY.json`: every received dirty file plus every file in `assets/` and `evidence/`, with byte size and SHA-256.
- `V0.6-V0.8_ASSET_CLASSIFICATION.json`: deterministic per-file mapping to the four tiers.
- `V0.6-V0.8_CHECKPOINT_CANDIDATE.json`: exact current normal-Git candidate and exact proposed-archive, local-only, and unresolved sets. It is a proposal; nothing is staged or preserved externally.
- `V0.6-V0.8_CHECKPOINT_REPORT.md`: human decision record, gate evidence, limitations, and required approvals.
- `V0.6-V0.8_PRESERVATION_MANIFEST.json`: repository-safe preservation summary containing only approved provider IDs, aggregate counts, sizes, hashes, and verification states—never private member paths, credentials, bearer URLs, or raw private contents.
- `V0.6-V0.8_TEXT_NORMALIZATION.json`: explicit path-by-path raw-preserved → deterministic-LF mapping for the 21 approved text corrections. The prepolicy inventory remains immutable; the verifier accepts a changed captured asset/evidence byte identity only when both sides of this mapping and its restricted Drive preservation proof match.

## Cost controls

- Approve silhouette and camera before textures, rigging, or variants.
- Use side-by-side fixed-view comparisons and stop at the first failed taste gate; do not spend production time trying to rescue a rejected direction.
- Reuse one validated rig and lighting/camera setup for families of skins and poses.
- Batch technically identical exports only after one representative asset passes end to end.
- Set file-size, texture, animation, and device-performance budgets before producing an expansion set.

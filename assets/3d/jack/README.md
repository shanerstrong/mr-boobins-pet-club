# Jack 3D character asset

Status: Mark approved Baby's static likeness on 2026-08-15. Baby and Teen mobile runtime GLBs pass structural validation, their editable Meshy sources reopen/render in Blender 4.5.12, and all 16 shared clips were rendered from the actual exported glTF channels without mesh collapse or detached parts. Mark asked to defer an approximately 8–12% Baby torso-length refinement until later. The canonical 40-bone shared rig and all 16 clips match between the editable Blender source and verified GLB; Adult transfer, desktop LODs, final age-set approval, and final package verification remain incomplete.

## Objective

Deliver one recognizable Jack character as three interchangeable skinned meshes:

- `baby` for the `baby` and `little-puppy` growth stages;
- `teen` for the `puppy` and `young-dog` growth stages; and
- `adult` for the `adult` growth stage.

All three skins must bind to the identical bone hierarchy and reuse the same animation library. Hunger and starvation are progressive morph targets on each age skin, not additional character models. The gentle `death_rest` behavior is a shared animation clip, not a separate dead mesh.

## Character identity

Every age preserves Jack's upright ears, long wedge muzzle, dominant mauve-charcoal nose, dark almond eyes, short white coat, lean shepherd-like build, sturdy paws, expressive smile/tongue, blue collar, and brass tag. Age changes affect height, limb length, chest/waist proportions, and facial maturity without changing identity.

## Integration boundary

This directory owns model references, editable sources, textures, rig/animation metadata, optimized exports, validation data, and source/licensing records. It does not own the pet-room renderer, simulation, persistence, growth calculations, care effects, audio, saves, or application integration.

Animation playback is presentation-only. It must not mutate simulation state, select care outcomes, or advance growth. Runtime code chooses the age skin and condition morph values; the asset package only exposes deterministic names.

## Production contract

- Blender authoring: meters, Z up, facing negative Y, root at world origin.
- Identical skeleton names, hierarchy, rest transforms, and orientation across all skins.
- Maximum 48 deform bones and four bone influences per vertex.
- Target per age skin: 8k-14k triangles.
- Preserve a separate desktop LOD for every age from the highest available clean Meshy source. Desktop targets at most 60k triangles in normal production and stops at 100k pending measured justification.
- Target initial character payload: under 3.5 MB practical, 6 MB hard stop before explicit approval.
- Stable mobile exports: `jack-baby.glb`, `jack-teen.glb`, and `jack-adult.glb`.
- Stable desktop exports: `desktop/jack-baby-desktop.glb`, `desktop/jack-teen-desktop.glb`, and `desktop/jack-adult-desktop.glb`.
- Both LODs reuse `jack-rig-animations.glb` and must expose identical bones, morphs, anchors, materials, and clip names.
- Stable materials: fur, ear, eyes, nose, mouth/tongue, collar, tag, and optional dirty condition.
- Required morphs: `condition_hungry`, `condition_starving`, `blink`, `lids_tired`, `nose_compress`, `smile`, `mouth_open`, and `tongue_out`.
- No free-roam or gameplay root motion.

The package-level machine contract is `asset-manifest.json`; the shared-rig contract is `rig/jack-rig.json`; deterministic clip timings are in `animations/clip-manifest.json`. The editable animation source is `source/jack-shared-rig-animations.blend`, the reusable runtime library is `exports/jack-rig-animations.glb`, and deterministic reports live under `evidence/3d-jack/`.

## Current source route

The approved Baby and age-progression references are being generated as private Meshy Pro assets, then reduced to the production triangle budget and brought into Blender for cleanup, shared-rig binding, morph authoring, animation, export, and validation. Meshy is an asset-generation tool, not the runtime or animation state machine.

The earlier procedural blockout/hero files remain preserved as historical checkpoints. They are not the approved production likeness and must not be integrated. The original higher-resolution Meshy age results remain preserved in Mark's private Meshy workspace for later acquisition as desktop LOD sources; the 10K remeshes are the mobile route. `skins/desktop-source-inventory.json` records the observed high-detail master budgets: Baby 1,937,286, Teen 1,968,156, and Adult 1,954,788 triangles. Those master counts are archival source quality, not runtime budgets.

The official Meshy Blender Bridge 0.6.1 is installed and previously validated against Blender 4.5.12. The signed-in in-app review browser cannot reach the Windows-local Bridge and Meshy's download persistence is intermittent, while the installed local Chrome extension has an incomplete native connection. Baby and Teen recovered GLBs are bound, structurally verified, and deformation-reviewed; Adult transfer still blocks the complete age set. No API key or paid API call was created.

Baby and Teen animation evidence is consolidated in `evidence/3d-jack/jack-{baby,teen}-deformation-16-clip-review.png`. Standing clips stay within 5 mm of the ground-contact threshold; the side-rest `sleep`/`death_rest` poses and `wake` transition permit up to 15 cm of hidden paw/tail floor overlap while preserving a fixed root. This is a documented first-model limitation, not a simulation write or root-motion workaround.

## Verification and definition of done

The character package is complete only when:

1. all three optimized GLBs and editable Blender sources open successfully;
2. all skins match the shared skeleton and material/morph contracts;
3. required clips exist with exact `play` and `clean` timing policies;
4. root motion and simulation mutation checks pass;
5. triangle, material, texture, byte, bone, weight, morph, and clip budgets pass;
6. phone-readable age, topology, rig, condition, and animation evidence is visually opened;
7. applicable checks in `docs/QUALITY_GATES.md` pass, with skipped checks reported honestly; and
8. Mark approves the final age-skin set and integration handoff.

## Stop conditions

Stop for secrets, destructive actions, external publication, unapproved dependency installation, repeated generation/export failure, inability to preserve Jack's likeness, or scope expansion into room/app integration. Do not commit, push, publish, deploy, or upload reference photos to the project Drive mirror.

# Jack 3D model handoff

Status: **V2.2 is the promoted mobile animation package. Baby, Teen, and Adult share one validated 27-bone quadruped skeleton and hybrid 28-clip library. Genuine Quaternius CC0 canine motion replaces the rejected procedural idle, walk, run, play/jump, wash/dirty reactions, and happy hop; Jack's clearer original dog-specific feed, sleep/rest, Boop, and Sit/Paw/Up actions remain in place. All three versioned V2.2 skin GLBs pass budget, contract, full-frame deformation, and runtime-playback checks. V1, V2.1, rejected retarget checkpoints, and high-resolution art sources remain preserved.** This additive record does not replace `docs/V0.5_FIGMA_HANDOFF.md` or `docs/design/3D_PET_ROOM_DIRECTION.md`.

Date: 2026-08-15

## Objective and integration boundary

Jack is one character presented through three interchangeable skinned meshes: Baby, Teen, and Adult. The V2 mobile skins reuse one bone hierarchy, exact inverse-bind matrices, one material vocabulary, and one deterministic animation library. They are not separate gameplay implementations. V2 condition/facial morph targets are not present and must not be assumed by the integration layer.

The package may expose meshes, materials, bones, morph targets, named animation clips, age metadata, and fallback renders. It must not advance needs or time, calculate growth, change care outcomes, save state, alter persistence, select audio, or mutate simulation state. The later `Build - 3D Pet Room Prototype` task consumes the verified exports; no application integration is authorized here.

## Current production state

| Skin | V2 mobile source | Runtime display scale | Verified runtime state |
| --- | --- | ---: | --- |
| Baby | Canonical Meshy quadruped repair-B mesh and weights | 1.00 | 9,738 triangles; 2,093,216-byte skin GLB; all 28 clips pass |
| Teen | Bounded proportion edit of canonical Baby topology/weights | 1.15 | 9,738 triangles; 2,094,384-byte skin GLB; all 28 clips pass |
| Adult | Bounded mature proportion edit of canonical Baby topology/weights | 1.28 | 9,738 triangles; 2,094,236-byte skin GLB; all 28 clips pass |

Mark approved Baby's static face, age read, silhouette, paws, collar, and tag on 2026-08-15. He separately requested that the Baby torso eventually be lengthened about 8–12% to reduce its short-spine read, then explicitly deferred that revision until later. That refinement must update both mobile and desktop variants plus weights, condition morphs, and review evidence; it is not silently treated as completed.

The earlier procedural blockout and hero assets remain historical checkpoints. Audit pass 1 rejected their likeness and anatomy, so they must not be integrated as production Jack. The independent V1 Baby/Teen assets and the recovered 10,286-face Adult Meshy GLB remain preserved as art/desktop sources, not V2 runtime skins.

The independent V1 shared-rig milestone also remains preserved: `exports/jack-rig-animations.glb` contains its 40-bone/16-name adapter library. It is historical and is not compatible with the V2 27-bone runtime package without deliberate retargeting.

## Animation-quality replacement checkpoint

Technical playback success does not equal visual quality. Mark rejected the
procedurally authored V2.1 motion as insufficiently canine on 2026-08-15.
V2.2 therefore uses genuine dog motion for the clips where the donor and Jack
skeletons match cleanly, while retaining the clearer custom actions where
automatic retargeting visibly regressed the result.

The official Quaternius `Ultimate Animated Animal Pack` canine subset is now
preserved under
`assets/3d/jack/v2/source/third-party/quaternius-ultimate-animated-animals-cc0/`.
The untouched Husky, Wolf, and Shiba Inu Blender sources open successfully in
Blender 4.5.12. Each contains 12 genuine quadruped actions at 30 fps, including
walk, gallop, jump, idle variations, eating, reactions, and death. The files
and bundled license are CC0 1.0. The Husky donor now supplies `idle`, `walk`,
`run`, `play`, `clean_reaction`, `dirty`, and `celebration_happy_hop` in V2.2.
Retargeting preserves Jack's canonical skeleton, maps motion beneath the fixed
gameplay root, repairs floor contact, and closes loops exactly. Donor eating
and death/rest were tested but rejected because its longer neck and rest
hierarchy did not collapse cleanly onto Jack's compact mobile rig; Jack's
clearer custom feed and gentle crouched rest remain production actions.

## Meshy quadruped V2 Baby runtime and training library

The additive V2 path under `assets/3d/jack/v2/` replaces the V1 animation
approach for the first working Baby integration without overwriting it. Meshy's
`Quadruped Dog` Smart Rig supplies the 27-bone baseline skeleton and Walking
motion. Blender repair-A removes the non-deforming helper, normalizes the fully
weighted Baby mesh, establishes identity `jack_root` and semantic anchors, and
restrains the gait. Blender repair-B adds original canine actions, per-frame
floor correction, and the final export source. No humanoid action was applied
or retargeted.

The V2 manifest contains 28 stable clips: the 16 pet-room clips plus `walk`,
`run`, `training_attention`, `training_sit`, `training_paw`, `training_up`,
`training_treat_receive`, `training_treat_eat`, `celebration_happy_hop`,
`celebration_spin_wag`, `celebration_goofy_shimmy`, and
`training_return_idle`. `training_up` and the original goofy shimmy briefly use
the hind legs while maintaining a dog silhouette. `play` remains exactly 3.000
seconds and `clean_reaction` remains exactly 1.500 seconds with the locked
water/washout/shake/sparkle marker sequence. Treat contact is locked to
`mouth_anchor` at 600 ms, followed by `treat_hidden` at 633 ms and a maximum
runtime prop distance of 1 cm.

Verified runtime outputs:

| Artifact | Purpose | Verified size |
| --- | --- | ---: |
| `assets/3d/jack/v2/exports/jack-baby-v2.2.glb` | Mobile Baby skin and quadruped skeleton | 2,093,332 bytes |
| `assets/3d/jack/v2/exports/jack-teen-v2.2.glb` | Mobile Teen skin on the identical quadruped skeleton | 2,094,492 bytes |
| `assets/3d/jack/v2/exports/jack-adult-v2.2.glb` | Mobile Adult skin on the identical quadruped skeleton | 2,094,340 bytes |
| `assets/3d/jack/v2/exports/jack-animations-v2.2.glb` | Shared hybrid 28-clip action library, no renderable mesh | 652,124 bytes |
| `assets/3d/jack/v2/exports/preview/jack-baby-v2.2-all-clips.glb` | Self-contained runtime/playback preview | 2,734,524 bytes |
| `assets/3d/jack/v2/exports/preview/jack-teen-v2.2-all-clips.glb` | Self-contained Teen playback preview | 2,735,684 bytes |
| `assets/3d/jack/v2/exports/preview/jack-adult-v2.2-all-clips.glb` | Self-contained Adult playback preview | 2,735,536 bytes |

Every V2 age skin has 9,738 rendered triangles, 8,224 vertices, 27 joints, one
material, maximum four influences, no unweighted character vertices, and one
1024x1024 embedded texture (4,194,304 decoded bytes). The shared inverse-bind
matrix hash is `9e6bb93959b910b32c7a6b609eb46f530e14b1ba019ac4596cb2336518608087`.
Direct GLB inspection confirms one renderable mesh, all required anchors,
invisible `hit_nose`, identity `jack_root`, no root-translation animation
channels, exact clip names/durations, and payload/budget compliance.

Every authored frame of every clip was evaluated in Blender. All 28 actions
have finite vertices, at most 5 mm floor penetration, bounded 0.35–1.35 m
height, bounded 1.75 m maximum axis span, and loop closure within 2 mm. The
final all-clips GLB was imported into a clean Blender scene and every action
produced measurable playback deformation. Visual evidence is consolidated into
the repaired gait board, age-specific eight-pose risk boards, and final
friendly-idle render under `evidence/3d-jack/v2/`. The Teen and Adult
`derived-a` boards were opened and show clean sit, paw, upright, feed,
sleep/rest, hop, and shimmy deformation.

The later renderer may observe clips and event markers but cannot use them to
advance time, needs, growth, persistence, care effects, or audio. Locomotion is
in-place; bounded screen travel belongs to the scene adapter. Teen and Adult
are production V2 mobile skins because they preserve the exact validated Baby
topology and vertex-to-bone binding, then apply only bounded proportion edits.
Their recommended 1.15 and 1.28 display scales are presentation metadata, not
the source of skeleton compatibility.

Automatic transfers onto the independent Teen/Adult Meshy topologies were not
promoted. Later variants passed numeric floor/height/span checks, but the
opened pose boards revealed severe hind-leg surface folding in sit and sleep.
Those Blender files and boards remain versioned rejected checkpoints. Original
Meshy age meshes remain available for a future desktop-specific rest-pose
retarget and manual weight-paint pass.

## Mobile and desktop LOD policy

Each age keeps two visual-quality variants, with no gameplay difference:

- Mobile uses the optimized 8k-14k triangle GLB and reduced embedded textures.
- Desktop preserves the highest available clean Meshy source, targeting at most 60k triangles in normal production and stopping at 100k without measured justification.
- The private masters were visually reopened and measured on 2026-08-15: Baby 1,937,286 triangles/1,012,952 vertices; Teen 1,968,156/1,018,724; Adult 1,954,788/1,010,234. They remain saved in Meshy. The optimized 10,286-face Adult GLB is now also preserved locally; untouched high-resolution master acquisition remains optional desktop work.
- Desktop files live under `exports/desktop/`; untouched high-resolution inputs live under `exports/source/desktop/`. Mobile reduction must never overwrite either.
- The promoted V2 mobile variants bind to the identical 27-bone skeleton, semantic anchors, root/axis/scale rules, and external 28-clip library. Desktop sources are not yet rebound to that contract, and V2 mobile skins do not carry the V1 eight-morph vocabulary.
- Runtime LOD selection belongs to the later renderer/integration layer and cannot change simulation behavior.

## V2 age-skin contract

`assets/3d/jack/v2/asset-manifest-v2.json` is the production V2 machine contract. It maps the three age skins to one canonical 27-bone inverse-bind hash and 28-clip library, records each verified payload and display scale, and locks the presentation-only authority boundary. The older `assets/3d/jack/asset-manifest.json` remains preserved as the V1 contract and must not be mixed with V2 bindings.

| Runtime skin | Existing growth stages | Relative display height | Silhouette intent |
| --- | --- | ---: | --- |
| `baby` | `baby`, `little-puppy` | 1.00 | canonical approved Baby proportions |
| `teen` | `puppy`, `young-dog` | 1.15 | modestly smaller head and longer torso; adolescent read |
| `adult` | `adult` | 1.28 | smaller relative head and longer/deeper torso; mature read |

The integration wrapper may apply the relative display scale above. That scale is presentation-only and must not alter simulation or collision rules. Facial identity, collar/tag, palette, and material slots remain stable across skins.

## Coordinate system and neutral pose

- Authoring unit: meter.
- Blender up axis: Z; Jack faces negative Y.
- Exported glTF up axis: Y; Jack faces positive Z.
- Exported `jack_root` transform is identity; paw/ground contact is at Y = 0.
- Applied object transforms before binding and export.
- Neutral stance is symmetrical and planted, with no authored gameplay translation.
- Shared clips assume identical bone names, hierarchy, orientation, and rest transforms.

## Palette and material vocabulary

| Role | Base value | Runtime slot |
| --- | --- | --- |
| Fur light | `#F4F0E5` | `fur` |
| Fur shade | `#D9DEE0` | `fur` |
| Ear interior | `#D99B9C` | `ear` |
| Nose base | `#4A343B` | `nose` |
| Eye | `#241F24` | `eyes` |
| Tongue | `#E78F9A` | `mouth_tongue` |
| Collar | `#3D78A8` | `collar` |
| Tag | `#D5A44D` | `tag` |
| Dirty overlay | neutral multiply/roughness variation | `condition_dirty` |

Eyes and nose use a lower roughness and stronger specular response than fur. Final texture atlases should normally be 2K or smaller per age skin; any 4K source must be reduced unless measured review evidence proves 2K inadequate.

## Topology and deformation budget

- Per age skin target: 8k-14k rendered triangles.
- One continuous deforming body mesh is preferred; eyes, tongue/teeth, collar, and tag may remain separate where deformation and draw-call evidence justify it.
- Maximum 48 deform bones and four influences per vertex.
- No visible primitive intersections or detached paws/limbs.
- Preserve silhouette loops around muzzle, eyelids, jaw, shoulders, elbows, hocks, paws, and tail base.
- Tail must be continuous and deformable, not segmented rigid cylinders.
- Baby (9,744 triangles) and Teen (10,372 triangles) are both within budget and have passed GLB inspection, clean Blender import/reopen, texture checks, and representative 16-clip deformation review.

## Legacy V1 shared-rig and morph contract

The machine-readable contract is `assets/3d/jack/rig/jack-rig.json`. Its compact hierarchy includes root/pelvis, two spine bones, chest, two neck bones, head/muzzle/jaw, two-bone ears, six-bone front legs, five-bone rear legs, and a four-bone tail. The canonical rest skeleton and 16 animation actions exist in `assets/3d/jack/source/jack-shared-rig-animations.blend`; Baby and Teen are bound to that identical skeleton and inverse-bind hash, while Adult remains pending.

The older V1 design required these morph targets:

- `condition_hungry` - subtle progressive volume loss while Jack is underfed;
- `condition_starving` - stronger but non-graphic volume loss at prolonged zero hunger;
- `blink`, `lids_tired`, `nose_compress`, `smile`, `mouth_open`, and `tongue_out`.

Healthy is the basis mesh. These targets are not present in the promoted V2
mobile skins. A future V2 morph pass must preserve collar fit, eye placement,
paw contact, and deformation quality and then repeat the complete 28-clip
validation before the runtime may depend on them.

## Deterministic clip manifest

The source of truth is `assets/3d/jack/animations/clip-manifest.json`.

| Clip | Duration | Loop | Contract |
| --- | ---: | --- | --- |
| `idle` | 3000 ms | yes | breathing, ear/eye life, planted root |
| `tail_wag` | 1200 ms | yes | reusable additive-style tail/body reaction |
| `feed` | 2200 ms | no | anticipation and happy response; no hunger mutation |
| `sleep` | 3200 ms | yes | settle/breathing presentation |
| `wake` | 1400 ms | no | wake-to-neutral |
| `play` | exactly 3000 ms | no | fixed presentation window, no root motion |
| `clean_reaction` | exactly 1500 ms | no | 0 water, 400 washout, 800 shake, 1150 sparkle, 1500 complete |
| `boop_comfortable` | 700 ms | no | soft nose response and comfortable reaction |
| `boop_need_hunger` | 800 ms | no | nose response plus hunger gesture; no need mutation |
| `boop_need_energy` | 800 ms | no | nose response plus energy gesture; no need mutation |
| `boop_need_hygiene` | 800 ms | no | nose response plus hygiene gesture; no need mutation |
| `boop_need_happiness` | 800 ms | no | nose response plus happiness gesture; no need mutation |
| `boop_rejected` | 300 ms | no | restrained response; no false success cue |
| `tired` | 2000 ms | yes | low-energy held/loopable pose |
| `dirty` | 900 ms | no | presentation reaction only |
| `death_rest` | 1800 ms | no | gentle non-graphic settle to still rest |

All clips are presentation-only, carry no gameplay root motion, and cannot write simulation state.

`evidence/3d-jack/rig-animation-validation.json` validates the exported GLB at 30 fps. It reports 40/40 required bones, 16/16 clips, exact duration for every clip, root translation/rotation invariant within `1e-6`, and scene extras declaring `presentation_only=true`, `simulation_mutation=false`, and `root_motion_gameplay=false`. The reconciled shared GLB is 1,344,804 bytes. The separate `animation-event-manifest.json` owns phase markers and remains read-only with respect to simulation.

`evidence/3d-jack/jack-baby-deformation-16-clip-review.png` is the phone-readable visual record for the actual exported animation channels composed onto the Baby runtime skin. All 16 representative frames were opened and inspected: no mesh collapse or detached parts were found, standing clips remain within 5 mm of the ground-contact threshold, and every root translation is `(0,0,0)`. The side-rest `sleep`/`death_rest` poses and `wake` transition allow up to 15 cm of hidden paw/tail floor overlap; this is retained as a documented first-model polish limitation.

`evidence/3d-jack/jack-teen-deformation-16-clip-review.png` applies the same actual-channel review to Teen. The single consolidated board was opened instead of separately inspecting 16 screenshots: no collapse or detached parts were found, standing overlap peaks at 3.74 mm, rest/wake overlap peaks at 11.8405 cm, all 16 clips are present, and every root translation remains `(0,0,0)`.

## Condition-state integration contract

This is a read-only mapping for the later renderer:

- hunger 40-100: healthy basis;
- hunger 1-39: progressively blend `condition_hungry`;
- hunger 0: retain full hungry blend and progressively blend `condition_starving` using existing starvation duration, capped at the current 120-minute policy;
- dead state: play `death_rest`, then hold its final pose.

The renderer reads existing values. The character asset does not decrement hunger, advance starvation time, trigger death, or revive Jack.

## Export contract

Stable V2.2 mobile outputs for integration:

- `assets/3d/jack/v2/exports/jack-baby-v2.2.glb`
- `assets/3d/jack/v2/exports/jack-teen-v2.2.glb`
- `assets/3d/jack/v2/exports/jack-adult-v2.2.glb`
- `assets/3d/jack/v2/exports/jack-animations-v2.2.glb`
- self-contained playback previews under `assets/3d/jack/v2/exports/preview/`
- editable production sources under `assets/3d/jack/v2/source/`

Preserved V1/desktop planned outputs:

- `assets/3d/jack/exports/jack-baby.glb`
- `assets/3d/jack/exports/jack-teen.glb`
- `assets/3d/jack/exports/jack-adult.glb`
- `assets/3d/jack/exports/jack-rig-animations.glb`
- `assets/3d/jack/exports/desktop/jack-baby-desktop.glb`
- `assets/3d/jack/exports/desktop/jack-teen-desktop.glb`
- `assets/3d/jack/exports/desktop/jack-adult-desktop.glb`
- editable Blender sources under `assets/3d/jack/source/`
- fallback stills/previews under `evidence/3d-jack/`

Export settings: glTF 2.0/GLB, Y-up conversion, meters, applied transforms, selected objects only, materials and required textures embedded or packaged deterministically, morph normals where supported, skin weights limited to four, animations exported with stable names, no cameras or lights, no gameplay root motion.

Practical initial character payload target is under 3.5 MB; 6 MB is a hard stop pending explicit approval. A shared animation GLB should prevent identical clip data from being duplicated across all three age skins when the runtime loader supports external/shared animation binding.

## Verification and quality gates

Required asset-specific checks:

1. reopen every editable Blender source;
2. import every GLB into a clean Blender scene;
3. inspect triangle, vertex, material, texture, bone, weight, morph, clip, and byte counts;
4. verify identical skeleton contracts across all skins;
5. verify every required clip name and exact timing policy;
6. confirm root translation is zero within `1e-6` during every clip;
7. test hungry/starving morph extremes and representative animation poses for clipping/collapse;
8. open front, side, rear, three-quarter, topology, rig, condition, and animation evidence at phone-review scale;
9. run the applicable commands in `docs/QUALITY_GATES.md`; and
10. verify Drive mirrors contain no original reference photographs or account/private data.

### Latest verification — 2026-08-15

- `git diff --check`: pass; only pre-existing Windows line-ending warnings were reported.
- Project Kit JSON parse gate: pass.
- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm test`: pass, 7 files and 73 tests.
- `npm run export:web`: pass using `/mr-boobins-pet-club/` base path.
- `npm run smoke`: pass.
- `npm run check:deps`: pass at the required critical threshold; npm reports 16 high and 7 moderate transitive Expo/Metro advisories. The proposed automatic fixes are breaking, so no dependency change was made in this asset-only task.
- Shared rig GLB parse/reopen: pass; 40 joints, 16 exact-duration clips, canonical inverse-bind hash `5ddc1e23921fbe8fc1ef32ae70671596ddf7e3e4e2902cb2a887fd742e3398ea`, and zero root motion within `1e-6`.
- Editable shared-rig source rebuild: pass in Blender 4.5.12; the Blender source and runtime export both carry the locked 40-bone/16-clip adapter contract.
- Phone-review board: rendered at 1440×2200, opened visually, and mirrored to Drive.

- V2 Meshy quadruped ingest: pass; recovered without credit use, inspected in Blender 4.5.12, 27 deform bones, 9,738 character triangles, 8,224 weighted vertices, maximum four influences, and zero unweighted character vertices.
- V2 walk repair: pass; the consolidated source/repaired comparison was opened. Repair-A removes the baseline's hind-leg crossing and floor drag while retaining a stable quadruped gait.
- V2 risky-pose review: pass for the production milestone. The single eight-pose board was opened after axis measurement and revision; sit/paw/feed/rest remain quadruped, while up and the original shimmy use a brief believable rear without humanoid deformation.
- V2 full-frame deformation: pass for all 28 clips. Every authored frame has finite geometry, no more than 5 mm penetration, bounded height/span, and loop closure within 2 mm.
- V2 GLB contract: pass; 9,738 triangles, 27 joints, one material, one 1024 texture, 4,194,304 decoded texture bytes, 2,093,216-byte Baby skin, 548,748-byte animation library, 28 exact clip names, policy durations, semantic anchors, invisible nose proxy, treat-contact ordering, identity root, and no root-translation channel.
- V2 runtime round trip: pass; the self-contained all-clips preview reimported into a clean Blender scene and all 28 actions produced finite, measurable mesh playback.
- V2 Teen derived mobile skin: pass; 9,738 triangles, 8,224 vertices, 27 joints, one material, one 1024 texture/4,194,304 decoded bytes, 2,094,384-byte skin, identical inverse-bind hash, 28/28 exact clips, full-frame deformation pass, runtime round-trip pass, and visually clean `derived-a` risk-pose board.
- V2 Adult derived mobile skin: pass; 9,738 triangles, 8,224 vertices, 27 joints, one material, one 1024 texture/4,194,304 decoded bytes, 2,094,236-byte skin, identical inverse-bind hash, 28/28 exact clips, full-frame deformation pass, runtime round-trip pass, and visually clean `derived-a` risk-pose board.
- V2 automatic raw-topology transfers: rejected, not integration outputs. Numeric bounds were insufficient; the opened Teen/Adult transfer boards showed severe hind-leg folding in sit/sleep. Versioned checkpoints remain solely for traceability.
- V2.2 hybrid canine-motion source: pass. Quaternius Husky CC0 motion is retargeted only for seven clean-fit actions; every earlier candidate remains versioned, and the original V2/V2.1 GLBs remain untouched.
- V2.2 visual motion evidence: opened. The four-phase locomotion board shows alternating planted/lifted paws for walk/run and a quadruped jump/play arc; the eight-pose board shows coherent feed, Sit/Paw/Up, sleep/rest, hop, and original shimmy silhouettes. The 720×720 H.264 motion reel covers ten highest-value actions in one phone-viewable file.
- V2.2 full-frame deformation: pass for Baby, Teen, and Adult, all 28 clips, with finite geometry, floor limits, bounded height/span, and exact loop closure.
- V2.2 GLB contract and runtime round trip: pass for all three skins. Each retains 9,738 triangles, 27 joints, one material, the 1024 texture, identical inverse-bind hash, all semantic anchors, exact clip timing/event parity, zero `jack_root` translation channels, and 28/28 measurable imported actions.
- Application visual, training-modal, accessibility, and audio QA were not rerun manually because this task did not modify application/UI/audio files. Their deterministic lint, type, unit, export, and smoke gates passed; character-specific visual QA used the opened age deformation boards instead.

- Baby mobile GLB structural validation: pass; 9,744 triangles, 8,163 vertices, 40 joints, maximum four weights per vertex, eight non-empty morph targets, one material, three textures, 5,308,416 decoded texture bytes, and all semantic anchors.
- The Baby fixed-camera phone board compares the smooth 1,937,286-triangle preserved master against front/side/three-quarter/rear renders from the actual 9,744-triangle mobile runtime GLB. Both evidence routes were visually opened, and Mark approved the static likeness on 2026-08-15.
- Baby deformation/action QA: pass for all 16 actual exported clips. The review board was opened at 1440 pixels wide; no collapse or detached parts were observed, all root translations remained invariant, and the documented rest-pose floor-overlap ceiling passed.
- Teen source/runtime validation: pass; raw source SHA-256 `741f4c24f8fbe5ee76ea4bdabe92c56f0b91af20a3c291e83c9ac49545b8fc7b`, 10,372 triangles, 7,751 vertices, 40 joints, maximum four weights, eight non-empty morphs, one material, three reduced textures, 5,308,416 decoded texture bytes, all semantic anchors, and a 3,048,908-byte runtime GLB.
- Teen deformation/action QA: pass for all 16 actual exported clips. Only the consolidated 1440-pixel-wide board was opened; no collapse or detached parts were observed, root translation remained invariant, standing overlap stayed under 5 mm, and rest overlap stayed under 15 cm.

The clean V2 mobile age-skin/animation MVP is complete. V2 condition morphs,
desktop-quality rest-pose retargets, all desktop LOD exports, the deferred Baby
torso-length polish, and final in-app scene integration remain explicit future
milestones rather than hidden blockers for this mobile package.

## Known limitations and stop conditions

- Meshy's official Blender Bridge 0.6.1 is installed and previously returned Blender 4.5.12 from its Windows-local endpoint. The browser/Bridge transfer route remains unreliable. A temporary copy of Blender 4.5.12 successfully rebuilt, reopened, imported, measured, and rendered the repository artifacts; its extension-cache and Meshy add-on log warnings are non-fatal and do not affect the generated files. No API key or paid API call was created.
- Baby, Teen, and Adult V2 mobile GLBs are structurally and visually validated. The independent Meshy Adult optimized GLB is also preserved; all three untouched high-resolution master downloads and desktop-specific rebinding remain pending only for the desktop milestone.
- The shared V2 rig/animation GLB, matching editable Blender sources, and all three age deformation reviews are verified.
- V2 mobile age skins do not include the V1 eight condition/facial morphs. Hungry/starving appearance must use a separately validated future morph/material pass; the renderer must not assume those targets exist today.
- Teen/Adult age differences are intentionally modest mesh proportions plus presentation-only display scale. More aggressive independent topology is deferred because automatic transfer produced visible deformation defects.
- Baby rest clips have up to 15 cm of hidden paw/tail floor overlap at the sampled side-rest/wake poses. Standing clips stay within 5 mm; a later polish pass may replace the overlap with tighter per-limb contact animation.
- The compact V2.2 sleep/death actions are gentle crouched rests rather than a fully curled side-lying performance. Automatic donor rest/eating retargets were intentionally rejected after visual comparison; a future manual neck-chain and per-limb contact pass can improve these without blocking the mobile gameplay prototype.
- Full-body likeness ultimately requires Mark's approval because the supplied photographs do not provide a neutral lower-body turnaround.

Stop for repeated export/validation failure, unapproved dependency installation, secrets, destructive actions, external publication, inability to preserve likeness, or any scope expansion into room/app integration.

# Jack quadruped V2

V2 is the additive replacement pipeline for Jack's mobile character rig and
animation library. Every V1 file outside this directory remains preserved.

## Current state

V2.2 replaces the rejected procedural motion where the free Quaternius CC0
canine donor is a clean fit: `idle`, `walk`, `run`, `play`,
`clean_reaction`, `dirty`, and `celebration_happy_hop`. Blender retargeting
maps the donor pelvis and deform chains onto Jack's 27-bone quadruped rig,
keeps `jack_root` stationary, transfers presentation-only weight shifts to
`Hips`, repairs floor contact, and forces exact loop closure. Jack's clearer
dog-specific `feed`, sleep/rest, Boop, and Sit/Paw/Up training actions remain
original Blender actions; the donor's longer neck/rest hierarchy was rejected
after visual comparison because it produced worse contact on this compact
mobile skeleton. Baby, Teen, and Adult V2.2 GLBs all pass 28-clip full-frame
deformation, GLB contract, and clean-import runtime playback validation.

Meshy's **Quadruped Dog / Smart Rig** completed against the existing approved
Baby mesh on 2026-08-15. The account balance remained 1,050 before and after
the task. The signed zero-credit Meshy package was recovered and preserved as
`source/meshy/jack-baby-meshy-smart-rig-v2.zip`, with stable GLB copies for the
rigged character and the Walking-with-skin result.

Blender 4.5.12 inspection confirmed one 27-bone quadruped armature, a fully
weighted 9,738-triangle character mesh, no character vertices over four
influences, and a 24-frame Walking source action. The unweighted 80-triangle
Meshy helper is removed from every working/export source. The raw ingest,
repair-A locomotion checkpoint, and canonical repair-B animation source remain
separate and preserved.

Repair-B contains 28 dog-specific, in-place actions covering locomotion,
pet-room care, Boop reactions, the three-command training MVP, treat handling,
and three original celebrations. The high-risk pose board was visually opened;
`training_up` and `celebration_goofy_shimmy` rear briefly on the hind legs but
remain canine. Full-frame validation sampled every frame of every action with
finite geometry, no collapse, no more than 5 mm floor penetration, bounded
silhouette spans, and closed loops. The exported all-clips GLB was reimported
and all 28 clips produced measurable deformation.

Verified Baby runtime metrics: 9,738 triangles, 27 joints, one material, one
1024x1024 texture (4,194,304 decoded bytes), 2,093,216-byte skin GLB,
548,748-byte shared animation GLB, and 2,630,728-byte all-clips preview. Exact
3.000-second `play`, exact 1.500-second `clean_reaction`, marker parity,
semantic anchors, invisible `hit_nose`, treat-contact timing, identity
`jack_root`, and absence of root-translation channels all pass.

Teen and Adult match the same 9,738-triangle/27-joint/one-material/1024-texture
contract. Their skin GLBs are 2,094,384 and 2,094,236 bytes; their self-contained
all-clips previews are 2,631,900 and 2,631,748 bytes. Both share inverse-bind
SHA-256 `9e6bb93959b910b32c7a6b609eb46f530e14b1ba019ac4596cb2336518608087`,
pass all 28 runtime clips, and have clean opened risk-pose boards.

Baby, Teen, and Adult are ready for later scene-adapter integration. The final
mobile age set deliberately uses Baby V2's validated topology, normalized
weights, UVs, material, 27-bone skeleton, and inverse-bind matrices for all
three skins. Teen applies a modest smaller-head/longer-torso proportion pass
and recommends a presentation-only runtime scale of 1.15; Adult applies a
stronger mature proportion pass and recommends 1.28. This is the reliable
"skins on one rig" architecture: all three consume the exact same 28-clip
library without retargeting.

Independent Teen and Adult Meshy meshes remain preserved as age-art and future
desktop sources. Several automatic raw-topology weight transfers also remain
as versioned checkpoints, but they are rejected: although numeric bounds
checks passed, the risk-pose renders revealed severe hind-leg surface folding
in sit and sleep. The derived mobile skins remove that defect by retaining the
already validated Baby vertex-to-bone binding. Condition/facial morphs from V1
were not propagated into these V2 mobile skins and remain a documented future
polish item rather than a claimed capability.

## Versioned outputs

- `source/jack-baby-quadruped-v2.blend`
- `source/jack-baby-quadruped-v2-repair-a.blend`
- `source/jack-baby-quadruped-v2-repair-b.blend`
- `source/jack-baby-quadruped-v2-repair-c-quaternius-h.blend`
- `source/jack-teen-quadruped-v2-derived-b-quaternius.blend`
- `source/jack-adult-quadruped-v2-derived-b-quaternius.blend`
- `source/jack-teen-quadruped-v2-derived-a.blend`
- `source/jack-adult-quadruped-v2-derived-a.blend`
- `source/meshy/jack-baby-meshy-smart-rig-v2.glb`
- `source/meshy/jack-baby-meshy-walking-v2.glb`
- `source/meshy/jack-adult-meshy-v2.glb`
- `exports/jack-baby-v2.glb`
- `exports/jack-teen-v2.glb`
- `exports/jack-adult-v2.glb`
- `exports/jack-animations-v2.glb`
- `exports/jack-baby-v2.2.glb`
- `exports/jack-teen-v2.2.glb`
- `exports/jack-adult-v2.2.glb`
- `exports/jack-animations-v2.2.glb`
- `exports/preview/jack-baby-v2-all-clips.glb`
- `exports/preview/jack-teen-v2-all-clips.glb`
- `exports/preview/jack-adult-v2-all-clips.glb`
- `rig/quadruped-rig-contract-v2.json`
- `animations/clip-manifest-v2.json`
- `animations/animation-event-manifest-v2.json`
- `textures/jack-baby-basecolor-v2.png`

Validation evidence lives under `evidence/3d-jack/v2/`, including the repaired
walk board, age-specific risk-pose boards, final friendly-idle fallback, export
reports, GLB contract reports, full-frame deformation reports, and runtime
playback reports. The production Teen/Adult boards contain `derived-a` in the
filename; raw-transfer boards are rejected checkpoints only.

## Non-negotiable rules

- Meshy dog/quadruped motion may be used as a baseline; humanoid animation may
  be timing reference only and is never applied to the dog rig.
- Locomotion is authored in-place. The room adapter owns bounded presentation
  travel and may not mutate simulation state.
- Skinning is limited to four normalized influences per vertex.
- Baby, Teen, and Adult skins resolve to one canonical skeleton, inverse-bind
  matrix hash, and clip vocabulary; display scale is presentation-only.
- Existing exact policies remain: `play` is 3.000 seconds and
  `clean_reaction` is 1.500 seconds.
- V2 never overwrites a V1 source, export, report, or render.

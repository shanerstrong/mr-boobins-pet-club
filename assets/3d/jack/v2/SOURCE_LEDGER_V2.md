# Jack quadruped V2 source ledger

| Artifact | Origin | License/ownership | Production note |
| --- | --- | --- | --- |
| `Jack Baby Optimized 10K` | Existing private Meshy Pro asset produced for this project from approved Jack references | Project-generated asset; paid-plan private/commercial output | Starting geometry only; no reference photographs are embedded or uploaded by this V2 task |
| `jack-baby-meshy-smart-rig-v2.zip` and extracted GLBs | Meshy Smart Rig applied to `Jack Baby Optimized 10K` on 2026-08-15 | Project-generated derivative of the owned Baby asset | Zero credits consumed; signed package recovered intact; archive SHA-256 `b76d1d9464fa125fed62ae0aaf8d3efe2d45641a5f8b707a831d9f566f42edd6` |
| `jack-baby-meshy-walking-v2.glb` | Meshy quadruped animation library, added automatically with Smart Rig | Meshy paid-plan output for project use | Blender inspection: 27-bone rig, 24-frame/24-fps gait, four influences maximum; retained only as the locomotion baseline |
| `jack-baby-quadruped-v2.blend` | Deterministic Blender ingest of the Meshy Walking-with-skin GLB | Project working source | Additive raw-ingest checkpoint; Meshy hierarchy and weights preserved |
| `jack-baby-quadruped-v2-repair-a.blend` | Blender repair of the recovered Meshy source | Project working source | Helper removal, scale/ground normalization, semantic anchors, normalized weights, and restrained in-place walk/run checkpoint |
| `jack-baby-quadruped-v2-repair-b.blend` | Original Blender action-authoring and floor-contact pass | Project-owned editable production source | Canonical Baby V2 source; 28 dog-specific actions, full-frame floor correction, no humanoid retargeting, no gameplay root motion |
| `jack-baby-quadruped-v2-repair-c-quaternius-h.blend` | Blender retarget/repair of selected Quaternius Husky actions onto Repair-B | Mixed project source plus CC0 motion | Canonical Baby V2.2 source; seven genuine canine actions replace rejected procedural motion, 21 clearer original Jack actions remain, fixed gameplay root, exact loop closure |
| `jack-adult-meshy-v2.glb` | Existing project-owned `Jack Adult Optimized 10K` Meshy asset downloaded from Mark's signed-in workspace | Project-generated Meshy Pro output | 10,286-face/7,892-vertex age-art source; download used zero credits and no API call; preserved for future desktop or dedicated rest-pose retargeting |
| `jack-teen-quadruped-v2-derived-a.blend` | Bounded Teen proportion edit of the validated Baby V2 topology and weights | Project-owned editable production source | Canonical Teen mobile source; exact 27-bone binding and shared 28-clip library; recommended presentation-only display scale 1.15 |
| `jack-adult-quadruped-v2-derived-a.blend` | Bounded Adult proportion edit of the validated Baby V2 topology and weights | Project-owned editable production source | Canonical Adult mobile source; exact 27-bone binding and shared 28-clip library; recommended presentation-only display scale 1.28 |
| `jack-teen-quadruped-v2-derived-b-quaternius.blend` and `jack-adult-quadruped-v2-derived-b-quaternius.blend` | V2.2 age skins derived from the Repair-C hybrid animation source | Mixed project source plus CC0 motion | Production V2.2 Teen/Adult sources; exact shared skeleton/weights/actions; runtime display scales remain 1.15/1.28 |
| `jack-teen-quadruped-v2-transfer-*.blend` and `jack-adult-quadruped-v2-transfer-a.blend` | Automatic weight-transfer experiments onto independent Meshy age topology | Project working checkpoints; rejected | Preserved for traceability only. Numeric bounds passed on later attempts, but consolidated risk-pose renders exposed severe hind-leg folding in sit/sleep; never integrate these files |
| V2.2 training, care, facial, and celebration actions | Hybrid of original Blender dog actions and selected Quaternius Husky motion | Project-owned original animation plus CC0 1.0 motion | Quaternius supplies idle/walk/run/play, wash/dirty reactions, and happy hop; no humanoid animation was applied or retargeted |
| `celebration_goofy_shimmy` | Original canine rear-and-shoulder shimmy authored for Jack | Project-owned original animation | Does not reproduce or trace a Fortnite emote or another protected animation |
| `jack-baby-basecolor-v2.png` | 1024x1024 export reduction of the project-owned embedded Meshy texture | Project-generated derivative | Mobile-only texture; the 2048 source remains embedded in the preserved editable source |
| Quaternius `Husky.blend`, `Wolf.blend`, and `ShibaInu.blend` | `Ultimate Animated Animal Pack`, downloaded from the creator's official public Drive folder on 2026-08-15 | CC0 1.0 Universal; commercial use and modification permitted; attribution not required | Untouched donor sources. Husky motion is selectively retargeted into V2.2; no Quaternius mesh/material is exported with Jack. Wolf/Shiba remain unused alternatives. |

The final Teen and Adult mobile GLBs reuse `jack-baby-basecolor-v2.png` and do
not embed V1 condition/facial morphs. This prioritizes deterministic shared-rig
deformation for the MVP; condition morph propagation is deferred and must not
be inferred from the V2 file names.

The repository remains the development source of truth. No private reference
photographs, credentials, or private account data are embedded in these V2
artifacts. Google Drive copies, when created, are review mirrors only.

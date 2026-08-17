# Jack V4 source ledger

| Asset | Origin | Status / use |
| --- | --- | --- |
| `source/jack-adult-v4-reference-a.blend` | Preserved project-owned Meshy adult GLB imported and ground-normalized locally in Blender 4.5.12 | Untouched V4 comparison baseline; 7,892 vertices, 10,286 triangles, one material, no rig or animation |
| `source/jack-adult-v4-candidate-a.blend` | Bounded Blender proportion edits from the reference source | Exploratory first pass; preserved, not promoted |
| `source/jack-adult-v4-candidate-b.blend` | Stronger proportion pass plus automatic nose/eye material assignment | Rejected checkpoint; eye material selected incorrect face/ear-base polygons |
| `source/jack-adult-v4-candidate-c.blend` | Candidate-B geometry with eye assignment removed and a tighter nose mask | Rejected checkpoint; visible jagged nose-mask boundary |
| `source/jack-adult-v4-candidate-d.blend` | Candidate-B geometry with the coherent original material restored | Current static likeness review candidate; not rigged, exported, integrated, or approved |
| `evidence/3d-jack/v4/jack-adult-v4-candidate-d-phone-board.png` | Local 1024px front/side/three-quarter Cycles renders | Phone-viewable public model evidence; contains no reference photos |

The ten current adult-Jack photographs supplied on 2026-08-16 were inspected
locally as likeness references. They were not copied into the repository,
embedded in a Blender file, included in an export, or uploaded to Drive.

No new generation, Meshy credit, API, purchase, humanoid animation, or third-
party asset was used for V4.

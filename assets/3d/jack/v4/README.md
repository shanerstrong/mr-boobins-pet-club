# Jack V4 adult likeness correction

Status: **exploratory static likeness checkpoint; not approved and not a runtime replacement.**

V4 uses the ten current adult-Jack photographs supplied on 2026-08-16 as
local-only likeness references. The photographs are not copied into this
directory, embedded in Blender files, or included in exports.

The first V4 milestone is deliberately narrow: correct the adult silhouette
and identity before attempting another skin transfer. V2.2 remains the beta
runtime package until a V4 candidate passes both Mark's visual approval and
quadruped deformation validation.

Source route:

1. Start from the preserved independent Meshy adult mesh because it is closer
   to adult Jack than the stretched Baby V2.2 skin.
2. Compare neutral front, side, and three-quarter renders against the current
   photo set using `ADULT_LIKENESS_SPEC_V4.md`.
3. Preserve the existing topology, texture, shape keys, and every prior V2/V3
   checkpoint while applying bounded proportion edits.
4. Do not promote or rig the candidate until the cheap static likeness gate is
   reviewed.

No Meshy credits, API calls, purchases, humanoid animation, application edits,
or private-reference uploads are authorized by this checkpoint.

## 2026-08-16 checkpoint result

Candidate D is the current review artifact. It preserves the independent
adult Meshy topology and original material while applying bounded corrections
for muzzle projection, head width, ear proportion, torso length, abdominal
tuck, hindquarter mass, paw footprint, and tail length/width. The editable
source remains unrigged and is not a runtime candidate.

Preserved exploratory history:

- Candidate A: conservative geometry correction; retained as the first pass.
- Candidate B: stronger proportions plus an automatic dark-eye/nose material
  selection. Rejected because the eye selection painted dark star-shaped
  patches near the ear bases.
- Candidate C: removed the eye failure but retained a procedural nose mask.
  Rejected because the mask edge was visibly jagged on the white muzzle.
- Candidate D: stronger geometry with the coherent original face texture.
  This is the clean static likeness checkpoint for Mark's review.

Visible limitations in Candidate D remain explicit: the source texture still
has lighter/golder eyes than Jack, the nose is not yet as dark or organic as
the photographs, the paws/lower legs remain somewhat blocky, and the tail
needs better coat volume. These require deliberate UV/texture and topology
work after the likeness direction is approved; they are not hidden by another
automatic material assignment.

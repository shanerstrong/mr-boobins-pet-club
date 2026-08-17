# Jack V3 native-canine-rig compatibility spike

Status: **preserved research checkpoint; rejected as the beta replacement.**

This additive V3 spike tested the free animated Quaternius German Shepherd as
a cleaner canine foundation for Jack. The source uses the same 67-bone family
as the previously downloaded Quaternius animal pack, contains 11 genuine dog
actions, and costs no credits. Its native motion is substantially cleaner than
cross-rig procedural motion.

Two implementation paths were tested:

1. Strip the donor's post-apocalyptic accessories, recolor the dog white, add
   Jack's nose/collar/tag identity, and build the 28-clip semantic contract on
   the native rig. Deformation is clean, but the 2,892-triangle donor body and
   face are too generic and visibly lower-detail than the approved Meshy Jack.
2. Bind the approved 9,738-triangle Meshy Jack skin to the native 67-bone rig.
   The incompatible rest joints and vertex-weight topology cause severe leg
   collapse in walk, run, eating, jumping, and rest poses. This route fails the
   no-distorted-deformation requirement.

Consequently, V2.2 remains the beta integration package. The V3 files are not
runtime candidates and must not replace V2.2 without a manual Blender re-rig,
weight-paint pass, and a new visual/deformation approval.

The promising future route is a manual rig built inside the approved Meshy
mesh using the Quaternius skeleton hierarchy and native dog actions as timing
and motion sources. Automatic group renaming or proximity binding is not
sufficient.

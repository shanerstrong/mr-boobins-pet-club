# Mr. Boobins' Pet Club — 3D Pet Room Direction

Status: design proposal for Mark's approval; not a durable product decision and not production implementation.

Date: 2026-08-14

## 1. Visual-direction statement

**A tiny room with a big relationship.** Mr. Boobins' Pet Club becomes a fixed-camera miniature living room held inside an original virtual-pet-inspired frame. Chunky low-poly forms, softly beveled edges, and sparingly pixelated painted textures make the room tactile and nostalgic without imitating another game's assets or composition. Jack—not the controls—is the visual anchor. Care is expressed through the room: tap the bowl to feed, the toy to play, the bed to rest, the cleaning mat to clean, and Jack's unmistakably oversized nose to Boop. A compact labeled action strip remains available as a forgiving, always-visible equivalent path.

The device frame is a presentation metaphor, not a copy of a known shell. It never exposes camera, movement, or gamepad controls. The camera is fixed, slightly elevated, and perspective-limited so every meaningful object remains visible and Jack's face stays large enough to read.

### Design pillars

1. **Jack first:** the face, ears, muzzle, nose, eyes, and reactions carry the experience.
2. **Room as interface:** meaningful objects are direct controls; highlights teach rather than decorate.
3. **Keychain rhythm, dollhouse depth:** short care visits and deterministic state remain unchanged beneath a dimensional scene.
4. **One glance is enough:** needs, daypart, current reaction, and next action are readable without opening a menu.
5. **Two ways to succeed:** object taps and labeled controls have semantic parity.
6. **Original by construction:** original shell silhouette, room kit, Jack model, textures, icons, animation, and audio only.

## Source-of-truth and evidence

- Durable product constraints: `docs/PROJECT_BRIEF.md` and `docs/DECISIONS.md`.
- Accepted implementation context: `PLANS.md`.
- Current visual source of truth: `docs/V0.5_FIGMA_HANDOFF.md` and its linked Figma file.
- Completion evidence expectations: `docs/QUALITY_GATES.md`.
- Jack likeness: the four attached real photographs are primary. The attached coloring-book illustration is secondary silhouette and personality guidance only.
- Concept evidence: `evidence/3d-pet-room/`.
- The attached private references are not copied into the repository by this proposal. Mark must decide whether and where approved reference photos may become repository source material.

## 2. Baby Jack character sheet

![Baby Jack low-poly character sheet](../../evidence/3d-pet-room/jack-character-sheet.png)

### Turnaround

| View | Required read |
| --- | --- |
| Front | Ears form a tall open V; eyes are narrow, dark, and gentle; long muzzle terminates in the dominant broad nose; front paws are planted and slightly oversized. |
| Side | Forehead-to-muzzle wedge stays long; nose projects clearly; chest is deep but puppy-soft; back and legs remain lean; tail is tapered rather than blocky. |
| Three-quarter | Default hero view. Both eyes, both ears, nose volume, chest, collar, tag, and one tail gesture remain readable at room scale. |
| Rear | Upright ear silhouette, shoulder taper, haunches, and tail base are clean enough for turn and sleep states. |

### Proportions

- Standing height: approximately 2.7 head lengths.
- Head: approximately 36% of total standing height, including ears.
- Muzzle: approximately 48% of head depth; never shortened into a round puppy snout.
- Nose: approximately 42% of muzzle width in front view; intentionally the highest-recognition and Boop target feature.
- Chest: broad enough to read as shepherd-like; waist and legs stay lean.
- Paws: approximately 115% of anatomically neutral puppy scale to improve silhouette and friendliness.
- Tail: tapered, one visible bend at rest, enough arc for a readable wag without intersecting the body.

### Facial traits

- Tall upright triangular ears with warm pink interiors and minor asymmetry.
- Dark almond eyes with soft upper lids; avoid oversized round cartoon eyes.
- Long white wedge muzzle with a subtle cool-gray mouth/chin shadow.
- Broad dark mauve-charcoal nose with a restrained rose highlight, not pure black.
- Friendly open smile; pink tongue; small teeth only when needed by the pose.
- Short white coat suggested by faceted planes and a few painted value breaks, not modeled fur cards.
- Blue collar and original simple brass round tag remain continuity markers.

### Palette

| Role | Color | Use |
| --- | --- | --- |
| Fur light | `#F4F0E5` | Primary coat plane |
| Fur shade | `#D9DEE0` | Chin, chest, limb separation |
| Ear interior | `#D99B9C` | Inner ear only |
| Nose base | `#4A343B` | Broad nose volume |
| Nose highlight | `#7C555D` | Warm likeness cue |
| Eye | `#241F24` | Iris/pupil silhouette |
| Tongue | `#E78F9A` | Smile and feed reactions |
| Collar | `#3D78A8` | Persistent Jack identifier |
| Tag | `#D5A44D` | Small warm focal accent |

### Expression set

| Expression | Face and body cue |
| --- | --- |
| Content | Soft almond eyes, closed-mouth corner lift, neutral ears, slow tail sweep. |
| Friendly idle | Open smile, small tongue, one ear micro-tilt, weight shift. |
| Hungry/feed | Nose leads toward bowl, focused eyes, tongue flick, quick sit. |
| Sleepy | Heavy upper lids, ears relaxed outward, chin lowered, slower breathing. |
| Excited/play | Bright eyes, open smile, ears forward, forequarters lowered, tail high. |
| Boop surprise | Eyes widen briefly, nose compresses, tiny backward head recoil, then grin/hop if comfortable. |
| Dirty | Ears slightly outward, puzzled glance toward cleaning area, no shame framing. |
| Unwell/low need | Lower head and softened eyes; gentle call for care, never frightening. |

## 3. Fixed-camera room mockups

### Mobile — 390×844, Cozy / Morning

![Mobile Cozy Morning mockup](../../evidence/3d-pet-room/mobile-cozy-morning.png)

- Portrait composition uses a top status capsule, dominant room viewport, fixed message slot, and one shallow five-action strip.
- Jack's nose remains near the visual center and should receive a minimum effective 56×56 CSS-pixel hit area, independent of rendered nose size.
- Object targets extend beyond visible geometry to forgiving floor footprints.
- The concept image's lower decorative paw is optional shell ornament only and must not become a required or unlabeled control.

### Desktop — 1440×900, Blue / Dusk

![Desktop Blue Dusk mockup](../../evidence/3d-pet-room/desktop-blue-dusk.png)

- A narrow left instrument panel carries needs, time, theme, and utilities; the large room viewport stays visually dominant.
- The bottom action strip follows the room width and avoids a tall button column.
- Desktop object targets expose hover and keyboard focus, but never become mouse-only.
- Jack remains centered inside the movement oval; bowl, bed, toy, and cleaning area stay separated at this camera.

### Responsive rules

| Rule | 390×844 | 1440×900 |
| --- | --- | --- |
| Room share | 54–58% of height | 70–76% of usable width |
| HUD | One compact top capsule; overflow in More | Narrow left panel |
| Actions | Five equal targets, 48–56px high | Five 52–60px targets centered under stage |
| Message | Fixed-height overlay in upper empty wall | Fixed-height centered chip in upper stage |
| Scene crop | Full interactive floor footprint; trim shell ornament first | Full room plus restrained frame |
| Jack scale | Face/nose readable at arm's length | Full-body hero with nose still direct-tappable |

At intermediate widths, move the left panel above the room before shrinking the 3D stage below its minimum readable size. No horizontal scrolling is permitted.

## 4. Labeled scene layout

![Fixed-camera scene layout](../../evidence/3d-pet-room/scene-layout.png)

### Camera and stage specification

- Logical room footprint: 10.0 × 6.5 units; back walls at north and east edges.
- Camera: fixed perspective, approximately 32° downward pitch and 8° yaw; 28–32° field of view.
- Jack movement oval: centered at (5.1, 3.5), approximately 4.5 × 2.6 units.
- Jack never travels behind furniture or into an object target. Runtime locomotion is bounded to authored waypoints inside the oval.
- Camera, room, and interactive object transforms are invariant across themes and dayparts.
- Mobile may use a slightly narrower safe crop of the same camera rig; it must not reframe per action.

### Interactive objects and hit behavior

| ID | Object | Direct action | Forgiving target | State cue |
| --- | --- | --- | --- | --- |
| A | Food bowl | Feed | Mesh plus 24px projected padding and floor decal | Brief warm rim; filled/empty mesh state |
| B | Bed | Rest / Wake when sleeping | Entire cushion and front lip | Pillow breath glow; moon marker while resting |
| C | Toy | Play | Mesh plus projected 28px padding | One pulse when action is available |
| D | Cleaning mat | Clean | Full tiled footprint | Paw tile plus one cool rim pulse |
| E | Window | Daypart information | Window opening | Lighting changes only; no required action |
| F | Clock | Time/status details | Clock face plus 20px padding | Hands/digits follow virtual age |
| G | Jack's nose | Boop | Dedicated invisible 56×56 minimum target, clamped within head | Heart ripple; cooldown uses gentle settled state |

When direct-object and HUD targets overlap in projection, HUD wins. A rejected action never silently fails: the fixed message slot explains sleeping, dead, cooldown, or care-lock restrictions.

## 5. Compact HUD and controls

### Information hierarchy

1. Jack and current room reaction.
2. Critical or lowest need.
3. Four compact primary need summaries: Hunger, Happy, Clean, Energy.
4. Daypart and clock.
5. Core actions.
6. Theme, audio, settings, health, attention, discipline/training, and detailed status inside More until their broader milestone designs are approved.

Health and attention remain simulation data; hiding them from the primary capsule must not prevent inspection. More must expose an accessible status panel that includes every simulated need.

### Control behavior

- Five fixed action slots: Feed, Play, Clean, Rest/Wake, More.
- Each uses icon + visible label; minimum 44×44, recommended 52×52.
- Direct objects and strip actions call the same action identifiers and share disabled/cooldown rules.
- Default: 1px high-contrast outline and resting depth.
- Hover (desktop): 2px outline and 2% lift; no continuous motion.
- Focus-visible: 3px two-tone ring outside the hit area.
- Pressed: 2px depth compression and immediate semantic message.
- Disabled/rejected: preserve label contrast, reduce decorative saturation only, explain in message slot.
- Success: object rim, Jack reaction, message, and eligible SFX; never depend on color or sound alone.
- More opens a stable modal/sheet with individual focusable controls and no background interaction.

### Classic-control compatibility

The three-button scheme remains a parallel semantic input layer if retained: Left cycles focus among the same direct targets, Middle activates, Right backs/cancels. Focus order is Jack nose → bowl → toy → cleaning area → bed → clock/window → HUD/More. No 3D cursor or free movement is introduced.

## Theme concepts

| Theme | Materials and palette | Identity cue | Must remain invariant |
| --- | --- | --- | --- |
| Cozy | Cream plaster, honey wood, dusty coral bed, woven sand rug, sky-blue bowl | Warm family living room | Layout, hit areas, Jack contrast |
| Blue | Dusty navy upper walls, pale ash wood, denim rug, lavender bed, amber lamp | Quiet evening den | Layout, hit areas, Jack contrast |
| Garden | Sage paneled walls, terracotta details, leaf-pattern rug, pale oak, larger visible plants/window greenery | Indoor garden room, not an outdoor roaming level | Layout, hit areas, Jack contrast |

Themes are material and prop-variant sets on one scene graph. They do not move interactive objects or change simulation.

## Daypart lighting

| Daypart | Existing boundary | Lighting behavior |
| --- | --- | --- |
| Morning | 06:00–10:00 | Warm low sun from window, cool ambient fill, soft short lamp contribution. |
| Day | 10:00–17:00 | Neutral bright window key, reduced lamp, clear object silhouettes. |
| Dusk | 17:00–20:00 | Amber window band, cooler room ambient, lamps become readable pools. |
| Night | 20:00–06:00 | Deep blue ambient, warm practical lamps, window moon/stars abstraction; Jack remains above 4.5:1 against immediate background where text/essential edge reading applies. |

Lighting transitions follow virtual age and cross-fade material/light values without camera motion. Under reduced motion, use a short non-animated swap or OS-appropriate minimal cross-fade.

## 6. Animation and reaction inventory

| Existing state/action | Full-motion 3D treatment | Reduced-motion treatment | Audio/feedback rule |
| --- | --- | --- | --- |
| Idle | 2.4–3.4s breathing loop, rare blink, one ear micro-tilt, small weight shift; tail wag is a separate low-frequency additive loop | Static friendly pose; blink may be removed; no locomotion | Existing idle music only after gesture gate |
| Tail wag | 1.2s two-to-three sweep additive loop, hips counter by ≤2° | One held tail-raised silhouette for 600ms | No new required sound |
| Feed | Look to bowl → 1–2 authored steps → sit/lean → two bites → lick; target 1.8–2.4s visual reaction | Snap to feed pose, bowl changes filled→empty, expression changes | Existing feed effect; care mutation remains current action |
| Sleep | Turn/curl on bed, lower head, 3.2s breathing loop | Immediate lying pose; no bobbing | Sleep track priority after gesture gate |
| Wake | Head lift, ears rise, stretch, stand; 1.1–1.5s | Immediate awake pose plus message | Existing wake feedback |
| Play | Play bow → fixed three-second bounded zoom/turn with toy → settle | Full three-second semantic state with held play-bow/excited pose; no travel | Existing PLAY music/effect for exact 3000ms policy |
| Clean | Existing water → washout → shake → sparkle sequence over fixed 1500ms; care locked | Four still phase swaps across same 1500ms; no camera/object travel | Existing shower/effects; no control reflow |
| Boop—comfortable | Nose compress 80ms, head recoil 120ms, hop/grin, heart ripple | Nose highlight + surprise face + message; no hop | Existing bark/hop behavior only when comfortable |
| Boop—need response | Nose compress then glance/gesture toward highest-priority need object | Nose highlight then held directional expression | Hunger → energy → hygiene → happiness priority; no need mutation |
| Boop rejected | Tiny settled nose pulse only | Static focus/pressed state | Explain asleep/dead/cooldown; no false success sound |
| Dirty | Muted dust/smudge material variant, brief shake-off attempt | Material/state icon only | Never shame the player |
| Tired | Lower head, slower breath, heavy lids, glance to bed | Held tired pose | Message and status remain readable |
| Death | Gentle resting still pose; room light softens, no alarming collapse | Same still pose | Preserve existing frozen simulation and gentle framing |

All animation state changes are presentation-only views of existing simulation and interaction policy. They must not advance needs, growth, saves, or virtual time independently.

## Reduced motion and non-3D fallback

### Reduced motion

- Disable camera movement entirely (already invariant).
- Remove locomotion, hops, decorative pulses, parallax, and continuous object bobbing.
- Preserve every semantic duration and phase, including three-second PLAY and 1.5-second cleaning.
- Use pose swaps, material changes, fixed messages, and restrained ≤100ms opacity changes where allowed.
- Never use screen shake for Boop or cleaning.

### Non-3D fallback concept: **Dollhouse Cards**

Pre-render the same authored camera, room layout, Jack poses, themes, and dayparts into original 2D atlas layers. The fallback composes a room plate, object state layers, Jack pose frames, and HUD without WebGL. Hit regions use the same logical scene manifest and action IDs as 3D. It is not a separate game or save state.

Fallback triggers may include unavailable WebGL, failed model/texture load, low-memory recovery, user preference, or accessibility preference. The app announces the presentation change non-disruptively and preserves simulation, controls, audio preference, and save continuity.

If LCD mode remains a durable requirement, it is a separate supported fallback/presentation mode over the same simulation—not a post-processing filter over the 3D scene.

## 7. Original assets and proposed production pipeline

### Original-asset list

**Jack**

- Baby Jack base mesh, LOD1 mesh, collision/hit proxies.
- White-fur, ear, eye, nose, mouth/tongue, collar, and tag materials/textures.
- Facial blend shapes or compact bone controls: blink, lids, smile, tongue, nose compress, cheek/muzzle lift.
- Skeleton and clips: idle, wag, feed, sleep, wake, play, clean reaction, Boop variants, tired, dirty, death/rest.

**Room kit**

- Device-inspired outer frame and responsive inner mask.
- Floor, two walls, baseboard, window, clock, rug/movement zone.
- Bowl with filled/empty states; bed; toy; cleaning mat and cleaning props.
- Theme variants: Cozy, Blue, Garden materials and non-interactive prop accents.
- Daypart sky/window cards, lights, and baked ambient-occlusion data.

**UI and feedback**

- Need icons, action icons, theme icons, clock/daypart icons.
- Focus, pressed, cooldown, disabled, and object-rim states.
- Message chip, Boop heart ripple, cleaning phase effects, sleep indicators.
- 2D fallback room plates, Jack pose atlases, object layers, and manifest.

No concept-render pixels should ship automatically. Every production asset is re-authored and reviewed as an original project asset.

### Recommended pipeline

1. **Reference lock:** approve the character sheet and a private/repository policy for Jack photos.
2. **Blockout:** Blender LTS; lock meter scale, room coordinates, camera, object silhouettes, Jack proportions, and hit proxies.
3. **Model:** Blender low-poly meshes with beveled readable planes; preserve separate nose, eyes, mouth, collar, and tail controls.
4. **Texture:** Krita or Aseprite for original 64–256px hand-painted/pixel-adjacent textures; no sourced game textures.
5. **Rig/animate:** Blender armature and shape keys; root motion removed or converted to bounded authored waypoints.
6. **Export:** glTF/GLB 2.0, one scene manifest, texture atlases, animation clips named by existing semantic states.
7. **Optimize:** mesh LOD, texture atlasing, KTX2/Basis where renderer support is proven, static lighting/ambient occlusion baked where appropriate.
8. **Integrate prototype:** recommended web-first renderer is Three.js through React Three Fiber, isolated behind a presentation adapter so simulation and persistence are untouched. Native Expo support is a separate proof requirement before dependency approval.
9. **Fallback bake:** render the locked camera into original 2D layered atlases using the same Blender source and manifest.
10. **Validate:** visual regression captures, hit-target overlay capture, reduced-motion capture, fallback parity, performance/memory trace, and license/source ledger.

### Prototype budgets (proposal)

- Initial visible GLB payload: target ≤3.5 MB compressed; hard stop at 6 MB before approval.
- Jack: target 8k–14k triangles at hero LOD; one lower LOD for small rendering.
- Room plus interactives: target 35k–55k triangles.
- Texture memory: target ≤24 MB decoded on mobile for the first room.
- Draw calls: target ≤45 steady-state at mobile composition.
- Stable 30 fps minimum on the agreed low-end test device; target 60 fps on reference desktop/mobile.
- First meaningful room render: target ≤2.5s on reference broadband after app shell; loading/fallback behavior must be tested offline after assets are cached.

Budgets are acceptance targets for the bounded prototype, not durable decisions until measured against the selected renderer and devices.

## 8. Handoff — Build — 3D Pet Room Prototype

### Objective

Prove that the existing local Jack simulation and care loop can be presented as a clear, charming, accessible fixed-camera 3D dollhouse room at 390×844 and 1440×900 without changing save semantics, state timing, audio policy, or care outcomes.

### Scope

**In**

- One fixed living-room scene and one locked camera rig.
- Baby Jack only.
- Bowl, bed, toy, cleaning area, window, and clock.
- Idle, wag, feed, sleep, wake, PLAY, cleaning, and Boop presentation mapping.
- Cozy, Blue, and Garden material concepts on one layout.
- Morning, Day, Dusk, and Night lighting driven by existing virtual age.
- Compact HUD, action strip, direct object taps, nose Boop, keyboard/focus path.
- Reduced motion and Dollhouse Cards non-3D fallback proof.
- Responsive mobile and desktop compositions.
- Loading, error, and fallback presentation sufficient to prove resilience.

**Out**

- Camera control, free roaming, player avatar, physics gameplay, multiple rooms, additional pets, growth-stage model production beyond Baby, new simulation rules, save migration, cloud/network features, publishing, deployment, or replacement of the V0.5 Figma record.
- Production polish for every current state, store packaging, analytics, monetization, social features, or sourced third-party game art.

### Affected areas

- New isolated 3D presentation module and renderer adapter.
- New original asset directory and scene manifest.
- Presentation mapping from existing state/action selectors.
- Input mapping for object/nose hit regions and existing action IDs.
- Responsive room/HUD composition.
- Reduced-motion and non-3D presentation selection.
- New tests/evidence; no persistence schema or simulation mutation expected.
- Possible dependency and build-configuration changes require explicit approval before implementation.

### Acceptance criteria

1. At both 390×844 and 1440×900, the fixed camera shows Jack and all six required room objects without rotation, zoom, scrolling, or movement controls.
2. Jack matches the approved likeness sheet: upright ears, long wedge muzzle, broad mauve-charcoal nose, dark almond eyes, short white coat, lean baby shepherd body, sturdy paws, blue collar/tag, smile/tongue.
3. Bowl, toy, cleaning area, bed, and nose are direct-tappable with forgiving hit regions and call the same semantic actions as the labeled strip.
4. Every direct target is keyboard reachable on web with visible focus; strip controls are at least 44×44 and use icon + text.
5. Idle, wag, feed, sleep, wake, fixed 3000ms PLAY, fixed 1500ms four-phase cleaning, and all Boop priority/restriction paths present correct visual feedback without mutating needs beyond existing rules.
6. Cozy, Blue, and Garden use the same transforms/hit areas; Morning/Day/Dusk/Night follow the existing virtual-age boundaries.
7. Switching themes, dayparts, 3D/fallback presentation, control schemes, or reduced motion does not change pet state or save data.
8. Reduced motion removes travel/hop/pulse/camera effects while retaining semantic timing, messages, poses, and action outcome.
9. Non-3D fallback supports the same object/action manifest, Boop target, four lighting states, three themes, action strip, and save continuity.
10. Audio remains separate SFX/music, default-off, gesture-gated, mutually exclusive by existing policy, and immediately muteable.
11. Loading or renderer failure reaches the fallback with a readable non-alarming message; no care action is lost or duplicated.
12. Performance meets the agreed reference-device budget or stops for a product/technical decision.
13. All production assets have an original-source ledger; no protected characters, shells, interfaces, sounds, textures, or scene compositions are copied.
14. Existing deterministic simulation/persistence/audio/interaction tests and all applicable `docs/QUALITY_GATES.md` commands pass unchanged unless a separately approved plan updates them.
15. Visual evidence captures every required state at both target sizes, plus focus/hit overlays, reduced motion, fallback, theme/daypart matrix, and a persisted refresh.

### Constraints

- Keep Expo, React Native, TypeScript, current V6 save schema, care effects, growth, persistence, clock/daypart boundaries, audio behavior, room theme values, Boop priority, PLAY timing, cleaning timing, and starvation/death behavior intact.
- No camera controls, free roaming, physics-dependent care outcomes, autoplay audio, network requirement, photo upload, or child data collection.
- 3D code must be presentation-only and disposable behind an adapter; simulation remains pure and renderer-independent.
- Touch targets remain readable and forgiving; interaction cannot depend on depth perception, color, motion, or audio alone.
- Preserve unmanaged and locally modified files; implementation must start from a reconciled clean scope.

### Verification

Run every exact applicable command in `docs/QUALITY_GATES.md` after implementation:

- `git diff --check`
- Project Kit JSON parse gate
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run export:web`
- `npm run smoke`
- `npm run check:deps`

Add bounded prototype checks before claiming completion:

- Renderer-adapter tests proving state mapping and no simulation writes.
- Hit-manifest tests proving target/action parity and non-overlap at both viewports.
- Reduced-motion tests for 3000ms PLAY and 1500ms cleaning semantics.
- Renderer failure and manual fallback tests.
- Asset-budget script or report for GLB size, triangles, textures, and draw calls.
- Visual QA matrix: 3 themes × 4 dayparts at representative size; all requested action states at both sizes; keyboard focus; hit overlays; reduced motion; fallback; reload continuity.
- Performance trace on the approved low-end device and reference desktop.

### Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| 3D renderer expands Expo/web dependency and bundle risk | Approve renderer after a throwaway proof; isolate adapter; keep fallback first-class. |
| Jack loses likeness at low polygon count | Lock character sheet, silhouette tests, nose/muzzle measurements, and Mark review before rigging. |
| Object taps are missed or occluded | Fixed camera, authored target proxies, projected padding, hit-overlay QA, action-strip parity. |
| Device frame drifts toward protected trade dress | Original silhouette study and legal/IP review before public release; no copied button count/layout or shell details. |
| Low-end device heat/memory/fps | Budgets, baked lighting, atlases, LOD, fallback, stop on unmet target. |
| 3D conflicts with LCD/pixel promise | Treat 3D as proposed additional/successor presentation only until Mark approves a durable decision. |
| Private Jack photos become repository/public artifacts | Do not copy or publish references without explicit privacy/source policy. |
| Theme variants reduce contrast | Theme/daypart matrix review with contrast and silhouette overlays. |
| Animation changes semantic timing | State-driven clips with tests against existing interaction/audio policies. |

### Stop conditions

Stop and return for a decision if any of the following occurs:

- Renderer or native Expo support requires an unapproved dependency/build change.
- A persistence, simulation, care, clock, Boop, audio, growth, or save-schema change appears necessary.
- Jack likeness cannot pass Mark review within the agreed revision bound.
- Any direct target is repeatedly occluded or misses the 44px/56px target requirements at a target viewport.
- The prototype exceeds the hard payload/memory/performance limit after one bounded optimization round.
- Required behavior depends on camera movement, physics, network access, or private reference publication.
- A protected-expression concern cannot be resolved by an original redesign.
- Existing locally modified files overlap the implementation scope without reconciliation.
- Quality gates regress or scope expands beyond the one-room Baby Jack prototype.
- Publishing, deployment, Git mutation, credentials, or external-system writes become necessary.

### Unresolved decisions requiring Mark

1. Is 3D an additional presentation, the new default while LCD/pixel remain available, or an approved replacement for the full-color retro-pixel presentation?
2. Does classic three-button control remain required in the 3D prototype, or is semantic compatibility sufficient until the broader milestone?
3. May approved Jack reference photos be copied into a private repository path, and what publication/privacy rules apply to derivatives?
4. Approve the character sheet's baby proportions, collar/tag design, and nose color before production modeling.
5. Approve a web-first Three.js/React Three Fiber proof and any dependencies; decide whether native Expo renderer parity is required in this bounded build.
6. Name the reference desktop, phone, and low-end test device for performance acceptance.
7. Decide whether the device-inspired outer frame is retained on desktop, minimized, or removed in favor of a simple viewport surround.
8. Decide whether the generated concept images are approved references, revision inputs, or rejected exploration; they are not production assets by default.

## Decision conflicts and approval gates

| Proposal | Existing durable decision | Status |
| --- | --- | --- |
| Replace flat color-pixel room with fixed-camera 3D | Both LCD-inspired monochrome and full-color retro-pixel presentations are required over one state. | **Conflict: Mark approval required.** Recommended resolution: add 3D as proposed default/successor while retaining LCD/pixel or formally amend the decision. |
| New 3D design record | V0.5 Figma is the current visual source of truth. | **Conflict: Mark approval required.** This document is additive proposal evidence only; do not overwrite V0.5. |
| Compact five-action strip plus direct objects | Classic three-button and direct touch controls both require core-loop parity. | **Potential conflict.** Preserve semantic focus/activate mapping or explicitly defer three-button UI for the bounded build. |
| Upright-eared likeness | V0.6 describes provisional Jack as floppy-eared. | **Superseding likeness proposal.** The newly supplied real photos support upright ears, but the durable character decision should be amended only after approval. |
| 3D renderer dependencies | Expo/React Native/TypeScript is durable; no 3D renderer is approved. | **Approval gate.** Run a dependency/Expo compatibility proof before altering production configuration. |

Everything else in this proposal preserves the durable simulation, V6 persistence, room themes, dayparts, audio gate and priority, Boop rules, PLAY duration, cleaning sequence, save continuity, and child-friendly constraints.

## Concept-generation record

Built-in image generation was used in project-bound mode with the five supplied images as references. Photos 2–5 were specified as primary likeness references; Photo 1 was specified as secondary silhouette/personality guidance only.

- `jack-character-sheet.png`: stylized-concept prompt for a consistent low-poly Baby Jack turnaround and expression row with locked likeness traits, palette, proportions, and original-design exclusions.
- `mobile-cozy-morning.png`: ui-mockup prompt for a 390×844 fixed-camera Cozy/Morning dollhouse, compact top HUD, direct room targets, and five-action strip.
- `desktop-blue-dusk.png`: ui-mockup prompt for a 1440×900 Blue/Dusk layout with narrow needs panel, dominant stage, direct room targets, and shallow action strip.

The complete normalized prompt constraints are represented by the character, room, HUD, theme, interaction, accessibility, and originality specifications in this document. The generated boards are concept references, not export-ready UI, text, or production textures.

# AI-assisted production toolchain

Verified: 2026-08-16. Recheck prices, licenses, beta status, data terms, and platform requirements before purchase or commercial release.

## Decision

Do not copy an AAA studio's entire software stack. Use the smallest professional pipeline that preserves editable source files and lets AI remove blank-page, repetitive, and capture work. Keep the current Mr. Boobins engine; changing engines now would discard verified code and introduce months of migration risk.

Ratings do not select an engine. The comparison in `docs/production/COMPETITOR_RATING_BENCHMARK.md` shows simple and technically complex virtual-pet products occupying similar rating bands. Tool choices are considered evidence only when an official engineering source, job listing, credits, or shipped artifact identifies them; unknown stacks stay unknown.

## Adopt now

| Work | Professional source of truth | AI acceleration | Decision |
| --- | --- | --- | --- |
| Production management | Repository documents, Codex Project Kit, curated Google Drive mirror | Codex planning, bounded workers, read-only scheduled summaries | Adopt. No OpenAI API or extra task platform now. |
| Game/app code | Expo, React Native, TypeScript, tests, static export | Codex for implementation, review, debugging, and deterministic verification | Keep. It matches the current lightweight offline product and preserves the working build. |
| UI and interaction | Figma design system plus coded components | Figma agent/Make and MCP for editable design-to-code context | Keep Figma; use AI for exploration and handoff, not as the sole design record. Figma documents its agent, Make, Dev Mode, Code Connect, and MCP workflows: <https://help.figma.com/hc/en-us/articles/24039793359767-Get-started-with-Figma-AI> and <https://www.figma.com/dev-mode/>. |
| 3D characters and props | Blender `.blend` source, validated rigs, textures, GLB runtime exports | Meshy image/text-to-3D, texturing, rigging, and draft animation | Adopt Meshy → Blender → runtime. Meshy itself describes production use as drafting followed by dedicated-tool refinement: <https://www.meshy.ai/use-cases>. Blender remains free and open source: <https://www.blender.org/>. |
| Versioning | Git for code and text; Git LFS for approved large binaries after baseline review | Automated inventory and size/manifest checks | Prepare Git LFS, but do not migrate the current 454 MB asset tree until the exact baseline and remote storage budget are approved. LFS stores pointers in Git and large content remotely; tracking rules do not retroactively convert history: <https://git-lfs.com/>. |
| Review | Local renders/builds and repository evidence | Codex comparison and concise Drive mirrors | Adopt. Keep private references and editable source out of the review mirror by default. |
| External storage | Google Drive: one curated phone-review mirror and a separately restricted preservation root | Drive connector for approved folder/file operations and readback verification | Google Drive only for this project. Do not use iCloud or make either Drive location the development source of truth. |

## Storage-provider selection

For cross-platform, public-facing, collaborative, or automated projects, warn before switching to iCloud. Compare Android and non-Apple access, collaborator universality, public/review workflows, connector or automation support, quota/cost verification, privacy, and whether the switch creates a second source of truth. iCloud is not universally unsuitable—it can be a practical Apple-only personal backup—but it is a poor fit for this project's Android/cross-platform audience and available Codex workflow. Mark's project-specific decision is stronger: use Google Drive only unless he explicitly changes it after reviewing those tradeoffs.

Keep these Google Drive roles separate:

- the existing `apps/Mr. Boobins' Pet Club` folder is a curated phone-review mirror;
- `Mr. Boobins' Pet Club — Preservation` is a restricted cold-archive/private-backup root; and
- the repository remains the development source of truth.

## Add only when a milestone needs it

| Tool | Best use | Current cost/license signal | Trigger |
| --- | --- | --- | --- |
| Cascadeur | Physics-aware pose/animation cleanup, retargeting, and quadruped autoposing | Free is non-commercial and cannot export common interchange formats; Indie is listed at $8/month annual for revenue under $100k; Pro is $33/month annual and includes quadruped autoposing and unrestricted commercial use. <https://cascadeur.com/plans> | Trial after one approved Jack rig still needs material manual animation cleanup. Buy for a bounded animation batch, not permanently by default. |
| Adobe Substance 3D Sampler/Painter | High-volume PBR material and texture production | Sampler currently offers Firefly-powered text/image-to-texture beta workflows that can feed editable materials. <https://experienceleague.adobe.com/en/docs/substance-3d-sampler/using/features-and-workflows/generative-workflows> | Add when room/skin expansion texture volume becomes the bottleneck. |
| Rokoko Vision | Video-to-motion for a human avatar, with editing/retargeting in Rokoko Studio and FBX/BVH export | Free includes 30 seconds/month; Basic is listed at $10/month billed annually or $12 monthly with 600 seconds/month and custom-character retargeting. <https://www.rokoko.com/products/vision> | First choice to test Mark's recorded exercise motion for guide screenshots. Validate feet, joints, contacts, and exercise form manually. |
| DeepMotion Animate 3D | Alternative human markerless capture with body/face/hand options and custom FBX/GLB characters | Freemium is non-commercial; paid annual plans currently begin at $9/month, and commercial licensing depends on plan. <https://www.deepmotion.com/pricing-animate3d> | Compare one representative exercise against Rokoko before purchasing either production plan. Keep the cleaner result, not both subscriptions. |
| BioDigital or Visible Body | Authoritative anatomy reference and potentially licensed educational visualization | BioDigital offers professional anatomy content and business/school plans; Visible Body provides large 3D anatomy libraries and license-specific course-material permissions. <https://pricing.biodigital.com/> and <https://www.visiblebody.com/practitioners> | Use before rebuilding muscle illustrations. Confirm written commercial/publication rights before exporting or tracing screenshots. |

## Future-project options, not Mr. Boobins migrations

- **Unity 6 + Unity AI:** evaluate for a future editor-heavy 3D game. Unity AI is currently an open beta requiring Unity 6+, and includes an in-editor assistant, AI Gateway, and official MCP server. Unity states the MCP server is free and third-party subscriptions can be connected without Unity credits. This is not a reason to migrate the existing Expo game. <https://unity.com/features/ai>
- **Unreal Engine + MetaHuman:** evaluate for photoreal human characters, cinematics, or high-fidelity face/body capture. MetaHuman Animator supports video/audio/depth performance capture, but the Unreal pipeline is unnecessary for the current stylized pet game or ordinary guide figures. <https://dev.epicgames.com/documentation/metahuman/metahuman-animator-in-unreal-engine>
- **Perforce, Jira/Linear, Wwise/FMOD, Houdini, Maya, ZBrush, enterprise asset managers:** standard in larger specialist teams, but their administration, licensing, and migration overhead currently exceed our needs. Revisit only with multiple human contributors, heavy binary locking, complex audio behavior, procedural world generation, or recurring release operations.

## Shaner Strong guide workflow

The efficient replacement for wonky generated exercise and muscle art is:

1. Select the exact muscle/action from a licensed anatomy reference.
2. Build or license one anatomically reviewed neutral 3D body; create a separate consented stylized Mark avatar for branded exercise demonstrations.
3. Record the real exercise from clear front/side angles.
4. Test the same short clip in Rokoko Vision and DeepMotion; retarget the cleaner motion to the avatar.
5. Correct joint limits, foot contact, equipment contact, posture, and camera in Blender or Cascadeur.
6. Render consistent transparent or studio-background views.
7. Add muscle color, arrows, labels, and callouts as editable vector layers in Figma/Illustrator/Canva from the verified anatomy map.
8. Have a qualified reviewer approve anatomy and exercise form before the image enters a guide.

This produces a repeatable owned visual system without asking an image generator to invent identity, anatomy, equipment contact, or exercise technique in every frame.

## Spending rules

- Test one representative asset or exercise through the complete pipeline before subscribing.
- Never keep two overlapping paid tools after the comparison period.
- Use free plans only when their license permits the intended review or commercial use; preserve attribution when required.
- Subscribe for a named batch with a completion target, then reevaluate monthly.
- Record every shipped generated asset's tool, plan/license, input provenance, editable source, and human approval.

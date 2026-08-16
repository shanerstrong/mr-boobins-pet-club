# Mobile pet-room UI verification

Date: 2026-08-15

## Outcome

The 390×844 mobile living room now follows the approved Cozy/Morning device mockup: a warm cream shell, compact needs header, fixed framed room, direct room-object targets, short feedback panel, five-action strip, Boop prompt, and decorative paw. The existing simulation, persistence, audio, growth, care, sleep, death, and reset behaviors remain behind the presentation.

`src/pet-room-scene.tsx` is the stable scene boundary. It currently renders the code-native fallback and can be replaced internally by the separately produced Jack/room renderer without changing simulation-facing props or the semantic actions for Jack's nose, bowl, toy, cleaning mat, and bed.

## Responsive evidence

- `mobile-390x844.png`: exact 390×844 viewport.
- `desktop-1440x900.png`: exact 1440×900 regression viewport.
- The mobile room stage is 390 px tall.
- Primary action buttons measured 66×81 px.
- Direct room targets measured between 58×74 px high; the bed target is 128×76 px.
- The Feed control raised hunger to 100%, confirming the new presentation still drives the existing simulation.

## Deterministic gates

All commands exited 0:

- `git diff --check`
- Project Kit JSON parse command from `docs/QUALITY_GATES.md`
- `npm run lint`
- `npm run typecheck`
- `npm test` — 4 files, 42 tests passed
- `npm run export:web`
- `npm run smoke`
- `npm run check:deps`

The dependency gate found no critical production advisory and therefore passed. It reported 14 high and 7 moderate transitive Expo/Metro advisories. npm's proposed forced remediation would install a breaking Expo version, so dependencies were not changed.

## Google Drive review mirrors

- Mobile: https://drive.google.com/file/d/1l0Cs_VGSfzRAruk1OZLSsNVt1yUmu879/view?usp=drivesdk
- Desktop: https://drive.google.com/file/d/1wqLtvzdMx-do6zjCudoxOy-5m9tCxCbD/view?usp=drivesdk

The repository remains the source of truth. Google Drive copies are review mirrors.

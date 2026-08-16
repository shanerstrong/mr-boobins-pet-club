# Baby Day 1 slice verification — 2026-08-15

## Scope verified

- Context-aware first-adoption versus returning-player hub.
- Persisted first-care guidance and a returning-condition summary that follows live pet state.
- 3D Boop restricted to the authored nose target.
- GLB request deferred until the room is entered.
- Sleep-modal background isolation, automatic initial focus, and keyboard focus visibility.
- Mobile 390×844 and desktop 1440×900 layout after the changes.
- Required static-export runtime assets.

## Deterministic gates

| Command | Exit | Evidence |
| --- | ---: | --- |
| `git diff --check` | 0 | No whitespace errors; existing LF→CRLF working-copy warnings only. |
| Project Kit JSON parse command from `docs/QUALITY_GATES.md` | 0 | Both JSON documents parsed. |
| `npm run lint` | 0 | Zero warnings/errors. |
| `npm run typecheck` | 0 | TypeScript completed with no errors. |
| `npm test` | 0 | 8 files, 85 tests passed. |
| `npm run export:web` | 0 | Three static routes; web entry 6.3 MB; vision bundle 141 KB. |
| `npm run smoke` | 0 | Non-empty regular `index.html`, one non-empty web entry, and 10 non-empty correctly typed runtime assets referenced by the bundle. |
| `npm run check:deps` | 0 | No critical production advisory. npm reports 16 high and 7 moderate transitive Expo/Metro advisories; the suggested full fix is breaking and was not applied. |

The first dependency-audit attempt could not reach the registry/write its normal cache in the sandbox. The required command was rerun with approved registry/cache access and then passed its configured critical threshold.

## Rendered browser checks

Fresh origin at 390×844:

- Title asset inventory observed **0 GLB requests**.
- Hub exposed one `ADOPT JACK` action and a non-interactive `COMING LATER` card.
- Entering the room observed exactly **1 GLB request** and showed the complete first-care hint.
- Clicking Jack's torso preserved the guidance message and did not Boop.
- Activating `Boop Jack's nose` produced the expected Boop message.
- Opening the sleep dialog produced one modal, one inert/ARIA-hidden background, and zero background `Feed` buttons in the named accessibility tree.
- Opening the sleep dialog placed focus directly on `1 HOUR`; keyboard focus produced a visible high-contrast ring.
- Choosing Rest kept sleeping guidance ahead of the first-care hint, so disabled care actions were not recommended.
- Adopt → reload → visit preserved the first-care hint; completing care → reload cleared it.
- Reload preserved the adoption and showed `WELCOME BACK` with one `VISIT JACK` action.
- The final returning-player run produced no browser console warning or error.

Desktop at 1440×900:

- Room, 3D Jack, meters, message, all six direct actions, settings, and footer remained visible without horizontal overflow.

## Captures

- `adoption-hub-390x844.jpg`
- `guided-care-room-390x844.jpg`
- `sleep-dialog-keyboard-390x844.jpg`
- `returning-hub-390x844.jpg`
- `room-desktop-1440x900.jpg`

## Deliberately not claimed

- The player-time/offline-decay/permanent-death policy is not changed. The current 12× default remains a critical product risk pending Mark's explicit decision.
- Health, attention, medicine/status, LCD presentation, and classic-control parity remain outside this bounded slice and the original first reviewable milestone is still incomplete.
- The full legacy V0.8 visual-state matrix was not recaptured because this slice did not change its simulation, care effects, training reducer, audio policy, or save schema. Existing deterministic tests and representative room/modal checks were rerun instead.
- No commit, push, PR, publication, deployment, or bounded audit was performed.

# Decisions

Record durable decisions that future work must preserve.

| Date | Decision | Why | Alternatives rejected | Consequences |
| --- | --- | --- | --- | --- |
| 2026-08-14 | Use **Mr. Boobins' Pet Club** as the working product name. | It preserves Jack's real family nickname and clearly supports multiple pets. | Generic or coined public names without the personal connection. | Recheck marketplace and trademark status before a public filing or release; the name itself is not a copyright claim. |
| 2026-08-14 | Jack is the first playable pet, but the simulation and content model must support additional pets. | The game begins as a personal gift while retaining room to grow. | Hard-coding the entire game around one dog. | Pet-specific content must be data-driven behind shared care systems. |
| 2026-08-14 | Provide LCD-inspired monochrome and full-color retro pixel presentations over one pet state. | Both nostalgic and accessible modern presentations are desired. | Separate games or separate save states. | Presentation switching cannot alter simulation state. |
| 2026-08-14 | Provide classic three-button and direct touch controls. | Experienced players can use the nostalgic interaction while children can use clearer controls. | Only reproducing the old control scheme. | Every core care action needs parity across both control modes. |
| 2026-08-14 | Make **Boop the Snoot** a signature interaction. | Touching a pet's nose should create a funny, memorable response. | Treating pet touch as decorative only. | Nose hit-testing, feedback, animation, and sound/mute behavior are acceptance criteria. |
| 2026-08-14 | Build an original virtual-pet expression rather than a one-to-one Tamagotchi reproduction. | Care-game ideas and methods may be reused, but protected artwork, text, code, and audiovisual expression must not be copied. | Matching the branded product's exact presentation. | All UI, characters, assets, wording, sounds, and overall presentation require an original source of truth. |
| 2026-08-14 | Use Expo, React Native, and TypeScript for the V0 browser demo. | One codebase provides a responsive web demo now while retaining a realistic future mobile path. | A web-only framework or native packaging first. | Web ships through `expo export --platform web`; native packaging is not part of V0. |
| 2026-08-14 | Store V0 state through AsyncStorage behind a small `StorageLike` interface. | It uses browser-local storage now and can carry forward to React Native without coupling the simulation to a platform API. | Cloud sync, browser-only direct storage, or an account. | Save data is local-only, versioned, validated on load, and does not leave the device. |
| 2026-08-14 | V0 is the color, direct-control pet-room slice. | It proves the core care loop quickly without presenting an incomplete version as the full milestone. | Expanding V0 to LCD, classic controls, audio, Boop the Snoot, health, or multiple pets. | Those documented broader-milestone requirements remain deferred; V0 must not claim parity with them. |
| 2026-08-14 | Treat the first code-native Jack sprite as provisional. | No approved Jack reference art is present in the repository. | Inferring a likeness from absent references or copying any known pet art. | The demo labels the sprite provisional and needs a future approved reference before a likeness pass. |
| 2026-08-14 | Make the GitHub Pages base URL an environment-configured build value. | The repository name and deployment location are not known yet. | Hard-coding an assumed repository slug. | Use `EXPO_PUBLIC_BASE_URL=/repository-name/` when exporting for a project Pages site; the default `/` serves local/root hosting. |

Do not use this file for temporary task notes or speculative ideas.

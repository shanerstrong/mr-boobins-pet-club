# Jack desktop master-source preservation

The private Meshy workspace retains one textured high-detail master for each age. These are immutable source assets for future desktop LOD derivation, not runtime files and not substitutes for the verified mobile exports.

Observed on 2026-08-15:

| Age | Private Meshy search label | Master triangles | Master vertices | Local bytes |
| --- | --- | ---: | ---: | --- |
| Baby | `Jack Baby` | 1,937,286 | 1,012,952 | Pending acquisition |
| Teen | `Jack Teen` | 1,968,156 | 1,018,724 | Pending acquisition |
| Adult | `Jack Adult` | 1,954,788 | 1,010,234 | Pending acquisition |

The high-detail masters remain saved in Mark's private Meshy workspace. Meshy's download dialog was exercised without regeneration or credit use, but the in-app browser did not materialize the downloaded bytes. No API key or paid API call was used.

When acquisition becomes available, preserve the untouched files at these stable paths:

- `jack-baby-meshy-high.glb`
- `jack-teen-meshy-high.glb`
- `jack-adult-meshy-high.glb`

Desktop runtime meshes must be derived copies, normally reduced to at most 60,000 triangles and stopped at 100,000 without measured justification. They must bind to the same skeleton, morphs, anchors, material roles, and shared clips as mobile. Never overwrite the master files with a reduced export.

# Quaternius Ultimate Animated Animal Pack — canine donor subset

Downloaded 2026-08-15 from the creator's official public Google Drive folder:

- Pack page: https://quaternius.com/packs/ultimateanimatedanimals.html
- Official folder: https://drive.google.com/drive/folders/1uJ3N5HfB7jKTseJUNQr3N4YaN0UuEtHk
- License: CC0 1.0 Universal; see `License.txt`

These untouched files are animation donors and visual references only. They are
not Jack runtime exports. Any promoted Jack animation must be retargeted to the
canonical 27-bone Jack V2 skeleton, stripped of gameplay root motion, repaired
for paw contact and silhouette, and pass the complete deformation/runtime
validation suite before replacing an existing clip.

## Preserved files

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `License.txt` | 364 | `83d8959f9fc56353ed571fbe2dc52e4bcd64508e2399501cd45ac2ce3df0bf8c` |
| `Husky.blend` | 2,509,344 | `c3214271cbce42ecf0f2abf1bf9b66c3a2ddb36ba9d5d02293583320502b40db` |
| `Wolf.blend` | 2,571,200 | `fe31c3829dd2a8b9dfedb2e5cb656939a1d525ebd535a62434d2d25a4399cb9e` |
| `ShibaInu.blend` | 2,366,516 | `2da1c35ed46f532b8a7f1d7e92a4efc016cefb50e8c794e2969a048b16c5c44d` |
| `Preview.mp4` | 18,458,498 | `e24f6459023722e38652b1d7946e1fd5343bd62d12d374b41f92cf2458086655` |

## Blender inspection

All three sources open successfully in Blender 4.5.12 at 30 fps. Husky uses a
49-bone armature, Wolf 51 bones, and Shiba Inu 46 bones. Each provides the same
12-action vocabulary:

- `Attack`
- `Death`
- `Eating`
- `Gallop`
- `Gallop_Jump`
- `Idle`
- `Idle_2`
- `Idle_2_HeadLow`
- `Idle_HitReact_Left`
- `Idle_HitReact_Right`
- `Jump_ToIdle`
- `Walk`

Inspection reports are stored under `evidence/3d-jack/v2/`. No action has yet
been applied to Jack, and none of these third-party meshes will ship in the
game.

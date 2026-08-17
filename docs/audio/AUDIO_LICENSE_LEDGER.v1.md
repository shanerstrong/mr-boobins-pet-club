# Audio package V1 license and production ledger

Status: **30 versioned master candidates are locally bundled and wired into offline playback; deterministic audio QA passes; Mark's audible acceptance remains pending**.

This ledger is the human-readable companion to `assets/audio/v1/audio-manifest.v1.json`. The manifest records every planned asset, exact generation prompt or synthesis brief, tool plan, edit plan, output path, and current commercial-license status. Existing unversioned WAV files remain preserved as provisional development assets and are not V1 release sources.

## Production controls

- Generate no asset on a free plan. A later paid subscription does not retroactively license free-plan output.
- Recheck and record the provider terms, plan, model/service beta status, and commercial permissions on the exact generation date.
- Do not use named artists, song titles, copyrighted lyrics, franchise music, cloned voices, child voices, private recordings, or uploaded audio references.
- Use text prompts only. Keep credentials, invoices, private account data, and secrets out of the repository.
- Preserve source downloads separately from edited runtime WAVs. Record SHA-256 hashes for both.
- Record every mastering operation: trim points, fades, loop crossfade, resampling, channel conversion, loudness normalization, and export settings.
- A release row becomes `ready` only after commercial-rights evidence, source/final hashes, audible review, and automated audio QA all pass.
- Run `npm run check:audio` after every source or master change. It verifies local hashes and WAV structure now, and enforces final 48 kHz/channel/true-peak/click-free evidence when a manifest row becomes `ready`.

## Tool and rights plan

| Tool | Intended assets | Planned plan | Generation-date evidence required |
| --- | --- | --- | --- |
| ElevenLabs | Jack sounds, foley, treat effects, success and celebration accents | Starter paid month | Paid non-beta commercial license; service-specific terms; plan receipt retained privately |
| Suno | Cozy, play/training, and sleep music | Pro paid month | Track generated while Pro is active; game-use commercial rights; generation ID/date |
| Jfxr + jsfxr 1.4.1 | Command-selected and soft UI tones | Open web editor and local Unlicense renderer | Parameter script; Jfxr statement that generated sounds belong to the creator; jsfxr Unlicense |
| Audacity | Trimming, fades, loudness, loop construction, PCM export | GPL desktop editor | Application version and edit log; source rights remain those of the generated asset |
| FFmpeg 9.0 full build | Deterministic Suno decoding, loop construction, EBU R128 measurement, two-pass normalization, dithering, and PCM export | Free local GPL-3.0 portable package | Exact version, selected source/window, chronological edit log, final hash, true peak, LUFS-I, and seam QA |

Official rights were rechecked on 2026-08-15: [Jfxr commercial-use FAQ](https://github.com/ttencate/jfxr#can-i-use-these-sounds-commercially) and [jsfxr Unlicense](https://github.com/chr15m/jsfxr/blob/master/UNLICENSE). Jfxr requires no attribution for created sounds; attribution remains appreciated. The renderer tarball SHA-256 is `BAE7F2AFE8E13D5E4C0662A2AA0629D41544D641E824127ED5E25BE86C4FF4F8`.

Suno commercial rights were rechecked on 2026-08-15 against its [commercial-use guidance](https://help.suno.com/en/articles/9601665) and [ownership guidance](https://help.suno.com/en/articles/2416769). The exact account showed an active monthly Pro Plan, next billing on 2026-09-15, before generation. Suno states that songs made while subscribed to a paid plan may be used commercially, including in video games, and retain those commercial-use rights after cancellation; copyright protection is not guaranteed.

ElevenLabs commercial rights were rechecked on 2026-08-16 against its [commercial-use guidance](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform), [post-subscription guidance](https://elevenlabs.io/docs/help-center/account/general/what-happens-to-my-content-after-my-subscription-ends), [billing guidance](https://elevenlabs.io/docs/overview/administration/billing), [Sound Effects Terms](https://elevenlabs.io/sound-effects-terms), and [Prohibited Use Policy](https://elevenlabs.io/use-policy). The exact account showed an active Starter plan and a 2026-09-15 renewal before generation. All release candidates were generated on the paid plan with Explore sharing disabled and automatic prompt improvement disabled. The planned use is locally bundled app playback, not standalone resale or distribution of sound-effects output.

## Generated open-tool source assets

Generated 2026-08-15 at approximately 20:56 America/New_York from `scripts/generate-audio-ui-v1.cjs`. These are locally bundled source candidates. They remain `source-generated` until final package resampling, audible review, and integrated loudness QA.

| Asset | Source format and QA | SHA-256 |
| --- | --- | --- |
| `ui-command-selected.v1.wav` | 44.1 kHz mono PCM16; 158 ms; -11.11 dBFS peak; -17.84 dBFS RMS; final sample 0 | `E5F8A9786AB40323ED9D09546E9B59474AC3B53719B684700E0636BA40626FCC` |
| `ui-tap.v1.wav` | 44.1 kHz mono PCM16; 75 ms; -12.39 dBFS peak; -18.47 dBFS RMS; final sample 0 | `71FABBA6D6914A5D3AFC2B6884A52F6A12E61AF67E058280A2D0208B2F78E3A2` |
| `ui-open.v1.wav` | 44.1 kHz mono PCM16; 229 ms; -11.72 dBFS peak; -18.30 dBFS RMS; final sample 0 | `D80E247F1460F2A0E9F6ECBAD3FC582B5B1900339803AE9C069EF5D812F5427A` |
| `ui-close.v1.wav` | 44.1 kHz mono PCM16; 214 ms; -11.90 dBFS peak; -18.39 dBFS RMS; final sample 0 | `84570DFE6E830A2BF519541950BDE5B3B8BEA04DBA22F1BA14E710CB46E7DA68` |
| `ui-confirm.v1.wav` | 44.1 kHz mono PCM16; 289 ms; -11.11 dBFS peak; -17.78 dBFS RMS; final sample 0 | `FB171C3887C2FE79739C6C41A2DAEE650C7400B1E2AB67F91841D6F0F430224B` |

## Generated Suno Pro source candidates

Generated 2026-08-15 with Suno v5.5 and the Instrumental setting enabled. Three batches used 30 credits total from an observed 3,050-credit balance. These MP3 downloads remain preserved as immutable source candidates. On 2026-08-16, the reproducible `scripts/master-audio-music-v1.mjs` workflow used the locally installed FFmpeg 9.0 full build to select stable bar-aligned passages, remove DC, construct 250 ms equal-power seams, apply two-pass EBU R128 normalization, dither, and export 48 kHz stereo PCM16 WAVs. FFmpeg was obtained through the hash-verified portable Winget package linked from the [official FFmpeg download page](https://ffmpeg.org/download.html); its [GPL licensing terms](https://ffmpeg.org/legal.html) govern the tool, while the Suno source rights remain recorded separately above.

| Intended loop | Candidate | Generation ID | Source QA | SHA-256 |
| --- | --- | --- | --- | --- |
| Cozy pet room | `Pawprint Room` A | `1fc464da-4f48-4f90-ba20-19e8af161dec` | 1:50; 187 kbps MP3 | `06958AE88D732D7CFE03650F49994CAE2EF98BE0EE096F973B9EC542FA674047` |
| Cozy pet room | `Pawprint Room` B | `937ceab3-21ad-4a5b-861e-4ba7971694bf` | 1:37; 185 kbps MP3 | `3FF75148F6EE75AB26AC4DAD54F9E43FDF1D12DB2A0320A30330B2D70EF8EE9B` |
| Play/training | `Treat Time Loop` A | `e5b46055-34fa-47e7-bfd2-72867ea33dc3` | 0:42; 186 kbps MP3 | `3C88C3FD0A57C6218667ADE36A7D2377A55DDE6FB199062B6FF806ACC9CC27B8` |
| Play/training | `Treat Time Loop` B | `511ca7b3-b9e1-437f-b9bd-b8374e418813` | 0:51; 197 kbps MP3 | `ABF2270568E010CA95466DF201F170638CE65760D6C626B9263D0CC9EE4880E5` |
| Gentle sleep | `Pet Sleep Ambience` A | `ca4b004a-99ad-474e-b119-efcb2ce94fb8` | 0:32; 179 kbps MP3 | `4FE69B48E296C715288909CF905016CD66F365CB04A64408ADBEF04B23B1D2C8` |
| Gentle sleep | `Purring Room Loop` B | `ac47575f-d92a-43a4-b0f1-2ab3cd97e3ce` | 1:42; 184 kbps MP3 | `7E7566312BFDCD714A895BADD90CFEE77DA5B5D99A9BEBADDECBCB6690C6DD9F` |

The exact prompts and local source paths are recorded in the manifest. No free-plan Suno output is included.

| Master candidate | Selected paid-plan source | Passage | Final QA | Review |
| --- | --- | --- | --- | --- |
| Cozy pet room | `Pawprint Room` A, `1fc464da-4f48-4f90-ba20-19e8af161dec` | 23.414667 s start; 8 bars at 82 BPM; 23.164625 s after crossfade | 48 kHz stereo PCM16; -25 LUFS-I; -11.93 dBTP; -51.13 dBFS seam | Awaiting Mark audible review |
| Play/training | `Treat Time Loop` A, `e5b46055-34fa-47e7-bfd2-72867ea33dc3` | 4.868750 s start; 16 bars at 116 BPM; 32.853458 s after crossfade | 48 kHz stereo PCM16; -25 LUFS-I; -12.53 dBTP; -63.46 dBFS seam | Awaiting Mark audible review |
| Gentle sleep | `Purring Room Loop` B, `ac47575f-d92a-43a4-b0f1-2ab3cd97e3ce` | 16.551750 s start; 8 bars at 58 BPM; 32.853458 s after crossfade | 48 kHz stereo PCM16; -25 LUFS-I; -11.02 dBTP; -56.68 dBFS seam | Awaiting Mark audible review |

## Generated ElevenLabs Starter source candidates

Generated 2026-08-16 with ElevenLabs Sound Effects. Twenty-three private batches produced 92 candidates for the 22 required Jack/training assets; the extra batch is a preserved 12-second celebration experiment superseded by a fixed two-second batch. Exact prompts are recorded in the manifest, and no free-plan output is included. Candidate 1 from every required asset is locally preserved as an original 48 kHz stereo PCM16 WAV. Each file's byte count, duration, SHA-256, generation ID, prompt, settings, and planned edits are recorded in the manifest.

| Intended asset | Generation ID | Candidate duration | Setting |
| --- | --- | --- | --- |
| Happy bark | `9c3G8W7UW5Vu60s3bTz2` | 4 × 2 s | Auto one-shot; candidate 1 WAV locally preserved |
| Alert bark | `IqOz1ZnOkF1hVM3plUoA` | 4 × 2 s | Auto one-shot |
| Gentle whine | `HdjNJzofJy1ufcsTniz9` | 4 × 2 s | Auto one-shot |
| Calm pant | `AQNUgqzxYvEErVaR8CMR` | 4 × 7 s | Loop enabled; fixed duration |
| Excited pant | `IrArENQjy2bdHEWUyjtQ` | 4 × 5 s | Loop enabled; fixed duration |
| Sniff | `3UkQOti6fyhMGqS46GpP` | 4 × 2 s | Auto one-shot |
| Sneeze | `CE6efjWCS5y6WCjnVu25` | 4 × 1 s | Auto one-shot |
| Yawn | `LlZNp482epMUT7Nr1s0C` | 4 × 1 s | Auto one-shot |
| Sleep breathing | `89NIyvOHRLR6rcsEgBQl` | 4 × 10 s | Loop enabled; fixed duration; candidate 1 WAV locally preserved |
| Eating | `aZur6ellw5MYMqn6loxR` | 4 × 2 s | Auto one-shot |
| Drinking | `0j1IE6wXTl8TdAVh99RI` | 4 × 1 s | Auto one-shot |
| Treat crunch | `QZSXVH8eVqQ2nF47dowd` | 4 × 2 s | Auto one-shot |
| Paw steps | `8zXYJxveRDsKPALWMhjA` | 4 × 2 s | Auto one-shot |
| Collar jingle | `ScG14PJsJZNEU1nXKtpn` | 4 × 1 s | Auto one-shot |
| Wet shake | `aNRLtMrr2uXYihbhnHcu` | 4 × 1 s | Auto one-shot |
| Toy squeak | `HIjSVesu07UZCnWHQGgn` | 4 × 2 s | Auto one-shot |
| Huff | `6jT5aOIlMaupszkYBjEE` | 4 × 1 s | Auto one-shot |
| Sleepy grumble | `7xquqejnKWlY0iQ4o9HJ` | 4 × 1 s | Auto one-shot |
| Success chime | `KC33MVO6E0iGATBmj5ZO` | 4 × 2 s | Auto one-shot |
| Treat toss | `fTzEuwGcfE7MdOLTQfAG` | 4 × 2 s | Auto one-shot |
| Treat catch | `ahdLRdTwDE4IKSvFxYM2` | 4 × 1 s | Auto one-shot |
| Celebration experiment | `VTpFrCJiqP46JQQwrMT9` | 4 × 12 s | Preserved; unpreferred length |
| Celebration accent | `POO70EOC52nkYnCVbSh7` | 4 × 2 s | Fixed duration; preferred batch |

The signed-in History workflow downloaded the original WAVs without generating new audio or consuming credits. The temporary, one-credit-capped API key tested during recovery could not expose website SFX history through the public API; it was revoked immediately and no credential was saved to the repository. Original browser downloads remain preserved outside the repository, while the versioned source copies above are the development source of truth. `npm run check:audio` verifies all 22 local source hashes and WAV structures. Four preserved candidate-1 sources reach digital full scale (happy bark, sneeze, treat crunch, and wet shake); their separate master candidates are attenuated under the package peak ceiling. All 22 ElevenLabs and five Jfxr assets now have non-overwriting 48 kHz mono PCM16 master candidates. The three Jack ambience loops received 50 ms equal-power crossfades and pass the deterministic -50 dBFS seam threshold. Every master remains marked `awaiting-Mark-audible-review`.

## Per-asset completion record

Each manifest asset must receive these fields before release:

| Field | Required value |
| --- | --- |
| Tool/model | Exact product and model or Jfxr parameter export |
| Plan | Paid plan active at generation, or applicable open-tool rights |
| Generated at | ISO date/time with timezone |
| Prompt/parameters | Exact prompt already seeded in the manifest, plus any generation setting changes |
| Source evidence | Provider generation ID and SHA-256 of downloaded source |
| Edits | Exact mastering tool/version and chronological edit/export operations |
| Final evidence | SHA-256, format, duration, channels, sample rate, loudness, peak, loop-seam result |
| Commercial license | Terms URL, terms verification date, attribution rule, restrictions, reviewer conclusion |

The candidate package is locally bundled and has no runtime AI, provider API, streaming, or network dependency. Runtime integration now uses the versioned Jack reactions, training/animation cues, UI sounds, and all three music loops; the earlier unversioned WAV files remain preserved but are no longer imported by `App.tsx`.

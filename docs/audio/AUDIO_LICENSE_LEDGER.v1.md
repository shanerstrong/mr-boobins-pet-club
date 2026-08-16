# Audio package V1 license and production ledger

Status: **in production; five open-tool UI sources and six paid-plan Suno music candidates are locally bundled; ElevenLabs sources and final mastering remain pending**.

This ledger is the human-readable companion to `assets/audio/v1/audio-manifest.v1.json`. The manifest records every planned asset, exact generation prompt or synthesis brief, tool plan, edit plan, output path, and current commercial-license status. Existing unversioned WAV files remain preserved as provisional development assets and are not V1 release sources.

## Production controls

- Generate no asset on a free plan. A later paid subscription does not retroactively license free-plan output.
- Recheck and record the provider terms, plan, model/service beta status, and commercial permissions on the exact generation date.
- Do not use named artists, song titles, copyrighted lyrics, franchise music, cloned voices, child voices, private recordings, or uploaded audio references.
- Use text prompts only. Keep credentials, invoices, private account data, and secrets out of the repository.
- Preserve source downloads separately from edited runtime WAVs. Record SHA-256 hashes for both.
- Record every Audacity operation: trim points, fades, loop crossfade, resampling, channel conversion, loudness normalization, and export settings.
- A release row becomes `ready` only after commercial-rights evidence, source/final hashes, audible review, and automated audio QA all pass.

## Tool and rights plan

| Tool | Intended assets | Planned plan | Generation-date evidence required |
| --- | --- | --- | --- |
| ElevenLabs | Jack sounds, foley, treat effects, success and celebration accents | Starter paid month | Paid non-beta commercial license; service-specific terms; plan receipt retained privately |
| Suno | Cozy, play/training, and sleep music | Pro paid month | Track generated while Pro is active; game-use commercial rights; generation ID/date |
| Jfxr + jsfxr 1.4.1 | Command-selected and soft UI tones | Open web editor and local Unlicense renderer | Parameter script; Jfxr statement that generated sounds belong to the creator; jsfxr Unlicense |
| Audacity | Trimming, fades, loudness, loop construction, PCM export | GPL desktop editor | Application version and edit log; source rights remain those of the generated asset |

Official rights were rechecked on 2026-08-15: [Jfxr commercial-use FAQ](https://github.com/ttencate/jfxr#can-i-use-these-sounds-commercially) and [jsfxr Unlicense](https://github.com/chr15m/jsfxr/blob/master/UNLICENSE). Jfxr requires no attribution for created sounds; attribution remains appreciated. The renderer tarball SHA-256 is `BAE7F2AFE8E13D5E4C0662A2AA0629D41544D641E824127ED5E25BE86C4FF4F8`.

Suno commercial rights were rechecked on 2026-08-15 against its [commercial-use guidance](https://help.suno.com/en/articles/9601665) and [ownership guidance](https://help.suno.com/en/articles/2416769). The exact account showed an active monthly Pro Plan, next billing on 2026-09-15, before generation. Suno states that songs made while subscribed to a paid plan may be used commercially, including in video games, and retain those commercial-use rights after cancellation; copyright protection is not guaranteed.

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

Generated 2026-08-15 with Suno v5.5 and the Instrumental setting enabled. Three batches used 30 credits total from an observed 3,050-credit balance. These MP3 downloads are preserved as source candidates; none is a final loop or runtime asset yet.

| Intended loop | Candidate | Generation ID | Source QA | SHA-256 |
| --- | --- | --- | --- | --- |
| Cozy pet room | `Pawprint Room` A | `1fc464da-4f48-4f90-ba20-19e8af161dec` | 1:50; 187 kbps MP3 | `06958AE88D732D7CFE03650F49994CAE2EF98BE0EE096F973B9EC542FA674047` |
| Cozy pet room | `Pawprint Room` B | `937ceab3-21ad-4a5b-861e-4ba7971694bf` | 1:37; 185 kbps MP3 | `3FF75148F6EE75AB26AC4DAD54F9E43FDF1D12DB2A0320A30330B2D70EF8EE9B` |
| Play/training | `Treat Time Loop` A | `e5b46055-34fa-47e7-bfd2-72867ea33dc3` | 0:42; 186 kbps MP3 | `3C88C3FD0A57C6218667ADE36A7D2377A55DDE6FB199062B6FF806ACC9CC27B8` |
| Play/training | `Treat Time Loop` B | `511ca7b3-b9e1-437f-b9bd-b8374e418813` | 0:51; 197 kbps MP3 | `ABF2270568E010CA95466DF201F170638CE65760D6C626B9263D0CC9EE4880E5` |
| Gentle sleep | `Pet Sleep Ambience` A | `ca4b004a-99ad-474e-b119-efcb2ce94fb8` | 0:32; 179 kbps MP3 | `4FE69B48E296C715288909CF905016CD66F365CB04A64408ADBEF04B23B1D2C8` |
| Gentle sleep | `Purring Room Loop` B | `ac47575f-d92a-43a4-b0f1-2ab3cd97e3ce` | 1:42; 184 kbps MP3 | `7E7566312BFDCD714A895BADD90CFEE77DA5B5D99A9BEBADDECBCB6690C6DD9F` |

The exact prompts and local source paths are recorded in the manifest. No free-plan Suno output is included.

## Per-asset completion record

Each manifest asset must receive these fields before release:

| Field | Required value |
| --- | --- |
| Tool/model | Exact product and model or Jfxr parameter export |
| Plan | Paid plan active at generation, or applicable open-tool rights |
| Generated at | ISO date/time with timezone |
| Prompt/parameters | Exact prompt already seeded in the manifest, plus any generation setting changes |
| Source evidence | Provider generation ID and SHA-256 of downloaded source |
| Edits | Audacity version and chronological edit/export operations |
| Final evidence | SHA-256, format, duration, channels, sample rate, loudness, peak, loop-seam result |
| Commercial license | Terms URL, terms verification date, attribution rule, restrictions, reviewer conclusion |

The final package is locally bundled and has no runtime AI, provider API, streaming, or network dependency.

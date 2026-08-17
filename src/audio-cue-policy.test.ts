import { describe, expect, it } from "vitest";
import audioManifest from "../assets/audio/v1/audio-manifest.v1.json";
import animationManifest from "../assets/3d/jack/v2/animations/animation-event-manifest-v2.json";
import {
  AUDIO_ASSET_IDS,
  AUDIO_CUE_ASSETS,
  AUDIO_CUE_IDS,
  CARE_AUDIO_MARKERS,
  getTrainingAudioPlan,
  getTrainingAudioTimeline,
  resolveAudioMarker,
  scaleAudioPhaseTimeline,
} from "./audio-cue-policy";
import {
  TRAINING_CELEBRATIONS,
  TRAINING_COMMANDS,
} from "./training-policy";

type ManifestClip = {
  durationMs: number;
  markers: { name: string; timeMs: number }[];
};

const clips = animationManifest.clips as Record<string, ManifestClip>;

function markerTime(clip: string, marker: string) {
  if (marker === "start") return 0;
  const match = clips[clip]?.markers.find((candidate) => candidate.name === marker);
  if (!match) throw new Error(`Missing ${clip}:${marker}`);
  return match.timeMs;
}

describe("versioned audio package contract", () => {
  it("maps every semantic cue to one declared local asset", () => {
    expect(Object.keys(AUDIO_CUE_ASSETS).sort()).toEqual([...AUDIO_CUE_IDS].sort());
    expect(new Set(Object.values(AUDIO_CUE_ASSETS))).toEqual(new Set(AUDIO_ASSET_IDS));
  });

  it("declares every asset once under a local versioned path", () => {
    const assets = audioManifest.assets as { id: string; file: string }[];
    expect(assets.map((asset) => asset.id).sort()).toEqual([...AUDIO_ASSET_IDS].sort());
    expect(new Set(assets.map((asset) => asset.id)).size).toBe(assets.length);
    for (const asset of assets) {
      expect(asset.file).toMatch(/^(jack|training|ui|music)\/.+\.v1\.wav$/);
      expect(asset.file).not.toMatch(/^(https?:)?\/\//i);
    }
  });

  it("requires evidence for generated sources and keeps ungenerated assets pending", () => {
    for (const asset of audioManifest.assets) {
      if (asset.id.startsWith("ui.")) {
        expect(asset.status).toBe("source-generated");
        expect(asset.generatedAt).toMatch(/^2026-08-15T/);
        expect(asset.commercialLicenseStatus).toBe("verified-commercial-use");
        expect(asset.sha256).toMatch(/^[A-F0-9]{64}$/);
        expect(asset.sourceQa?.sampleRate).toBe(44100);
        expect(asset.sourceQa?.channels).toBe(1);
        expect(asset.sourceQa?.bitsPerSample).toBe(16);
        expect(asset.sourceQa?.lastSample).toBe(0);
      } else if (asset.id.startsWith("music.")) {
        expect(asset.status).toBe("source-generated");
        expect(asset.generatedAt).toMatch(/^2026-08-15T/);
        expect(asset.commercialLicenseStatus).toBe("verified-commercial-use");
        expect(asset.sourceCandidates).toHaveLength(2);
        for (const candidate of asset.sourceCandidates ?? []) {
          expect("id" in candidate).toBe(true);
          if (!("id" in candidate)) continue;
          expect(candidate.id).toMatch(/^[a-f0-9-]{36}$/);
          expect(candidate.sourceFile).toMatch(
            /^source\/suno\/2026-08-15\/.+\.mp3$/,
          );
          expect(candidate.durationSeconds).toBeGreaterThan(0);
          expect(candidate.bitrateKbps).toBeGreaterThan(0);
          expect(candidate.sha256).toMatch(/^[A-F0-9]{64}$/);
        }
      } else {
        expect(asset.status).toBe("source-generated");
        expect(asset.generatedAt).toMatch(/^2026-08-16T/);
        expect(asset.commercialLicenseStatus).toBe("verified-commercial-use");
        expect(asset.generationId).toMatch(/^[A-Za-z0-9]{20}$/);
        expect(asset.candidateCount).toBe(4);
        expect(asset.candidateDurationsSeconds).toHaveLength(4);
        expect(asset.generationSettings?.autoPromptImprove).toBe(false);
        expect(asset.generationSettings?.sharingToExplore).toBe(false);
        expect(asset.sourceCandidates).toHaveLength(1);
        expect(asset.sourceCandidates?.[0]).toMatchObject({
          candidate: 1,
          format: "48 kHz stereo 16-bit PCM WAV",
        });
        expect(asset.sourceCandidates?.[0].sourceFile).toMatch(
          /^source\/elevenlabs\/2026-08-16\/.+-c1\.wav$/,
        );
        expect(asset.sourceCandidates?.[0].sha256).toMatch(/^[A-F0-9]{64}$/);
      }
    }
  });

  it("records private paid-plan ElevenLabs generation evidence", () => {
    const evidence = audioManifest.generationEvidence["elevenlabs-sfx-v1"];
    expect(evidence.plan).toBe("Starter");
    expect(evidence.generationCount).toBe(23);
    expect(evidence.candidateCount).toBe(92);
    expect(evidence.downloadedCandidateCount).toBe(22);
    expect(evidence.candidateSelection).toBe("candidate 1 per required asset");
    expect(evidence.sharingToExplore).toBe(false);
    expect(evidence.autoPromptImprove).toBe(false);
    expect(evidence.licenseVerifiedAt).toBe("2026-08-16");
    expect(evidence.licenseUrls).toHaveLength(5);

    const happyBark = audioManifest.assets.find((asset) => asset.id === "jack.happy-bark");
    expect(happyBark?.sourceCandidates?.[0].sourceFile).toMatch(
      /^source\/elevenlabs\/2026-08-16\/.+\.wav$/,
    );
    expect(happyBark?.sourceCandidates?.[0].sha256).toMatch(/^[A-F0-9]{64}$/);

    const celebration = audioManifest.assets.find(
      (asset) => asset.id === "training.celebration-accent",
    );
    expect(celebration?.generationBatches).toHaveLength(2);
    expect(celebration?.generationBatches?.[0].disposition).toBe(
      "unpreferred-length-preserved",
    );
  });

  it("keeps deterministic 48 kHz masters pending Mark's audible review", () => {
    const mastered = audioManifest.assets.filter((asset) => asset.masterCandidate);
    expect(mastered).toHaveLength(30);
    for (const asset of mastered) {
      expect(asset.masterCandidate?.sha256).toMatch(/^[A-F0-9]{64}$/);
      expect(asset.masterCandidate?.qa).toMatchObject({
        sampleRate: 48000,
        channels: asset.id.startsWith("music.") ? 2 : 1,
        bitsPerSample: 16,
      });
      expect(asset.masterCandidate?.reviewStatus).toBe("awaiting-Mark-audible-review");
      expect(asset.masterCandidate?.file).toMatch(/^(jack|training|ui|music)\/.+\.v1\.wav$/);
      if (asset.id.startsWith("music.")) {
        expect(asset.masterCandidate?.qa.integratedLufs).toBe(-25);
        expect(asset.masterCandidate?.qa.truePeakDbtp).toBeLessThanOrEqual(-1.5);
        expect(asset.masterCandidate?.loopQa?.clickFree).toBe(true);
      }
    }
  });
});

describe("animation-synchronized cue markers", () => {
  it.each(TRAINING_COMMANDS)("anchors %s selection and success to locked markers", (command) => {
    const plan = getTrainingAudioPlan(command, "happy-hop");
    expect(markerTime(plan.commandSelected.clip, plan.commandSelected.marker)).toBe(500);
    expect(markerTime(plan.commandSuccess.clip, plan.commandSuccess.marker)).toBe(
      clips[plan.commandSuccess.clip].durationMs,
    );
  });

  it("anchors toss, catch, and crunch to the treat animation", () => {
    const plan = getTrainingAudioPlan("sit", "happy-hop");
    expect(markerTime(plan.treatToss.clip, plan.treatToss.marker)).toBe(0);
    expect(markerTime(plan.treatCatch.clip, plan.treatCatch.marker)).toBe(600);
    expect(markerTime(plan.treatCrunch.clip, plan.treatCrunch.marker)).toBe(350);
  });

  it.each(TRAINING_CELEBRATIONS)(
    "anchors the %s accent to its first signature motion",
    (celebration) => {
      const plan = getTrainingAudioPlan("sit", celebration);
      expect(markerTime(plan.celebration.clip, plan.celebration.marker)).toBeGreaterThan(0);
    },
  );

  it("anchors feeding and cleaning cues to their authored markers", () => {
    expect(markerTime(CARE_AUDIO_MARKERS.feedCatch.clip, CARE_AUDIO_MARKERS.feedCatch.marker)).toBe(1000);
    expect(markerTime(CARE_AUDIO_MARKERS.cleanShake.clip, CARE_AUDIO_MARKERS.cleanShake.marker)).toBe(800);
  });

  it.each(TRAINING_COMMANDS)("resolves the complete %s phase timeline", (command) => {
    const timeline = getTrainingAudioTimeline(command, "happy-hop");
    expect(timeline.command.cues).toEqual([
      { cue: "training.command-selected", timeMs: 500 },
      {
        cue: "training.success",
        timeMs: clips[`training_${command}`].durationMs,
      },
    ]);
    expect(timeline.treatFlight).toEqual({
      authoredDurationMs: 600,
      cues: [
        { cue: "training.treat-toss", timeMs: 0 },
        { cue: "training.treat-catch", timeMs: 600 },
      ],
    });
    expect(timeline.eating).toEqual({
      authoredDurationMs: 1600,
      cues: [{ cue: "training.treat-crunch", timeMs: 350 }],
    });
  });

  it.each([
    ["happy-hop", 450],
    ["spin-wag", 500],
    ["goofy-shimmy", 550],
  ] as const)("resolves the %s celebration accent at %i ms", (celebration, timeMs) => {
    const timeline = getTrainingAudioTimeline("sit", celebration);
    expect(timeline.celebration.cues).toEqual([
      { cue: "training.celebration", timeMs },
    ]);
  });

  it("scales every cue to the actual motion duration, including reduced motion", () => {
    const authored = getTrainingAudioTimeline("paw", "spin-wag").command;
    expect(scaleAudioPhaseTimeline(authored, 800)).toEqual({
      authoredDurationMs: 800,
      cues: [
        { cue: "training.command-selected", timeMs: 250 },
        { cue: "training.success", timeMs: 800 },
      ],
    });
    expect(scaleAudioPhaseTimeline(authored, 0).cues).toEqual([
      { cue: "training.command-selected", timeMs: 0 },
      { cue: "training.success", timeMs: 0 },
    ]);
  });

  it("fails closed when a cue references an unknown marker", () => {
    expect(() =>
      resolveAudioMarker({
        cue: "training.success",
        clip: "training_sit",
        marker: "missing",
      }),
    ).toThrow("Unknown audio animation marker: training_sit:missing");
  });
});

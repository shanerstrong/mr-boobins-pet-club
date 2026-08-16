import { describe, expect, it } from "vitest";
import audioManifest from "../assets/audio/v1/audio-manifest.v1.json";
import animationManifest from "../assets/3d/jack/v2/animations/animation-event-manifest-v2.json";
import {
  AUDIO_ASSET_IDS,
  AUDIO_CUE_ASSETS,
  AUDIO_CUE_IDS,
  CARE_AUDIO_MARKERS,
  getTrainingAudioPlan,
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
          expect(candidate.id).toMatch(/^[a-f0-9-]{36}$/);
          expect(candidate.sourceFile).toMatch(
            /^source\/suno\/2026-08-15\/.+\.mp3$/,
          );
          expect(candidate.durationSeconds).toBeGreaterThan(0);
          expect(candidate.bitrateKbps).toBeGreaterThan(0);
          expect(candidate.sha256).toMatch(/^[A-F0-9]{64}$/);
        }
      } else {
        expect(asset.status).toBe("planned");
        expect(asset.generatedAt).toBeNull();
        expect(asset.commercialLicenseStatus).toBe("pending-generation-date-recheck");
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
});

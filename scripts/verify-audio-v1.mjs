import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const packageRoot = resolve(root, "assets/audio/v1");
const manifestPath = resolve(packageRoot, "audio-manifest.v1.json");
const errors = [];
const warnings = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();
}

function decibels(value) {
  return value > 0 ? Number((20 * Math.log10(value)).toFixed(2)) : null;
}

function inspectWave(path) {
  const buffer = readFileSync(path);
  assert(buffer.toString("ascii", 0, 4) === "RIFF", `${path} is not RIFF`);
  assert(buffer.toString("ascii", 8, 12) === "WAVE", `${path} is not WAVE`);

  let offset = 12;
  let format = null;
  let dataOffset = null;
  let dataBytes = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const payload = offset + 8;
    if (id === "fmt " && size >= 16) {
      format = {
        audioFormat: buffer.readUInt16LE(payload),
        channels: buffer.readUInt16LE(payload + 2),
        sampleRate: buffer.readUInt32LE(payload + 4),
        byteRate: buffer.readUInt32LE(payload + 8),
        blockAlign: buffer.readUInt16LE(payload + 12),
        bitsPerSample: buffer.readUInt16LE(payload + 14),
      };
    }
    if (id === "data") {
      dataOffset = payload;
      dataBytes = Math.min(size, buffer.length - payload);
      break;
    }
    offset = payload + size + (size & 1);
  }

  assert(Boolean(format), `${path} is missing a fmt chunk`);
  assert(dataOffset !== null, `${path} is missing a data chunk`);
  if (!format || dataOffset === null || dataBytes === null) return null;
  assert(format.audioFormat === 1, `${path} must be PCM, found format ${format.audioFormat}`);
  assert(format.bitsPerSample === 16, `${path} must be PCM16, found ${format.bitsPerSample}-bit`);
  if (format.audioFormat !== 1 || format.bitsPerSample !== 16) return null;

  const sampleCount = Math.floor(dataBytes / 2);
  let peak = 0;
  let squared = 0;
  let sum = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = buffer.readInt16LE(dataOffset + index * 2);
    const absolute = Math.abs(sample);
    if (absolute > peak) peak = absolute;
    squared += sample * sample;
    sum += sample;
  }

  const firstFrame = [];
  const lastFrame = [];
  let seamDelta = 0;
  for (let channel = 0; channel < format.channels; channel += 1) {
    const first = buffer.readInt16LE(dataOffset + channel * 2);
    const lastIndex = sampleCount - format.channels + channel;
    const last = buffer.readInt16LE(dataOffset + lastIndex * 2);
    firstFrame.push(first);
    lastFrame.push(last);
    seamDelta = Math.max(seamDelta, Math.abs(first - last));
  }

  return {
    bytes: buffer.length,
    channels: format.channels,
    sampleRate: format.sampleRate,
    bitsPerSample: format.bitsPerSample,
    durationSeconds: Number((dataBytes / format.byteRate).toFixed(6)),
    peakDbfs: decibels(peak / 32768),
    rmsDbfs: decibels(Math.sqrt(squared / sampleCount) / 32768),
    dcOffset: Number((sum / sampleCount / 32768).toFixed(8)),
    firstFrame,
    lastFrame,
    seamDeltaDbfs: decibels(seamDelta / 32768),
  };
}

assert(existsSync(manifestPath), `Missing manifest: ${manifestPath}`);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert(manifest.schemaVersion === 1, "Audio manifest schemaVersion must be 1");
assert(manifest.packageVersion === "v1", "Audio manifest packageVersion must be v1");
assert(manifest.runtimeNetworkDependency === false, "Runtime audio must not depend on a network");
assert(manifest.assets?.length === 30, `Expected 30 audio assets, found ${manifest.assets?.length ?? 0}`);
assert(new Set(manifest.assets?.map((asset) => asset.id)).size === 30, "Audio asset IDs must be unique");

const elevenEvidence = manifest.generationEvidence?.["elevenlabs-sfx-v1"];
assert(elevenEvidence?.plan === "Starter", "ElevenLabs Starter evidence is missing");
assert(elevenEvidence?.generationCount === 23, "Expected 23 ElevenLabs generation batches");
assert(elevenEvidence?.candidateCount === 92, "Expected 92 ElevenLabs candidates");
assert(elevenEvidence?.sharingToExplore === false, "ElevenLabs Explore sharing must be disabled");
assert(elevenEvidence?.autoPromptImprove === false, "ElevenLabs prompt improvement must be disabled");

const localSources = [];
let localFilesVerified = 0;
let masterCandidatesVerified = 0;
for (const asset of manifest.assets ?? []) {
  assert(typeof asset.prompt === "string" && asset.prompt.length > 0, `${asset.id} is missing its prompt`);
  assert(typeof asset.toolPlan === "string" && asset.toolPlan.length > 0, `${asset.id} is missing its tool/plan`);
  assert(typeof asset.editsPlan === "string" && asset.editsPlan.length > 0, `${asset.id} is missing its edit plan`);
  if (asset.status === "source-generated" || asset.status === "ready") {
    assert(asset.commercialLicenseStatus === "verified-commercial-use", `${asset.id} lacks verified commercial-use status`);
  }

  if (asset.sha256) {
    const path = resolve(packageRoot, asset.file);
    assert(existsSync(path), `${asset.id} source file is missing: ${asset.file}`);
    if (existsSync(path)) {
      assert(hashFile(path) === asset.sha256, `${asset.id} source hash mismatch`);
      localFilesVerified += 1;
      if (path.toLowerCase().endsWith(".wav")) {
        const qa = inspectWave(path);
        localSources.push({ id: asset.id, path, qa });
        if (qa?.peakDbfs !== null && qa?.peakDbfs >= -0.1 && asset.status !== "ready") {
          warnings.push(`${asset.id} source reaches digital full scale; select or attenuate before mastering`);
        }
      }
    }
  }

  for (const candidate of asset.sourceCandidates ?? []) {
    const path = resolve(packageRoot, candidate.sourceFile);
    assert(existsSync(path), `${asset.id} candidate is missing: ${candidate.sourceFile}`);
    if (!existsSync(path)) continue;
    assert(hashFile(path) === candidate.sha256, `${asset.id} candidate hash mismatch: ${candidate.sourceFile}`);
    localFilesVerified += 1;
    if (path.toLowerCase().endsWith(".wav")) {
      const qa = inspectWave(path);
      localSources.push({ id: asset.id, path, qa });
      if (qa?.peakDbfs !== null && qa?.peakDbfs >= -0.1 && asset.status !== "ready") {
        warnings.push(`${asset.id} source reaches digital full scale; select or attenuate before mastering`);
      }
    }
  }

  if (asset.masterCandidate) {
    const path = resolve(packageRoot, asset.masterCandidate.file);
    assert(existsSync(path), `${asset.id} master candidate is missing: ${asset.masterCandidate.file}`);
    if (existsSync(path)) {
      assert(hashFile(path) === asset.masterCandidate.sha256, `${asset.id} master candidate hash mismatch`);
      const qa = inspectWave(path);
      localFilesVerified += 1;
      masterCandidatesVerified += 1;
      localSources.push({ id: `${asset.id} (master)`, path, qa });
      assert(qa?.sampleRate === 48000, `${asset.id} master candidate must be 48 kHz`);
      const expectedMasterChannels = asset.id.startsWith("music.") ? 2 : 1;
      assert(
        qa?.channels === expectedMasterChannels,
        `${asset.id} master candidate must have ${expectedMasterChannels} channel(s)`,
      );
      assert(qa?.bitsPerSample === 16, `${asset.id} master candidate must be PCM16`);
      assert(qa?.peakDbfs === null || qa.peakDbfs <= -1, `${asset.id} master candidate exceeds -1 dBFS`);
      assert(
        asset.masterCandidate.reviewStatus === "awaiting-Mark-audible-review",
        `${asset.id} master candidate must remain awaiting Mark's audible review`,
      );
      if ([
        "jack.calm-pant",
        "jack.excited-pant",
        "jack.sleep-breathing",
        "music.cozy",
        "music.play",
        "music.sleep",
      ].includes(asset.id)) {
        assert(asset.masterCandidate.loopQa?.clickFree === true, `${asset.id} master loop failed seam QA`);
        assert(
          qa?.seamDeltaDbfs === null || qa.seamDeltaDbfs <= -50,
          `${asset.id} master loop seam exceeds -50 dBFS`,
        );
      } else {
        assert(qa?.firstFrame?.every((sample) => sample === 0), `${asset.id} master must fade in from zero`);
        assert(qa?.lastFrame?.every((sample) => sample === 0), `${asset.id} master must fade out to zero`);
      }
    }
  }

  if (asset.status === "ready") {
    const path = resolve(packageRoot, asset.file);
    assert(existsSync(path), `${asset.id} ready master is missing: ${asset.file}`);
    assert(typeof asset.sha256 === "string", `${asset.id} ready master lacks a hash`);
    assert(Boolean(asset.finalQa), `${asset.id} ready master lacks finalQa`);
    if (asset.finalQa) {
      assert(asset.finalQa.sampleRate === 48000, `${asset.id} final sample rate must be 48 kHz`);
      assert(asset.finalQa.bitsPerSample === 16, `${asset.id} final bit depth must be PCM16`);
      const expectedChannels = asset.id.startsWith("music.") ? 2 : 1;
      assert(asset.finalQa.channels === expectedChannels, `${asset.id} final channel count must be ${expectedChannels}`);
      assert(asset.finalQa.truePeakDbtp <= (expectedChannels === 2 ? -1.5 : -1), `${asset.id} final true peak exceeds target`);
    }
    if (["jack.calm-pant", "jack.excited-pant", "jack.sleep-breathing", "music.cozy", "music.play", "music.sleep"].includes(asset.id)) {
      assert(asset.loopQa?.clickFree === true, `${asset.id} ready loop lacks click-free evidence`);
    }
  }
}

if (errors.length) {
  for (const error of errors) process.stderr.write(`ERROR: ${error}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({
    status: "pass",
    releaseStatus: manifest.releaseStatus,
    assets: manifest.assets.length,
    localFilesVerified,
    localWavsInspected: localSources.length,
    masterCandidatesVerified,
    warnings,
    localWavQa: localSources.map(({ id, path, qa }) => ({
      id,
      file: path.slice(packageRoot.length + 1).replaceAll("\\", "/"),
      ...qa,
    })),
  }, null, 2)}\n`);
}

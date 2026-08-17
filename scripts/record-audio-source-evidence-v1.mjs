import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const root = process.cwd();
const packageRoot = resolve(root, "assets/audio/v1");
const sourceRoot = resolve(packageRoot, "source/elevenlabs/2026-08-16");
const manifestPath = resolve(packageRoot, "audio-manifest.v1.json");

function inspectWave(path) {
  const buffer = readFileSync(path);
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`${path} is not a RIFF/WAVE file`);
  }

  let offset = 12;
  let format;
  let dataBytes;
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
        bitsPerSample: buffer.readUInt16LE(payload + 14),
      };
    }
    if (id === "data") {
      dataBytes = Math.min(size, buffer.length - payload);
      break;
    }
    offset = payload + size + (size & 1);
  }

  if (!format || dataBytes === undefined) throw new Error(`${path} is missing WAV format or data`);
  if (format.audioFormat !== 1 || format.bitsPerSample !== 16) {
    throw new Error(`${path} must be PCM16`);
  }
  return {
    bytes: buffer.length,
    channels: format.channels,
    sampleRate: format.sampleRate,
    bitsPerSample: format.bitsPerSample,
    durationSeconds: Number((dataBytes / format.byteRate).toFixed(6)),
    sha256: createHash("sha256").update(buffer).digest("hex").toUpperCase(),
  };
}

const original = readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(original);
const elevenAssets = manifest.assets.filter((asset) => asset.toolPlan === "ElevenLabs Starter");
let updated = original;

for (const asset of elevenAssets) {
  if (!asset.generationId) throw new Error(`${asset.id} is missing generationId`);
  const filename = `${asset.id.replaceAll(".", "-")}-${asset.generationId}-c1.wav`;
  const sourcePath = resolve(sourceRoot, filename);
  const qa = inspectWave(sourcePath);
  if (qa.sampleRate !== 48000 || qa.channels !== 2 || qa.bitsPerSample !== 16) {
    throw new Error(`${filename} must be 48 kHz stereo PCM16 source audio`);
  }

  const record = {
    candidate: 1,
    sourceFile: `source/elevenlabs/2026-08-16/${basename(sourcePath)}`,
    format: "48 kHz stereo 16-bit PCM WAV",
    bytes: qa.bytes,
    durationSeconds: qa.durationSeconds,
    sha256: qa.sha256,
  };
  const linePattern = new RegExp(`^.*\\"id\\":\\"${asset.id.replaceAll(".", "\\.")}\\".*$`, "m");
  const match = updated.match(linePattern);
  if (!match) throw new Error(`Could not locate manifest row for ${asset.id}`);
  const withoutOldEvidence = match[0].replace(/,"sourceCandidates":\[\{.*?\}\](?=,"commercialLicenseStatus")/, "");
  const replacement = withoutOldEvidence.replace(
    /,"commercialLicenseStatus"/,
    `,"sourceCandidates":${JSON.stringify([record])},"commercialLicenseStatus"`,
  );
  updated = updated.replace(match[0], replacement);
}

writeFileSync(manifestPath, updated, "utf8");
process.stdout.write(`Recorded candidate-1 source evidence for ${elevenAssets.length} ElevenLabs assets.\n`);

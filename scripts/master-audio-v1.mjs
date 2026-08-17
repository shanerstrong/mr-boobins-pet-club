import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const packageRoot = resolve(root, "assets/audio/v1");
const manifestPath = resolve(packageRoot, "audio-manifest.v1.json");
const loopIds = new Set(["jack.calm-pant", "jack.excited-pant", "jack.sleep-breathing"]);

function db(value) {
  return value > 0 ? 20 * Math.log10(value) : -Infinity;
}

function readWave(path) {
  const buffer = readFileSync(path);
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`${path} is not RIFF/WAVE`);
  }
  let offset = 12;
  let format;
  let dataOffset;
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
  if (!format || dataOffset === undefined || dataBytes === undefined) throw new Error(`${path} is incomplete`);
  if (format.audioFormat !== 1 || format.bitsPerSample !== 16) throw new Error(`${path} must be PCM16`);

  const frames = Math.floor(dataBytes / 2 / format.channels);
  const channels = Array.from({ length: format.channels }, () => new Float64Array(frames));
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < format.channels; channel += 1) {
      channels[channel][frame] = buffer.readInt16LE(dataOffset + (frame * format.channels + channel) * 2) / 32768;
    }
  }
  return { channels, sampleRate: format.sampleRate };
}

function downmixMono(channels) {
  const mono = new Float64Array(channels[0].length);
  for (let frame = 0; frame < mono.length; frame += 1) {
    let total = 0;
    for (const channel of channels) total += channel[frame];
    mono[frame] = total / channels.length;
  }
  return mono;
}

function removeDc(samples) {
  let total = 0;
  for (const sample of samples) total += sample;
  const mean = total / samples.length;
  const corrected = new Float64Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) corrected[index] = samples[index] - mean;
  return corrected;
}

function resampleLinear(samples, fromRate, toRate) {
  if (fromRate === toRate) return samples;
  const outputLength = Math.max(1, Math.round(samples.length * toRate / fromRate));
  const output = new Float64Array(outputLength);
  const scale = fromRate / toRate;
  for (let index = 0; index < outputLength; index += 1) {
    const position = Math.min(samples.length - 1, index * scale);
    const left = Math.floor(position);
    const right = Math.min(samples.length - 1, left + 1);
    const fraction = position - left;
    output[index] = samples[left] * (1 - fraction) + samples[right] * fraction;
  }
  return output;
}

function applyEdgeFades(samples, sampleRate, milliseconds) {
  const output = Float64Array.from(samples);
  const count = Math.min(Math.floor(sampleRate * milliseconds / 1000), Math.floor(output.length / 2));
  for (let index = 0; index < count; index += 1) {
    const fadeIn = index / Math.max(1, count - 1);
    const fadeOut = (count - 1 - index) / Math.max(1, count - 1);
    output[index] *= fadeIn;
    output[output.length - count + index] *= fadeOut;
  }
  return output;
}

function equalPowerLoop(samples, sampleRate, milliseconds) {
  const count = Math.min(Math.floor(sampleRate * milliseconds / 1000), Math.floor(samples.length / 4));
  const output = new Float64Array(samples.length - count);
  output.set(samples.subarray(count, samples.length - count), 0);
  const crossfadeOffset = samples.length - count * 2;
  for (let index = 0; index < count; index += 1) {
    const phase = index / Math.max(1, count - 1);
    const tailGain = Math.cos(phase * Math.PI / 2);
    const headGain = Math.sin(phase * Math.PI / 2);
    output[crossfadeOffset + index] =
      samples[samples.length - count + index] * tailGain + samples[index] * headGain;
  }
  return output;
}

function level(samples, targetRmsDb, peakCapDb) {
  let squared = 0;
  let peak = 0;
  for (const sample of samples) {
    squared += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const rms = Math.sqrt(squared / samples.length);
  const rmsGain = 10 ** ((targetRmsDb - db(rms)) / 20);
  const peakGain = peak > 0 ? 10 ** (peakCapDb / 20) / peak : 1;
  const gain = Math.min(rmsGain, peakGain);
  const output = new Float64Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) output[index] = samples[index] * gain;
  return output;
}

function enforcePeak(samples, peakCapDb) {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const cap = 10 ** (peakCapDb / 20);
  if (peak <= cap || peak === 0) return samples;
  const output = new Float64Array(samples.length);
  const gain = cap / peak;
  for (let index = 0; index < samples.length; index += 1) output[index] = samples[index] * gain;
  return output;
}

function writeMonoWave(path, samples, sampleRate) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataBytes, 40);
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1 - 1 / 32768, samples[index]));
    buffer.writeInt16LE(Math.round(value * 32768), 44 + index * 2);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
  return buffer;
}

function qa(samples, sampleRate) {
  let squared = 0;
  let total = 0;
  let peak = 0;
  for (const sample of samples) {
    squared += sample * sample;
    total += sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const rms = Math.sqrt(squared / samples.length);
  const seam = Math.abs(samples[0] - samples.at(-1));
  return {
    sampleRate,
    channels: 1,
    bitsPerSample: 16,
    durationSeconds: Number((samples.length / sampleRate).toFixed(6)),
    truePeakDbtp: Number(db(peak).toFixed(2)),
    truePeakMeasurement: "sample-peak proxy with 0.5 dB headroom beyond the -1 dBTP package ceiling",
    rmsDbfs: Number(db(rms).toFixed(2)),
    dcOffset: Number((total / samples.length).toFixed(8)),
    firstSample: Math.round(samples[0] * 32768),
    lastSample: Math.round(samples.at(-1) * 32768),
    seamDeltaDbfs: Number(db(seam).toFixed(2)),
  };
}

const original = readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(original);
const assets = manifest.assets.filter(
  (asset) => asset.toolPlan === "ElevenLabs Starter" || asset.toolPlan.startsWith("Jfxr web recipe"),
);
let updated = original;
const summaries = [];

for (const asset of assets) {
  const sourceFile = asset.sourceCandidates?.[0]?.sourceFile ?? asset.file;
  const outputFile = asset.id.startsWith("ui.")
    ? asset.file.replace(/\.v1\.wav$/, ".master.v1.wav")
    : asset.file;
  const sourcePath = resolve(packageRoot, sourceFile);
  const outputPath = resolve(packageRoot, outputFile);
  if (existsSync(outputPath)) throw new Error(`Refusing to overwrite existing master: ${outputFile}`);

  const source = readWave(sourcePath);
  let samples = downmixMono(source.channels);
  samples = removeDc(samples);
  samples = resampleLinear(samples, source.sampleRate, 48000);
  const loop = loopIds.has(asset.id);
  if (!loop) samples = applyEdgeFades(samples, 48000, 5);
  samples = level(samples, loop ? -27 : asset.id.startsWith("ui.") ? -22 : -20, -1.5);
  if (loop) samples = equalPowerLoop(samples, 48000, 50);
  samples = enforcePeak(samples, -1.5);

  const buffer = writeMonoWave(outputPath, samples, 48000);
  const finalQa = qa(samples, 48000);
  const record = {
    file: outputFile,
    sha256: createHash("sha256").update(buffer).digest("hex").toUpperCase(),
    edits: [
      "downmix source channels to mono",
      "remove measured DC offset",
      ...(source.sampleRate === 48000 ? [] : ["linear resample to 48 kHz"]),
      ...(loop ? ["50 ms equal-power end-to-start loop crossfade"] : ["5 ms linear edge fades"]),
      `RMS/peak normalization with ${loop ? "-27" : asset.id.startsWith("ui.") ? "-22" : "-20"} dBFS RMS target and -1.5 dBFS peak ceiling`,
      "export 48 kHz mono 16-bit PCM WAV",
    ],
    qa: finalQa,
    ...(loop ? { loopQa: { clickFree: finalQa.seamDeltaDbfs <= -50, crossfadeMs: 50 } } : {}),
    reviewStatus: "awaiting-Mark-audible-review",
  };

  const linePattern = new RegExp(`^.*\\"id\\":\\"${asset.id.replaceAll(".", "\\.")}\\".*$`, "m");
  const match = updated.match(linePattern);
  if (!match) throw new Error(`Could not locate manifest row for ${asset.id}`);
  if (match[0].includes('"masterCandidate"')) throw new Error(`${asset.id} already has masterCandidate evidence`);
  const replacement = match[0].replace(
    /,"commercialLicenseStatus"/,
    `,"masterCandidate":${JSON.stringify(record)},"commercialLicenseStatus"`,
  );
  updated = updated.replace(match[0], replacement);
  summaries.push({ id: asset.id, file: outputFile, ...finalQa });
}

writeFileSync(manifestPath, updated, "utf8");
process.stdout.write(`${JSON.stringify({ mastered: summaries.length, summaries }, null, 2)}\n`);

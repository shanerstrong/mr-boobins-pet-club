import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Buffer } from "node:buffer";
import {
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const root = process.cwd();
const packageRoot = resolve(root, "assets/audio/v1");
const manifestPath = resolve(packageRoot, "audio-manifest.v1.json");
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const sampleRate = 48000;
const channels = 2;
const crossfadeMs = 250;
const targetLufs = -25;
const targetTruePeak = -1.5;
const masteredAt = "2026-08-16";

const recipes = {
  "music.cozy": { bpm: 82, bars: 8 },
  "music.play": { bpm: 116, bars: 16 },
  "music.sleep": { bpm: 58, bars: 8 },
};

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    encoding: options.binary ? null : "utf8",
    maxBuffer: 512 * 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : result.stderr;
    throw new Error(`${executable} failed (${result.status}): ${stderr}`);
  }
  return result;
}

function getFfmpegVersion() {
  const firstLine = run(ffmpeg, ["-version"]).stdout.split(/\r?\n/, 1)[0];
  return firstLine.replace(/^ffmpeg version\s+/, "").trim();
}

function decodeFloatStereo(sourcePath) {
  const result = run(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel", "error",
      "-i", sourcePath,
      "-vn",
      "-ar", String(sampleRate),
      "-ac", String(channels),
      "-f", "f32le",
      "-acodec", "pcm_f32le",
      "pipe:1",
    ],
    { binary: true },
  );
  const buffer = result.stdout;
  const samples = new Float32Array(buffer.length / 4);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = buffer.readFloatLE(index * 4);
  }
  return samples;
}

function db(value) {
  return value > 0 ? 20 * Math.log10(value) : -120;
}

function rms(samples, firstFrame, frameCount) {
  const start = Math.max(0, firstFrame) * channels;
  const end = Math.min(samples.length, (firstFrame + frameCount) * channels);
  let squared = 0;
  let count = 0;
  for (let index = start; index < end; index += 1) {
    squared += samples[index] * samples[index];
    count += 1;
  }
  return count ? Math.sqrt(squared / count) : 0;
}

function standardDeviation(values) {
  if (!values.length) return 0;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function scoreWindow(samples, startFrame, frameCount) {
  const blockFrames = sampleRate;
  const blockDb = [];
  for (let offset = 0; offset + blockFrames <= frameCount; offset += blockFrames) {
    blockDb.push(db(rms(samples, startFrame + offset, blockFrames)));
  }
  const edgeFrames = Math.min(sampleRate, Math.floor(frameCount / 6));
  const headDb = db(rms(samples, startFrame, edgeFrames));
  const tailDb = db(rms(samples, startFrame + frameCount - edgeFrames, edgeFrames));
  const third = Math.floor(frameCount / 3);
  const firstThirdDb = db(rms(samples, startFrame, third));
  const lastThirdDb = db(rms(samples, startFrame + frameCount - third, third));
  let clipped = 0;
  for (let index = startFrame * channels; index < (startFrame + frameCount) * channels; index += 1) {
    if (Math.abs(samples[index]) >= 0.999) clipped += 1;
  }
  const overallDb = db(rms(samples, startFrame, frameCount));
  const score =
    standardDeviation(blockDb) * 2.5 +
    Math.abs(headDb - tailDb) * 2 +
    Math.abs(firstThirdDb - lastThirdDb) +
    Math.min(25, clipped / 100) +
    (overallDb < -38 ? -38 - overallDb : 0);
  return {
    score: Number(score.toFixed(4)),
    rmsDbfs: Number(overallDb.toFixed(2)),
    blockRmsStdDevDb: Number(standardDeviation(blockDb).toFixed(3)),
    headTailRmsDeltaDb: Number(Math.abs(headDb - tailDb).toFixed(3)),
    firstLastThirdRmsDeltaDb: Number(Math.abs(firstThirdDb - lastThirdDb).toFixed(3)),
    sourceClippedSamples: clipped,
  };
}

function selectWindow(asset, recipe) {
  const barSeconds = 60 * 4 / recipe.bpm;
  const windowSeconds = barSeconds * recipe.bars;
  const windowFrames = Math.round(windowSeconds * sampleRate);
  const scored = [];

  for (const candidate of asset.sourceCandidates) {
    const samples = decodeFloatStereo(resolve(packageRoot, candidate.sourceFile));
    const totalFrames = Math.floor(samples.length / channels);
    const barFrames = Math.round(barSeconds * sampleRate);
    const leadFrames = Math.min(barFrames * 4, Math.max(0, totalFrames - windowFrames));
    const lastStart = Math.max(0, totalFrames - windowFrames - Math.min(barFrames * 2, leadFrames));
    const starts = [];
    for (let start = leadFrames; start <= lastStart; start += barFrames) starts.push(start);
    if (!starts.length) starts.push(Math.max(0, Math.floor((totalFrames - windowFrames) / 2)));

    for (const startFrame of starts) {
      if (startFrame + windowFrames > totalFrames) continue;
      scored.push({
        candidate,
        samples,
        startFrame,
        windowFrames,
        ...scoreWindow(samples, startFrame, windowFrames),
      });
    }
  }

  scored.sort((left, right) => left.score - right.score || left.startFrame - right.startFrame);
  if (!scored.length) throw new Error(`No valid loop windows for ${asset.id}`);
  return { selected: scored[0], ranked: scored.slice(0, 5), barSeconds, windowSeconds };
}

function buildLoop(samples, startFrame, windowFrames) {
  const fadeFrames = Math.round(sampleRate * crossfadeMs / 1000);
  const outputFrames = windowFrames - fadeFrames;
  const output = new Float64Array(outputFrames * channels);
  const bodyFrames = windowFrames - fadeFrames * 2;

  for (let frame = 0; frame < bodyFrames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      output[(frame * channels) + channel] =
        samples[((startFrame + fadeFrames + frame) * channels) + channel];
    }
  }

  for (let frame = 0; frame < fadeFrames; frame += 1) {
    const phase = frame / Math.max(1, fadeFrames - 1);
    const tailGain = Math.cos(phase * Math.PI / 2);
    const headGain = Math.sin(phase * Math.PI / 2);
    for (let channel = 0; channel < channels; channel += 1) {
      const tail = samples[((startFrame + windowFrames - fadeFrames + frame) * channels) + channel];
      const head = samples[((startFrame + frame) * channels) + channel];
      output[((bodyFrames + frame) * channels) + channel] = tail * tailGain + head * headGain;
    }
  }

  for (let channel = 0; channel < channels; channel += 1) {
    let mean = 0;
    for (let frame = 0; frame < outputFrames; frame += 1) mean += output[frame * channels + channel];
    mean /= outputFrames;
    for (let frame = 0; frame < outputFrames; frame += 1) output[frame * channels + channel] -= mean;
  }

  let peak = 0;
  for (const sample of output) peak = Math.max(peak, Math.abs(sample));
  const gain = peak > 0 ? Math.min(1, (10 ** (-6 / 20)) / peak) : 1;
  for (let index = 0; index < output.length; index += 1) output[index] *= gain;
  return output;
}

function writeStereoWave(path, samples) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * 2, 28);
  buffer.writeUInt16LE(channels * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataBytes, 40);
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1 - 1 / 32768, samples[index]));
    buffer.writeInt16LE(Math.round(value * 32768), 44 + index * 2);
  }
  writeFileSync(path, buffer);
}

function parseLoudnorm(stderr) {
  const matches = [...stderr.matchAll(/\{\s*"input_i"[\s\S]*?\}/g)];
  if (!matches.length) throw new Error(`Could not parse loudnorm output:\n${stderr}`);
  return JSON.parse(matches.at(-1)[0]);
}

function measureLoudness(path) {
  const result = run(ffmpeg, [
    "-hide_banner", "-nostats", "-i", path,
    "-af", `loudnorm=I=${targetLufs}:TP=${targetTruePeak}:LRA=7:print_format=json`,
    "-f", "null", "-",
  ]);
  return parseLoudnorm(result.stderr);
}

function normalizeLoudness(inputPath, outputPath, measured) {
  const filter = [
    `loudnorm=I=${targetLufs}`,
    `TP=${targetTruePeak}`,
    "LRA=7",
    `measured_I=${measured.input_i}`,
    `measured_TP=${measured.input_tp}`,
    `measured_LRA=${measured.input_lra}`,
    `measured_thresh=${measured.input_thresh}`,
    `offset=${measured.target_offset}`,
    "linear=true",
    "print_format=summary",
  ].join(":");
  run(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-n", "-i", inputPath,
    "-af", `${filter},aresample=${sampleRate}:dither_method=triangular_hp`,
    "-ar", String(sampleRate), "-ac", String(channels), "-c:a", "pcm_s16le", outputPath,
  ]);
}

function inspectWave(path) {
  const buffer = readFileSync(path);
  let offset = 12;
  let format;
  let dataOffset;
  let dataBytes;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const payload = offset + 8;
    if (id === "fmt ") {
      format = {
        audioFormat: buffer.readUInt16LE(payload),
        channels: buffer.readUInt16LE(payload + 2),
        sampleRate: buffer.readUInt32LE(payload + 4),
        byteRate: buffer.readUInt32LE(payload + 8),
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
  const sampleCount = Math.floor(dataBytes / 2);
  let peak = 0;
  let squared = 0;
  let seam = 0;
  const firstFrame = [];
  const lastFrame = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = buffer.readInt16LE(dataOffset + index * 2);
    peak = Math.max(peak, Math.abs(sample));
    squared += sample * sample;
  }
  for (let channel = 0; channel < channels; channel += 1) {
    const first = buffer.readInt16LE(dataOffset + channel * 2);
    const last = buffer.readInt16LE(dataOffset + (sampleCount - channels + channel) * 2);
    firstFrame.push(first);
    lastFrame.push(last);
    seam = Math.max(seam, Math.abs(first - last));
  }
  return {
    sampleRate: format.sampleRate,
    channels: format.channels,
    bitsPerSample: format.bitsPerSample,
    durationSeconds: Number((dataBytes / format.byteRate).toFixed(6)),
    samplePeakDbfs: Number(db(peak / 32768).toFixed(2)),
    rmsDbfs: Number(db(Math.sqrt(squared / sampleCount) / 32768).toFixed(2)),
    firstFrame,
    lastFrame,
    seamDeltaDbfs: Number(db(seam / 32768).toFixed(2)),
  };
}

const original = readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(original);
const version = getFfmpegVersion();
const tempRoot = mkdtempSync(join(tmpdir(), "jack-audio-music-v1-"));
let updated = original;
const summaries = [];

try {
  for (const asset of manifest.assets.filter((candidate) => candidate.id.startsWith("music."))) {
    const recipe = recipes[asset.id];
    if (!recipe) throw new Error(`Missing music recipe for ${asset.id}`);
    if (asset.masterCandidate) throw new Error(`${asset.id} already has masterCandidate evidence`);
    const outputPath = resolve(packageRoot, asset.file);
    if (existsSync(outputPath)) throw new Error(`Refusing to overwrite existing master: ${asset.file}`);

    const { selected, ranked, windowSeconds } = selectWindow(asset, recipe);
    const loop = buildLoop(selected.samples, selected.startFrame, selected.windowFrames);
    const prePath = join(tempRoot, `${asset.id}.pre.wav`);
    const normalizedPath = join(tempRoot, `${asset.id}.normalized.wav`);
    writeStereoWave(prePath, loop);
    const firstPass = measureLoudness(prePath);
    normalizeLoudness(prePath, normalizedPath, firstPass);
    const finalLoudness = measureLoudness(normalizedPath);
    const waveQa = inspectWave(normalizedPath);
    const clickFree = waveQa.seamDeltaDbfs <= -50;
    if (!clickFree) throw new Error(`${asset.id} loop seam ${waveQa.seamDeltaDbfs} dBFS exceeds -50 dBFS`);
    mkdirSync(dirname(outputPath), { recursive: true });
    copyFileSync(normalizedPath, outputPath, constants.COPYFILE_EXCL);
    const buffer = readFileSync(outputPath);
    const record = {
      file: asset.file,
      sha256: createHash("sha256").update(buffer).digest("hex").toUpperCase(),
      masteredAt,
      tool: "FFmpeg",
      toolVersion: version,
      selectedSource: {
        id: selected.candidate.id,
        sourceFile: selected.candidate.sourceFile,
        startSeconds: Number((selected.startFrame / sampleRate).toFixed(6)),
        selectedWindowSeconds: Number(windowSeconds.toFixed(6)),
        bpm: recipe.bpm,
        bars: recipe.bars,
        selectionMethod: "deterministic bar-grid scan minimizing one-second loudness variance, head/tail level mismatch, section trend, clipping, and near-silence",
        selectionScore: selected.score,
        rankedWindowCount: ranked.length,
      },
      edits: [
        `select ${recipe.bars} bar stable passage on a ${recipe.bpm} BPM grid`,
        "remove per-channel DC offset",
        `${crossfadeMs} ms equal-power end-to-start loop crossfade`,
        `two-pass EBU R128 normalization to ${targetLufs} LUFS-I with ${targetTruePeak} dBTP ceiling`,
        "high-pass triangular dither and export 48 kHz stereo 16-bit PCM WAV",
      ],
      qa: {
        ...waveQa,
        integratedLufs: Number(finalLoudness.input_i),
        loudnessRangeLu: Number(finalLoudness.input_lra),
        truePeakDbtp: Number(finalLoudness.input_tp),
        truePeakMeasurement: "FFmpeg loudnorm EBU R128 / oversampled true-peak analysis",
      },
      loopQa: { clickFree, crossfadeMs },
      reviewStatus: "awaiting-Mark-audible-review",
    };

    const linePattern = new RegExp(`^.*\\"id\\":\\"${asset.id.replaceAll(".", "\\.")}\\".*$`, "m");
    const match = updated.match(linePattern);
    if (!match) throw new Error(`Could not locate manifest row for ${asset.id}`);
    const replacement = match[0].replace(
      /,"commercialLicenseStatus"/,
      `,"masterCandidate":${JSON.stringify(record)},"commercialLicenseStatus"`,
    );
    updated = updated.replace(match[0], replacement);
    summaries.push({ id: asset.id, file: asset.file, ...record.selectedSource, ...record.qa, loopQa: record.loopQa });
  }

  writeFileSync(manifestPath, updated, "utf8");
  process.stdout.write(`${JSON.stringify({ mastered: summaries.length, ffmpegVersion: version, summaries }, null, 2)}\n`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

#!/usr/bin/env node

/**
 * Inspect or freeze baked root-bone translation in selected GLB clips.
 *
 * Blender's retargeted canine actions intentionally keep the glTF scene root
 * fixed, but the baked Hips channel can still carry donor locomotion.  This
 * post-export repair preserves every key time and rotation while replacing the
 * selected Hips translations with their first sample.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

function parseArgs(argv) {
  const options = { clips: [], input: "", output: "", write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--input") options.input = argv[++index] ?? "";
    else if (token === "--output") options.output = argv[++index] ?? "";
    else if (token === "--clips") options.clips = (argv[++index] ?? "").split(",").filter(Boolean);
    else if (token === "--write") options.write = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!options.input) throw new Error("--input is required");
  if (options.write && !options.output) throw new Error("--output is required with --write");
  return options;
}

function parseGlb(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) {
    throw new Error("Expected a glTF 2.0 GLB");
  }
  const declaredLength = bytes.readUInt32LE(8);
  if (declaredLength !== bytes.length) throw new Error("GLB length header mismatch");
  const jsonLength = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== JSON_CHUNK) throw new Error("Missing JSON chunk");
  const jsonStart = 20;
  const jsonEnd = jsonStart + jsonLength;
  const document = JSON.parse(bytes.subarray(jsonStart, jsonEnd).toString("utf8"));
  const binLength = bytes.readUInt32LE(jsonEnd);
  if (bytes.readUInt32LE(jsonEnd + 4) !== BIN_CHUNK) throw new Error("Missing BIN chunk");
  const binStart = jsonEnd + 8;
  if (binStart + binLength > bytes.length) throw new Error("BIN chunk exceeds GLB length");
  return { binStart, bytes, document };
}

function accessorLayout(glb, accessorIndex) {
  const accessor = glb.document.accessors[accessorIndex];
  const view = glb.document.bufferViews[accessor.bufferView];
  if (accessor.componentType !== 5126 || accessor.type !== "VEC3") {
    throw new Error(`Accessor ${accessorIndex} must be FLOAT VEC3`);
  }
  const elementBytes = 12;
  const stride = view.byteStride ?? elementBytes;
  if (stride < elementBytes) throw new Error(`Accessor ${accessorIndex} has invalid stride`);
  return {
    accessor,
    start: glb.binStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0),
    stride,
  };
}

function readVector(bytes, offset) {
  return [bytes.readFloatLE(offset), bytes.readFloatLE(offset + 4), bytes.readFloatLE(offset + 8)];
}

function findTranslationChannel(glb, animation, nodeName) {
  const channel = animation.channels.find((candidate) => {
    const target = candidate.target;
    return target.path === "translation" && glb.document.nodes[target.node]?.name === nodeName;
  });
  if (!channel) throw new Error(`${animation.name} is missing ${nodeName} translation`);
  return channel;
}

function inspectAndRepair(glb, clipNames, shouldWrite) {
  const reports = [];
  for (const clipName of clipNames) {
    const animation = glb.document.animations.find((candidate) => candidate.name === clipName);
    if (!animation) throw new Error(`Missing animation: ${clipName}`);
    const channel = findTranslationChannel(glb, animation, "Hips");
    const outputAccessor = animation.samplers[channel.sampler].output;
    const layout = accessorLayout(glb, outputAccessor);
    const first = readVector(glb.bytes, layout.start);
    const minimum = [...first];
    const maximum = [...first];
    for (let index = 0; index < layout.accessor.count; index += 1) {
      const offset = layout.start + index * layout.stride;
      const value = readVector(glb.bytes, offset);
      for (let axis = 0; axis < 3; axis += 1) {
        minimum[axis] = Math.min(minimum[axis], value[axis]);
        maximum[axis] = Math.max(maximum[axis], value[axis]);
        if (shouldWrite) glb.bytes.writeFloatLE(first[axis], offset + axis * 4);
      }
    }
    reports.push({ clip: clipName, first, keyCount: layout.accessor.count, maximum, minimum });
  }
  return reports;
}

const options = parseArgs(process.argv.slice(2));
const input = path.resolve(options.input);
const output = options.output ? path.resolve(options.output) : null;
const glb = parseGlb(await readFile(input));
const reports = inspectAndRepair(glb, options.clips, options.write);
if (options.write && output) await writeFile(output, glb.bytes);
console.log(JSON.stringify({ input, output, repaired: options.write, reports }, null, 2));

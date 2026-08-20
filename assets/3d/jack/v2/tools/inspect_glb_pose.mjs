#!/usr/bin/env node

/** Sample exact skinned vertex bounds for one GLB animation time. */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { AnimationMixer, SkinnedMesh, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

function parseArgs(argv) {
  const options = { clip: "", input: "", time: 0 };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--input") options.input = argv[++index] ?? "";
    else if (token === "--clip") options.clip = argv[++index] ?? "";
    else if (token === "--time") options.time = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!options.input || !options.clip || !Number.isFinite(options.time)) {
    throw new Error("--input, --clip, and numeric --time are required");
  }
  return options;
}

// The runtime GLB embeds textures, but pose inspection needs only geometry.
globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({ close() {}, height: 1, width: 1 });

const options = parseArgs(process.argv.slice(2));
const input = path.resolve(options.input);
const source = await readFile(input);
const arrayBuffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
const loader = new GLTFLoader();
const gltf = await new Promise((resolve, reject) => loader.parse(arrayBuffer, "", resolve, reject));
const clip = gltf.animations.find((candidate) => candidate.name === options.clip);
if (!clip) throw new Error(`Missing animation: ${options.clip}`);
const mixer = new AnimationMixer(gltf.scene);
const action = mixer.clipAction(clip);
action.play();
mixer.setTime(options.time);
gltf.scene.updateMatrixWorld(true);

const local = new Vector3();
const world = new Vector3();
const minimum = [Infinity, Infinity, Infinity];
const maximum = [-Infinity, -Infinity, -Infinity];
let minimumVertex = null;
const minimumByDominantBone = new Map();
let vertexCount = 0;
gltf.scene.traverse((object) => {
  if (!(object instanceof SkinnedMesh)) return;
  const positions = object.geometry.getAttribute("position");
  const skinIndices = object.geometry.getAttribute("skinIndex");
  const skinWeights = object.geometry.getAttribute("skinWeight");
  for (let index = 0; index < positions.count; index += 1) {
    object.getVertexPosition(index, local);
    world.copy(local).applyMatrix4(object.matrixWorld);
    const values = [world.x, world.y, world.z];
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis], values[axis]);
      maximum[axis] = Math.max(maximum[axis], values[axis]);
    }
    let dominantBone = "unskinned";
    const weights = [];
    if (skinIndices && skinWeights) {
      for (let slot = 0; slot < 4; slot += 1) {
        const boneIndex = skinIndices.getComponent(index, slot);
        const weight = skinWeights.getComponent(index, slot);
        weights.push({ bone: object.skeleton.bones[boneIndex]?.name ?? String(boneIndex), weight });
      }
      weights.sort((left, right) => right.weight - left.weight);
      dominantBone = weights[0]?.bone ?? dominantBone;
    }
    const currentBoneMinimum = minimumByDominantBone.get(dominantBone);
    if (!currentBoneMinimum || world.y < currentBoneMinimum.position[1]) {
      minimumByDominantBone.set(dominantBone, { position: values, vertex: index, weights });
    }
    if (minimumVertex === null || world.y < minimumVertex.position[1]) {
      minimumVertex = { mesh: object.name, position: values, vertex: index, weights };
    }
    vertexCount += 1;
  }
});
mixer.stopAllAction();
console.log(JSON.stringify({
  clip: options.clip,
  duration: clip.duration,
  input,
  maximum,
  minimum,
  minimumByDominantBone: Object.fromEntries([...minimumByDominantBone.entries()].sort()),
  minimumVertex,
  time: options.time,
  vertexCount,
}, null, 2));

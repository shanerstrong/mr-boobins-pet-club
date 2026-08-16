import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Buffer } from "node:buffer";
const rate = 8000;
function wav(name, notes, amplitude = 11000) {
  const samples = notes.flatMap(([freq, seconds]) =>
    Array.from({ length: Math.floor(rate * seconds) }, (_, i) =>
      Math.round(
        amplitude *
          Math.sin((i / rate) * Math.PI * 2 * freq) *
          (1 - i / (rate * seconds)),
      ),
    ),
  );
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((sample, index) => data.writeInt16LE(sample, index * 2));
  const header = Buffer.alloc(44);
  header.write("RIFF");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(join("assets", "audio", name), Buffer.concat([header, data]));
}
mkdirSync(join("assets", "audio"), { recursive: true });
wav("happy.wav", [
  [660, 0.08],
  [880, 0.1],
]);
wav("sleepy.wav", [
  [220, 0.16],
  [180, 0.16],
]);
wav("bark.wav", [
  [360, 0.07],
  [280, 0.07],
]);
wav("shower.wav", [
  [1320, 0.05],
  [980, 0.05],
  [1180, 0.05],
  [860, 0.05],
  [1040, 0.05],
  [760, 0.05],
]);
wav("sneeze.wav", [
  [240, 0.08],
  [920, 0.04],
  [540, 0.09],
]);
wav("huff.wav", [
  [170, 0.11],
  [135, 0.13],
]);
const playMelody = [
  [523, 0.16],
  [659, 0.16],
  [784, 0.16],
  [659, 0.16],
  [587, 0.16],
  [698, 0.16],
  [784, 0.16],
  [698, 0.16],
  [523, 0.16],
  [659, 0.16],
  [880, 0.16],
  [784, 0.16],
  [698, 0.16],
  [587, 0.16],
  [659, 0.16],
  [523, 0.16],
  [392, 0.16],
  [523, 0.16],
  [659, 0.16],
  [523, 0.16],
  [440, 0.16],
  [554, 0.16],
  [659, 0.16],
  [554, 0.16],
  [523, 0.16],
  [659, 0.16],
  [784, 0.16],
  [659, 0.16],
  [587, 0.16],
  [523, 0.16],
  [440, 0.16],
  [523, 0.16],
];
wav("music.wav", playMelody);
wav("music-play.wav", playMelody);
wav("music-idle.wav", [
  [262, 0.48],
  [0, 0.12],
  [330, 0.48],
  [0, 0.12],
  [392, 0.48],
  [0, 0.12],
  [330, 0.48],
  [0, 0.24],
  [294, 0.48],
  [0, 0.12],
  [349, 0.48],
  [0, 0.12],
  [392, 0.48],
  [0, 0.12],
  [262, 0.72],
  [0, 0.24],
], 4200);
wav("music-sleep.wav", [
  [262, 0.72],
  [196, 0.36],
  [220, 0.72],
  [165, 0.36],
  [247, 0.72],
  [185, 0.36],
  [220, 0.72],
  [165, 0.36],
  [196, 0.96],
  [0, 0.36],
], 3200);

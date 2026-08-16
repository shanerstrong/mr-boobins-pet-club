const { mkdirSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { Buffer } = require("node:buffer");

const modulePath = process.argv[2];
const outputDirectory = resolve(
  process.argv[3] || "assets/audio/v1/ui",
);

if (!modulePath) {
  throw new Error(
    "Usage: node scripts/generate-audio-ui-v1.cjs <path-to-jsfxr/sfxr.js> [output-directory]",
  );
}

const { Params, SoundEffect, waveforms } = require(resolve(modulePath));

const sampleRate = 44100;
const envelopeSeconds = (seconds) =>
  Math.sqrt((seconds * sampleRate) / 100000);
const frequencyHz = (frequency) =>
  Math.sqrt((frequency * 100) / (8 * sampleRate) - 0.001);

const recipes = [
  {
    file: "ui-command-selected.v1.wav",
    parameters: {
      frequency: 520,
      frequencyRamp: 0.045,
      attack: 0.003,
      sustain: 0.045,
      sustainPunch: 0.08,
      decay: 0.11,
    },
  },
  {
    file: "ui-tap.v1.wav",
    parameters: {
      frequency: 410,
      frequencyRamp: -0.025,
      attack: 0.002,
      sustain: 0.018,
      sustainPunch: 0,
      decay: 0.055,
    },
  },
  {
    file: "ui-open.v1.wav",
    parameters: {
      frequency: 430,
      frequencyRamp: 0.1,
      attack: 0.004,
      sustain: 0.055,
      sustainPunch: 0.04,
      decay: 0.17,
    },
  },
  {
    file: "ui-close.v1.wav",
    parameters: {
      frequency: 720,
      frequencyRamp: -0.11,
      attack: 0.004,
      sustain: 0.05,
      sustainPunch: 0.03,
      decay: 0.16,
    },
  },
  {
    file: "ui-confirm.v1.wav",
    parameters: {
      frequency: 610,
      frequencyRamp: 0.015,
      attack: 0.004,
      sustain: 0.085,
      sustainPunch: 0.08,
      decay: 0.2,
      arpeggioAmount: 0.28,
      arpeggioSpeed: 0.68,
    },
  },
];

mkdirSync(outputDirectory, { recursive: true });

for (const recipe of recipes) {
  const parameters = new Params();
  parameters.wave_type = waveforms.SINE;
  parameters.p_env_attack = envelopeSeconds(recipe.parameters.attack);
  parameters.p_env_sustain = envelopeSeconds(recipe.parameters.sustain);
  parameters.p_env_punch = recipe.parameters.sustainPunch;
  parameters.p_env_decay = envelopeSeconds(recipe.parameters.decay);
  parameters.p_base_freq = frequencyHz(recipe.parameters.frequency);
  parameters.p_freq_ramp = recipe.parameters.frequencyRamp;
  parameters.p_arp_mod = recipe.parameters.arpeggioAmount || 0;
  parameters.p_arp_speed = recipe.parameters.arpeggioSpeed || 0;
  parameters.sound_vol = Math.log1p(0.12);
  parameters.sample_rate = sampleRate;
  parameters.sample_size = 16;

  const rendered = new SoundEffect(parameters).generate();
  const encoded = rendered.dataURI.split(",", 2)[1];
  writeFileSync(resolve(outputDirectory, recipe.file), Buffer.from(encoded, "base64"));
}

process.stdout.write(`${JSON.stringify(recipes, null, 2)}\n`);

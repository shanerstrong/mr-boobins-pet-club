import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { TextDecoder } from "node:util";

const preservationManifestPath = "docs/production/V0.6-V0.8_PRESERVATION_MANIFEST.json";
const rawManifestPath = "preservation-staging/20260816T134500Z-baseline-text-originals/baseline-text-originals-manifest.private.json";
const outputPath = "docs/production/V0.6-V0.8_TEXT_NORMALIZATION.json";
const decoder = new TextDecoder("utf-8", { fatal: true });
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const blankEofPaths = new Set([
  "assets/3d/jack/tools/build_hero_geometry.py",
  "assets/3d/jack/tools/receive_meshy_bridge.py",
  "assets/3d/jack/tools/render_evidence.py",
  "assets/3d/jack/tools/render_videos.py",
  "assets/3d/jack/tools/validate_blockout.py",
  "assets/3d/jack/tools/validate_character.py",
  "assets/3d/jack/v2/source/third-party/quaternius-ultimate-animated-animals-cc0/License.txt",
  "docs/audits/2026-08-14-3d-jack-pass1.md",
]);
const markdownHardBreakPaths = new Map([
  ["docs/GAME_PRODUCTION_PLAN.md", [3, 4]],
  ["docs/audits/2026-08-14-3d-jack-pass1.md", [7]],
  ["docs/production/V0.6-V0.8_CHECKPOINT_REPORT.md", [3, 4]],
]);
const singleTrailingSpacePaths = new Map([
  ["assets/3d/jack/v2/source/third-party/quaternius-ultimate-animated-animals-cc0/License.txt", [9]],
]);

if (existsSync(outputPath)) throw new Error(`Refusing to overwrite normalization record: ${outputPath}`);
const preservation = JSON.parse(readFileSync(preservationManifestPath, "utf8"));
const remote = preservation.baselineTextOriginals;
if (remote?.status !== "remote-verified" || remote?.remoteVerification?.method !== "authenticated-download-sha256") {
  throw new Error("Raw baseline text originals do not yet have authenticated-download preservation proof.");
}
if (!existsSync(rawManifestPath)) throw new Error(`Missing raw private manifest: ${rawManifestPath}`);
const rawManifestBytes = readFileSync(rawManifestPath);
if (sha256(rawManifestBytes) !== remote.manifest.sha256 || statSync(rawManifestPath).size !== remote.manifest.bytes) {
  throw new Error("Raw private manifest no longer matches the repository-safe preservation record.");
}
const rawManifest = JSON.parse(rawManifestBytes.toString("utf8"));
if (rawManifest.memberCount !== 21 || rawManifest.members.length !== 21) throw new Error("Raw private manifest must contain exactly 21 members.");

const planned = [];
for (const raw of rawManifest.members) {
  const path = raw.path.replaceAll("\\", "/");
  const bytes = readFileSync(path);
  if (bytes.length !== raw.bytes || sha256(bytes) !== raw.sha256) throw new Error(`Raw file drift before normalization: ${path}`);
  const originalText = decoder.decode(bytes);
  let text = originalText.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const transformations = [];
  const crlfCount = (originalText.match(/\r\n/g) ?? []).length;
  const bareCrCount = (originalText.replaceAll("\r\n", "").match(/\r/g) ?? []).length;
  if (crlfCount || bareCrCount) transformations.push({ type: "line-endings-to-lf", crlfCount, bareCrCount });

  const lines = text.split("\n");
  for (const lineNumber of markdownHardBreakPaths.get(path) ?? []) {
    const index = lineNumber - 1;
    if (!lines[index]?.endsWith("  ") || lines[index].endsWith("   ")) throw new Error(`Expected exact two-space Markdown hard break at ${path}:${lineNumber}`);
    lines[index] = `${lines[index].slice(0, -2)}<br>`;
    transformations.push({ type: "markdown-hard-break-to-br", line: lineNumber });
  }
  for (const lineNumber of singleTrailingSpacePaths.get(path) ?? []) {
    const index = lineNumber - 1;
    if (!lines[index]?.endsWith(" ") || lines[index].endsWith("  ")) throw new Error(`Expected exact single trailing space at ${path}:${lineNumber}`);
    lines[index] = lines[index].slice(0, -1);
    transformations.push({ type: "single-trailing-space-removed", line: lineNumber });
  }
  text = lines.join("\n");

  if (blankEofPaths.has(path)) {
    const match = text.match(/\n+$/);
    const newlineCount = match?.[0].length ?? 0;
    if (newlineCount !== 2) throw new Error(`Expected exactly one blank line at EOF in ${path}; found ${newlineCount} terminal newlines`);
    text = `${text.slice(0, -newlineCount)}\n`;
    transformations.push({ type: "blank-line-at-eof-removed", removedNewlines: 1 });
  }

  if (!transformations.length) throw new Error(`Approved path has no bounded normalization: ${path}`);
  const normalizedBytes = Buffer.from(text, "utf8");
  planned.push({
    path,
    rawBytes: raw.bytes,
    rawSha256: raw.sha256,
    normalizedBytes: normalizedBytes.length,
    normalizedSha256: sha256(normalizedBytes),
    transformations,
    bytes: normalizedBytes,
  });
}

if (planned.length !== 21) throw new Error(`Expected 21 planned normalizations, found ${planned.length}`);
for (const item of planned) writeFileSync(item.path, item.bytes);

const record = {
  schemaVersion: 1,
  kind: "baseline-text-raw-to-normalized-mapping",
  generatedAt: new Date().toISOString(),
  preservationManifest: preservationManifestPath,
  rawPreservation: {
    stagingRoot: remote.stagingRoot,
    bundleName: remote.bundle.name,
    bundleBytes: remote.bundle.bytes,
    bundleSha256: remote.bundle.sha256,
    bundleDriveFileId: remote.bundle.driveFileId,
    manifestName: remote.manifest.name,
    manifestBytes: remote.manifest.bytes,
    manifestSha256: remote.manifest.sha256,
    manifestDriveFileId: remote.manifest.driveFileId,
    remoteVerification: remote.remoteVerification,
  },
  memberCount: planned.length,
  entries: planned.map(({ bytes: _bytes, ...item }) => item),
};
writeFileSync(outputPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");

console.log(`Normalized ${planned.length} preserved text files.`);
console.log(`Wrote ${outputPath}`);

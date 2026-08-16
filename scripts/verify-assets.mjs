import { execFileSync } from "node:child_process";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, posix, relative, resolve } from "node:path";
import process from "node:process";

const root = process.cwd();
const policyPath = "docs/production/asset-policy.v1.json";
const inventoryPath = "docs/production/V0.6-V0.8_PREPOLICY_INVENTORY.json";
const classificationPath = "docs/production/V0.6-V0.8_ASSET_CLASSIFICATION.json";
const checkpointPath = "docs/production/V0.6-V0.8_CHECKPOINT_CANDIDATE.json";
const preservationPath = "docs/production/V0.6-V0.8_PRESERVATION_MANIFEST.json";
const normalizationPath = "docs/production/V0.6-V0.8_TEXT_NORMALIZATION.json";
const selfPath = "scripts/verify-assets.mjs";

const normalize = (value) => value.replaceAll("\\", "/").replace(/^\.\//, "");
const absolute = (value) => resolve(root, value);
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const fileHash = (file) => sha256(readFileSync(absolute(file)));

function walk(directory) {
  if (!existsSync(absolute(directory))) return [];
  const results = [];
  const visit = (current) => {
    for (const entry of readdirSync(absolute(current), { withFileTypes: true })) {
      const child = normalize(posix.join(current, entry.name));
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile()) results.push(child);
    }
  };
  visit(normalize(directory));
  return results.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function recordFiles(paths) {
  return [...new Set(paths.map(normalize))]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .filter((file) => existsSync(absolute(file)) && statSync(absolute(file)).isFile())
    .map((file) => ({
      path: file,
      bytes: statSync(absolute(file)).size,
      sha256: fileHash(file),
    }));
}

function aggregate(records) {
  const body = records.map((record) => `${record.path}\t${record.bytes}\t${record.sha256}\n`).join("");
  return sha256(Buffer.from(body, "utf8"));
}

function scope(name, selection, paths) {
  const files = recordFiles(paths);
  return {
    name,
    selection,
    fileCount: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    aggregateSha256: aggregate(files),
    files,
  };
}

function gitOutput(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function gitPaths(args) {
  const output = execFileSync("git", args, { cwd: root });
  return output
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map(normalize);
}

function capturePrepolicy() {
  const excluded = new Set([selfPath, inventoryPath]);
  const dirtyPaths = gitPaths(["ls-files", "--modified", "--others", "--exclude-standard", "-z"])
    .filter((file) => !excluded.has(file));
  const inventory = {
    schemaVersion: 1,
    kind: "pre-policy-worktree-inventory",
    capturedAt: new Date().toISOString(),
    repositoryRootName: root.split(/[\\/]/).at(-1),
    gitHead: gitOutput(["rev-parse", "--verify", "HEAD"]),
    hashAlgorithm: "sha256",
    aggregateFormat: "ordinal-case-sensitive path<TAB>bytes<TAB>lowercase-sha256<LF>, hashed as UTF-8",
    excludedFromDirtyScope: [...excluded].sort(),
    scopes: {
      dirty: scope("dirty", "git ls-files --modified --others --exclude-standard -z, excluding this capture tool and output", dirtyPaths),
      assets: scope("assets", "every regular file recursively under assets/", walk("assets")),
      evidence: scope("evidence", "every regular file recursively under evidence/", walk("evidence")),
    },
    limitations: [
      "This index records file identity and size; it is not a backup and contains no file contents.",
      "Ignored files outside assets/ and evidence/ are not included in the dirty scope.",
      "Private or credential-like contents were not opened for classification; filename checks are reported separately.",
      "The capture predates the asset-policy edits and is retained to prove what the sole writer received.",
    ],
  };
  writeFileSync(absolute(inventoryPath), `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  console.log(`Wrote ${inventoryPath}`);
  for (const current of Object.values(inventory.scopes)) {
    console.log(`${current.name}: ${current.fileCount} files, ${current.bytes} bytes, ${current.aggregateSha256}`);
  }
}

function globRegex(glob) {
  let pattern = "^";
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index];
    const next = glob[index + 1];
    if (character === "*" && next === "*") {
      if (glob[index + 2] === "/") {
        pattern += "(?:.*/)?";
        index += 2;
      } else {
        pattern += ".*";
        index += 1;
      }
    } else if (character === "*") {
      pattern += "[^/]*";
    } else if (character === "?") {
      pattern += "[^/]";
    } else {
      pattern += character.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }
  return new RegExp(`${pattern}$`);
}

function matches(file, globs = []) {
  return globs.some((glob) => globRegex(normalize(glob)).test(file));
}

function classify(file, policy) {
  const rule = policy.classificationRules.find((candidate) => matches(file, candidate.pathGlobs));
  return rule ?? null;
}

function sourceFiles() {
  const roots = ["App.tsx", "app.config.ts", ...walk("src")];
  return roots.filter((file) => [".ts", ".tsx", ".js", ".jsx"].includes(extname(file)));
}

function runtimeAssetReferences() {
  const references = [];
  const assetExpression = /(?:require\(|from\s+|import\s*\()\s*["']([^"']+\.(?:glb|gltf|png|jpe?g|wav|mp3|ogg|webp|svg))["']/g;
  for (const source of sourceFiles()) {
    const content = readFileSync(absolute(source), "utf8");
    for (const match of content.matchAll(assetExpression)) {
      const imported = match[1];
      if (!imported.startsWith(".")) continue;
      const resolved = normalize(relative(root, resolve(root, dirname(source), imported)));
      references.push({ source, imported, resolved });
    }
  }
  return references.sort((a, b) => a.resolved.localeCompare(b.resolved));
}

function isLfsPointer(file) {
  const size = statSync(absolute(file)).size;
  if (size > 1024) return false;
  return readFileSync(absolute(file), "utf8").startsWith("version https://git-lfs.github.com/spec/v1\n");
}

function directorySummary(directory) {
  const files = walk(directory);
  return {
    path: `${normalize(directory).replace(/\/$/, "")}/`,
    fileCount: files.length,
    bytes: files.reduce((sum, file) => sum + statSync(absolute(file)).size, 0),
    reason: "ignored generated/dependency output; excluded from the checkpoint candidate",
  };
}

function verify() {
  const errors = [];
  const warnings = [];
  const assert = (condition, message) => {
    if (!condition) errors.push(message);
  };

  assert(existsSync(absolute(policyPath)), `Missing required policy manifest: ${policyPath}`);
  assert(existsSync(absolute(inventoryPath)), `Missing required pre-policy inventory: ${inventoryPath}`);
  if (errors.length) return finish(errors, warnings);

  let policy;
  let inventory;
  let normalization;
  try {
    policy = JSON.parse(readFileSync(absolute(policyPath), "utf8"));
    inventory = JSON.parse(readFileSync(absolute(inventoryPath), "utf8"));
    normalization = existsSync(absolute(normalizationPath)) ? JSON.parse(readFileSync(absolute(normalizationPath), "utf8")) : null;
  } catch (error) {
    errors.push(`Policy/inventory JSON parse failure: ${error.message}`);
    return finish(errors, warnings);
  }

  assert(policy.schemaVersion === 1, `${policyPath} must use schemaVersion 1`);
  assert(inventory.schemaVersion === 1, `${inventoryPath} must use schemaVersion 1`);
  assert(inventory.hashAlgorithm === "sha256", `${inventoryPath} must use SHA-256`);
  const normalizationByPath = new Map((normalization?.entries ?? []).map((entry) => [normalize(entry.path), entry]));

  for (const [name, captured] of Object.entries(inventory.scopes ?? {})) {
    assert(Array.isArray(captured.files), `Inventory scope ${name} must contain files[]`);
    if (!Array.isArray(captured.files)) continue;
    assert(captured.fileCount === captured.files.length, `Inventory scope ${name} fileCount mismatch`);
    assert(captured.bytes === captured.files.reduce((sum, file) => sum + file.bytes, 0), `Inventory scope ${name} byte total mismatch`);
    assert(captured.aggregateSha256 === aggregate(captured.files), `Inventory scope ${name} aggregate hash mismatch`);
  }

  for (const scopeName of ["assets", "evidence"]) {
    const current = scope(scopeName, `current ${scopeName}`, walk(scopeName));
    const captured = inventory.scopes?.[scopeName];
    assert(Boolean(captured), `Missing inventory scope: ${scopeName}`);
    if (!captured) continue;
    const currentByPath = new Map(current.files.map((file) => [file.path, file]));
    for (const original of captured.files) {
      const found = currentByPath.get(original.path);
      assert(Boolean(found), `Captured ${scopeName} file is missing: ${original.path}`);
      if (!found) continue;
      if (found.bytes !== original.bytes || found.sha256 !== original.sha256) {
        const mapped = normalizationByPath.get(original.path);
        assert(Boolean(mapped), `Captured ${scopeName} file drifted without an approved normalization mapping: ${original.path}`);
        if (mapped) {
          assert(mapped.rawBytes === original.bytes && mapped.rawSha256 === original.sha256, `Normalization raw identity mismatch: ${original.path}`);
          assert(mapped.normalizedBytes === found.bytes && mapped.normalizedSha256 === found.sha256, `Normalization current identity mismatch: ${original.path}`);
        }
      }
    }
    const capturedPaths = new Set(captured.files.map((file) => file.path));
    const extras = current.files.filter((file) => !capturedPaths.has(file.path));
    if (scopeName === "assets") {
      const allowedCopies = new Set((policy.canonicalCopies ?? []).map((mapping) => normalize(mapping.copy)));
      assert(extras.length === allowedCopies.size, `Unexpected post-inventory asset count: expected ${allowedCopies.size}, found ${extras.length}`);
      for (const extra of extras) assert(allowedCopies.has(extra.path), `Unexpected post-inventory asset: ${extra.path}`);
      for (const allowed of allowedCopies) assert(extras.some((extra) => extra.path === allowed), `Missing approved canonical copy: ${allowed}`);
    } else {
      assert(extras.length === 0, `Unexpected post-inventory evidence files: ${extras.map((file) => file.path).join(", ")}`);
    }
  }

  for (const required of policy.requiredFiles ?? []) {
    assert(existsSync(absolute(required)), `Missing required manifest/license/provenance file: ${required}`);
  }

  for (const jsonFile of policy.parseableJson ?? []) {
    try {
      const parsed = JSON.parse(readFileSync(absolute(jsonFile), "utf8"));
      assert(Number.isInteger(parsed.schemaVersion) && parsed.schemaVersion > 0, `${jsonFile} must declare a positive integer schemaVersion`);
    } catch (error) {
      errors.push(`Invalid JSON manifest ${jsonFile}: ${error.message}`);
    }
  }

  for (const declaration of policy.provenanceDeclarations ?? []) {
    assert(Boolean(declaration.scope && declaration.record && declaration.status), "Each provenance declaration needs scope, record, and status");
    assert(existsSync(absolute(declaration.record)), `Missing provenance/license record for ${declaration.scope}: ${declaration.record}`);
    if (existsSync(absolute(declaration.record))) {
      assert(statSync(absolute(declaration.record)).size > 0, `Empty provenance/license record: ${declaration.record}`);
    }
  }

  for (const mapping of policy.canonicalCopies ?? []) {
    assert(existsSync(absolute(mapping.source)), `Missing canonical source original: ${mapping.source}`);
    assert(existsSync(absolute(mapping.copy)), `Missing canonical source copy: ${mapping.copy}`);
    if (!existsSync(absolute(mapping.source)) || !existsSync(absolute(mapping.copy))) continue;
    const source = { bytes: statSync(absolute(mapping.source)).size, sha256: fileHash(mapping.source) };
    const copy = { bytes: statSync(absolute(mapping.copy)).size, sha256: fileHash(mapping.copy) };
    assert(source.bytes === copy.bytes && source.sha256 === copy.sha256, `Canonical copy is not byte-identical: ${mapping.copy}`);
    const filterAttribute = gitOutput(["check-attr", "filter", "--", mapping.copy]);
    assert(filterAttribute.endsWith(": filter: lfs"), `Canonical copy is not path-scoped to Git LFS: ${mapping.copy}`);
    const rule = classify(mapping.copy, policy);
    assert(rule?.tier === "lfs-ready-local", `Canonical copy has wrong classification: ${mapping.copy}`);
  }

  if (existsSync(absolute(preservationPath))) {
    const preservation = JSON.parse(readFileSync(absolute(preservationPath), "utf8"));
    assert(preservation.schemaVersion === 1, `${preservationPath} must use schemaVersion 1`);
    assert(preservation.googleDrive?.providerDecision === "google-drive-only-no-icloud", "Preservation provider must remain Google Drive only");
    for (const folder of [preservation.googleDrive?.root, preservation.googleDrive?.coldArchiveFolder, preservation.googleDrive?.privateBackupFolder]) {
      assert(folder?.shared === false, "Preservation Drive folders must be recorded as not shared");
      assert(folder?.sourceVisibilityStatus === "not_shared", "Preservation Drive folders must record restricted visibility");
    }
    assert(preservation.gitLfs?.remoteUploadPerformed === false, "Do not claim a Git LFS upload before verified no-charge capacity and fetch-back proof");
    assert(preservation.gitLfs?.fetchBackVerificationPerformed === false, "Do not claim Git LFS fetch-back before it occurs");
    assert(preservation.originals?.deleted === false && preservation.originals?.moved === false && preservation.originals?.renamed === false && preservation.originals?.rewritten === false, "Preservation record must confirm original files remain untouched");

    const preservedCopies = new Map((preservation.canonicalCopies ?? []).map((entry) => [normalize(entry.copy), entry]));
    assert(preservedCopies.size === (policy.canonicalCopies ?? []).length, "Preservation manifest canonical-copy count mismatch");
    for (const mapping of policy.canonicalCopies ?? []) {
      const entry = preservedCopies.get(normalize(mapping.copy));
      assert(Boolean(entry), `Preservation manifest missing canonical copy: ${mapping.copy}`);
      if (!entry || !existsSync(absolute(mapping.copy))) continue;
      assert(entry.bytes === statSync(absolute(mapping.copy)).size, `Preservation canonical-copy size mismatch: ${mapping.copy}`);
      assert(entry.sha256 === fileHash(mapping.copy), `Preservation canonical-copy hash mismatch: ${mapping.copy}`);
      assert(entry.expectedLfsOid === `sha256:${entry.sha256}`, `Preservation canonical-copy LFS OID mismatch: ${mapping.copy}`);
    }

    const verifyStagedFile = (directory, entry, label) => {
      const file = normalize(posix.join(directory, entry.name));
      assert(existsSync(absolute(file)), `Missing ${label}: ${file}`);
      if (!existsSync(absolute(file))) return;
      assert(entry.bytes === statSync(absolute(file)).size, `${label} size mismatch: ${file}`);
      assert(entry.sha256 === fileHash(file), `${label} hash mismatch: ${file}`);
    };
    const cold = preservation.coldArchive;
    assert(cold?.memberCount === 291 && cold?.originalBytes === 536212240, "Cold-archive approved scope drifted");
    assert(cold?.bundleCount === cold?.bundles?.length, "Cold-archive bundle count mismatch");
    assert(cold?.bundleBytes === cold?.bundles?.reduce((sum, entry) => sum + entry.bytes, 0), "Cold-archive bundle byte total mismatch");
    for (const entry of cold?.bundles ?? []) {
      assert(entry.bytes <= 45000000, `Cold-archive bundle exceeds authenticated-download verification limit: ${entry.name}`);
      verifyStagedFile(cold.currentStagingRoot, entry, "cold-archive bundle");
    }
    verifyStagedFile(cold.currentStagingRoot, cold.manifest, "cold-archive private manifest");
    if (cold?.status === "remote-verified") {
      assert(cold.manifest.driveState === "uploaded-authenticated-download-sha256-verified", "Cold manifest lacks authenticated download proof");
      assert(cold.bundles.every((entry) => entry.driveFileId && entry.driveState === "uploaded-authenticated-download-sha256-verified"), "One or more cold bundles lack authenticated download proof");
      assert(cold.remoteVerification?.method === "authenticated-download-sha256" && cold.remoteVerification?.manifestMatched === true && cold.remoteVerification?.bundleCountMatched === cold.bundleCount && cold.remoteVerification?.allBundleSizesAndHashesMatched === true, "Cold archive remote-verification record is incomplete");
      assert(cold.remoteVerification?.folderItemCount === cold.bundleCount + 2 && cold.remoteVerification?.folderItemsNotShared === cold.remoteVerification?.folderItemCount, "Cold archive restricted-folder readback count mismatch");
    }

    const privateBackup = preservation.privateBackup;
    assert(privateBackup?.privateMemberCount === 59 && privateBackup?.canonicalDefenseInDepthMemberCount === 5 && privateBackup?.totalMemberCount === 64, "Private-backup approved scope drifted");
    verifyStagedFile(privateBackup.stagingRoot, privateBackup.bundle, "private-backup bundle");
    verifyStagedFile(privateBackup.stagingRoot, privateBackup.manifest, "private-backup private manifest");
    if (privateBackup?.status === "remote-verified") {
      assert(privateBackup.bundle.driveState === "uploaded-authenticated-download-sha256-verified", "Private bundle lacks authenticated download proof");
      assert(privateBackup.manifest.driveState === "uploaded-authenticated-download-sha256-verified", "Private manifest lacks authenticated download proof");
      assert(privateBackup.remoteVerification?.method === "authenticated-download-sha256" && privateBackup.remoteVerification?.bundleMatched === true && privateBackup.remoteVerification?.manifestMatched === true, "Private backup remote-verification record is incomplete");
    }

    const baselineText = preservation.baselineTextOriginals;
    assert(baselineText?.status === "remote-verified" && baselineText?.memberCount === 21, "Baseline text originals must have a 21-member verified preservation record");
    verifyStagedFile(baselineText.stagingRoot, baselineText.bundle, "baseline text originals bundle");
    verifyStagedFile(baselineText.stagingRoot, baselineText.manifest, "baseline text originals private manifest");
    assert(baselineText?.bundle?.driveState === "uploaded-authenticated-download-sha256-verified" && baselineText?.manifest?.driveState === "uploaded-authenticated-download-sha256-verified", "Baseline text originals lack authenticated download proof");
    assert(baselineText?.remoteVerification?.method === "authenticated-download-sha256" && baselineText?.remoteVerification?.bundleMatched === true && baselineText?.remoteVerification?.manifestMatched === true && baselineText?.remoteVerification?.parentMatched === true && baselineText?.remoteVerification?.shared === false && baselineText?.remoteVerification?.sourceVisibilityStatus === "not_shared", "Baseline text remote-verification record is incomplete");

    assert(normalization?.schemaVersion === 1 && normalization?.kind === "baseline-text-raw-to-normalized-mapping", "Missing or invalid baseline text normalization mapping");
    assert(normalization?.memberCount === 21 && normalizationByPath.size === 21, "Baseline text normalization mapping must contain 21 unique entries");
    const rawManifestPath = normalize(posix.join(baselineText.stagingRoot, baselineText.manifest.name));
    const rawManifest = JSON.parse(readFileSync(absolute(rawManifestPath), "utf8"));
    const rawByPath = new Map((rawManifest.members ?? []).map((entry) => [normalize(entry.path), entry]));
    assert(rawManifest.memberCount === 21 && rawByPath.size === 21, "Baseline text private manifest must contain 21 unique members");
    for (const [path, entry] of normalizationByPath) {
      const raw = rawByPath.get(path);
      assert(Boolean(raw), `Normalization path missing from raw preservation manifest: ${path}`);
      if (raw) assert(raw.bytes === entry.rawBytes && raw.sha256 === entry.rawSha256, `Normalization raw preservation mismatch: ${path}`);
      assert(existsSync(absolute(path)), `Normalized path is missing: ${path}`);
      if (existsSync(absolute(path))) {
        assert(statSync(absolute(path)).size === entry.normalizedBytes && fileHash(path) === entry.normalizedSha256, `Normalized path drifted: ${path}`);
        const text = readFileSync(absolute(path), "utf8");
        assert(!text.includes("\r"), `Normalized text must use LF only: ${path}`);
      }
      assert(Array.isArray(entry.transformations) && entry.transformations.length > 0, `Normalization entry lacks bounded transformations: ${path}`);
    }

    assert(Array.isArray(preservation.supersededStaging), "Superseded staging must be an explicit retained-set list");
    for (const superseded of preservation.supersededStaging ?? []) {
      assert(existsSync(absolute(superseded?.root ?? "")), "Superseded cold staging must remain present until a later cleanup approval");
      if (existsSync(absolute(superseded?.root ?? ""))) {
        const zipFiles = walk(superseded.root).filter((file) => extname(file).toLowerCase() === ".zip");
        assert(zipFiles.length === superseded.bundleCount, "Superseded cold staging bundle count mismatch");
        assert(zipFiles.reduce((sum, file) => sum + statSync(absolute(file)).size, 0) === superseded.bundleBytes, "Superseded cold staging bundle byte total mismatch");
      }
    }
  }

  const allAssets = [...walk("assets"), ...walk("evidence")];
  const classified = allAssets.map((file) => ({ file, rule: classify(file, policy) }));
  for (const item of classified) assert(Boolean(item.rule), `Unclassified asset/evidence file: ${item.file}`);

  const runtimeDeclared = new Map((policy.runtimeImports ?? []).map((item) => [normalize(item.path), item]));
  for (const runtime of runtimeDeclared.values()) {
    assert(existsSync(absolute(runtime.path)), `Missing declared runtime asset: ${runtime.path}`);
    if (!existsSync(absolute(runtime.path))) continue;
    const bytes = statSync(absolute(runtime.path)).size;
    assert(bytes <= runtime.maxBytes, `Runtime asset exceeds budget (${bytes} > ${runtime.maxBytes}): ${runtime.path}`);
    assert(!isLfsPointer(runtime.path), `Runtime asset is an unexpected LFS pointer: ${runtime.path}`);
    const rule = classify(runtime.path, policy);
    assert(rule?.tier === "normal-git", `Runtime asset must remain normal Git: ${runtime.path}`);
    const filterAttribute = gitOutput(["check-attr", "filter", "--", runtime.path]);
    assert(!filterAttribute.endsWith(": filter: lfs"), `Runtime asset unexpectedly has an LFS filter: ${runtime.path}`);
  }

  for (const reference of runtimeAssetReferences()) {
    assert(runtimeDeclared.has(reference.resolved), `Runtime asset import is not declared in policy: ${reference.source} -> ${reference.resolved}`);
    assert(!policy.forbiddenRuntimePathFragments.some((fragment) => reference.resolved.includes(fragment)), `Forbidden runtime import: ${reference.source} -> ${reference.resolved}`);
  }

  for (const candidate of sourceFiles()) {
    const content = readFileSync(absolute(candidate), "utf8");
    for (const forbidden of policy.forbiddenSourceText ?? []) {
      assert(!content.includes(forbidden), `Forbidden source reference ${JSON.stringify(forbidden)} in ${candidate}`);
    }
  }

  const scanFiles = gitPaths(["ls-files", "--cached", "--others", "--exclude-standard", "-z"])
    .filter((file) => existsSync(absolute(file)) && statSync(absolute(file)).isFile())
    .filter((file) => !file.startsWith("dist/") && !file.startsWith("node_modules/") && !file.startsWith(".expo/"));
  for (const file of scanFiles) {
    if (!isLfsPointer(file)) continue;
    assert(matches(file, policy.expectedLfsPointerGlobs ?? []), `Unexpected Git LFS pointer file: ${file}`);
  }

  const normalGit = classified.filter((item) => item.rule?.tier === "normal-git");
  for (const item of normalGit) {
    const bytes = statSync(absolute(item.file)).size;
    assert(bytes <= policy.budgets.ordinaryGitMaxBytes, `Oversized ordinary-Git file (${bytes} > ${policy.budgets.ordinaryGitMaxBytes}): ${item.file}`);
  }

  const trackedAssetPaths = new Set(gitPaths(["ls-files", "--cached", "-z", "--", "assets", "evidence"]));
  for (const file of trackedAssetPaths) {
    const rule = classify(file, policy);
    assert(rule?.tier === "normal-git" || isLfsPointer(file), `Tracked asset/evidence file conflicts with its non-Git disposition (${rule?.tier ?? "unclassified"}): ${file}`);
  }

  for (const set of policy.representativeEvidenceSets ?? []) {
    assert(set.paths.length <= set.maxFiles, `Evidence-retention limit exceeded for ${set.id}: ${set.paths.length} > ${set.maxFiles}`);
    for (const file of set.paths) {
      assert(existsSync(absolute(file)), `Missing representative evidence for ${set.id}: ${file}`);
      const rule = classify(file, policy);
      assert(rule?.tier === "normal-git", `Representative evidence must be normal Git (${set.id}): ${file}`);
    }
  }

  const groups = new Map();
  for (const item of classified) {
    if (!item.rule) continue;
    const existing = groups.get(item.rule.id) ?? { id: item.rule.id, tier: item.rule.tier, disposition: item.rule.disposition, fileCount: 0, bytes: 0, files: [] };
    existing.fileCount += 1;
    existing.bytes += statSync(absolute(item.file)).size;
    existing.files.push({ path: item.file, bytes: statSync(absolute(item.file)).size, sha256: fileHash(item.file) });
    groups.set(item.rule.id, existing);
  }
  const classification = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceInventory: inventoryPath,
    sourceInventoryAssetsSha256: inventory.scopes.assets.aggregateSha256,
    sourceInventoryEvidenceSha256: inventory.scopes.evidence.aggregateSha256,
    groups: [...groups.values()],
  };
  if (process.argv.includes("--write-classification")) {
    writeFileSync(absolute(classificationPath), `${JSON.stringify(classification, null, 2)}\n`, "utf8");
    console.log(`Wrote ${classificationPath}`);
  }

  if (process.argv.includes("--write-checkpoint")) {
    const classifiedByFile = new Map();
    for (const group of classification.groups) {
      for (const file of group.files) classifiedByFile.set(file.path, group);
    }
    const tracked = new Set(gitPaths(["ls-files", "--modified", "-z"]));
    const dirty = gitPaths(["ls-files", "--modified", "--others", "--exclude-standard", "-z"])
      .filter((file) => file !== checkpointPath);
    const groupsByDisposition = new Map([
      ["included", []],
      ["proposed-archive", []],
      ["local-only", []],
      ["unresolved", []],
      ["preservation-staging", []],
    ]);
    for (const file of dirty) {
      const assetGroup = classifiedByFile.get(file);
      let disposition = "included";
      if (file.startsWith("preservation-staging/")) disposition = "preservation-staging";
      else if (assetGroup?.tier?.startsWith("cold-archive")) disposition = "proposed-archive";
      else if (assetGroup?.tier?.startsWith("private-")) disposition = "local-only";
      else if (assetGroup?.tier?.startsWith("lfs-")) disposition = "unresolved";
      const item = {
        path: file,
        gitState: tracked.has(file) ? "tracked-modified" : "untracked",
        bytes: statSync(absolute(file)).size,
        sha256: fileHash(file),
        assetGroup: assetGroup?.id ?? null,
      };
      groupsByDisposition.get(disposition).push(item);
    }
    const summarize = (items) => ({
      fileCount: items.length,
      bytes: items.reduce((sum, file) => sum + file.bytes, 0),
      files: items,
    });
    const credentialPattern = /(^|\/)(\.env($|\.)|id_[rd]sa|credentials?|secrets?|service[-_.]?account|token|api[-_.]?key|private[-_.]?key|keystore|[^/]*\.(pem|p8|p12|jks|mobileprovision)$)/i;
    const credentialLikeFilenames = dirty.filter((file) => credentialPattern.test(file));
    const checkpoint = {
      schemaVersion: 1,
      kind: "checkpoint-candidate-index",
      generatedAt: new Date().toISOString(),
      gitHead: gitOutput(["rev-parse", "--verify", "HEAD"]),
      prepolicyInventory: inventoryPath,
      assetClassification: classificationPath,
      candidate: summarize(groupsByDisposition.get("included")),
      proposedArchive: summarize(groupsByDisposition.get("proposed-archive")),
      localOnly: summarize(groupsByDisposition.get("local-only")),
      unresolved: summarize(groupsByDisposition.get("unresolved")),
      preservationStaging: summarize(groupsByDisposition.get("preservation-staging")),
      selfIndexedCandidate: {
        path: checkpointPath,
        disposition: "included",
        hash: null,
        reason: "This deterministic index cannot contain its own stable SHA-256; all other candidate paths are hashed.",
      },
      ignoredExcludedRoots: ["node_modules", ".expo", "dist"].filter((directory) => existsSync(absolute(directory))).map(directorySummary),
      credentialLikeFilenames,
      limitations: [
        "Candidate means reviewed for a proposed checkpoint; nothing is staged or committed.",
        "Proposed-archive originals remain in place and excluded from the checkpoint; their current cold-archive bundles are authenticated-download verified in restricted Drive.",
        "Local-only/private originals remain in place and excluded from the checkpoint; their private backup is authenticated-download verified in restricted Drive.",
        "LFS-pending sources have not been converted and no LFS remote preservation has been verified.",
        "Preservation-staging bundles are generated local verification material and are excluded from the commit candidate without being ignored or deleted.",
      ],
    };
    writeFileSync(absolute(checkpointPath), `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
    console.log(`Wrote ${checkpointPath}`);
    console.log(`Checkpoint candidate: ${checkpoint.candidate.fileCount + 1} files (${checkpoint.candidate.bytes + Buffer.byteLength(JSON.stringify(checkpoint, null, 2) + "\n", "utf8")} bytes including self-index)`);
    console.log(`Proposed archive: ${checkpoint.proposedArchive.fileCount} files, ${checkpoint.proposedArchive.bytes} bytes`);
    console.log(`Local-only: ${checkpoint.localOnly.fileCount} files, ${checkpoint.localOnly.bytes} bytes`);
    console.log(`Unresolved LFS: ${checkpoint.unresolved.fileCount} files, ${checkpoint.unresolved.bytes} bytes`);
    console.log(`Preservation staging: ${checkpoint.preservationStaging.fileCount} files, ${checkpoint.preservationStaging.bytes} bytes`);
  }

  console.log("Asset classification summary:");
  for (const group of classification.groups) {
    console.log(`- ${group.id}: ${group.fileCount} files, ${group.bytes} bytes, ${group.tier}`);
  }
  finish(errors, warnings);
}

function finish(errors, warnings) {
  for (const warning of warnings) console.warn(`WARN: ${warning}`);
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    console.error(`Asset verification failed with ${errors.length} error(s).`);
    process.exitCode = 1;
  } else {
    console.log("Asset verification passed.");
  }
}

if (process.argv.includes("--capture-prepolicy")) capturePrepolicy();
else verify();

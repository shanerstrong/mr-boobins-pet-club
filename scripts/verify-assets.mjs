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
const evidenceRefreshPath = "docs/production/V0.6-V0.8_EVIDENCE_REFRESH.json";
const postBaselineIntakePath = "docs/production/POST_BASELINE_ASSET_INTAKE_2026-08-16.json";
const postBaselineDeltaPath = "docs/production/POST_BASELINE_ASSET_INTAKE_75_TO_95_DELTA_2026-08-16.json";
const postBaselineMasteredDeltaPath = "docs/production/POST_BASELINE_ASSET_INTAKE_95_TO_125_DELTA_2026-08-16.json";
const v4ManagedContextRefreshPath = "docs/production/V4_MANAGED_CONTEXT_REFRESH_2026-08-17.json";
const initialJournalAmbiguityRefreshPath = "docs/production/INITIAL_JOURNAL_AMBIGUITY_CONTEXT_REFRESH_2026-08-17.json";
const candidateEofNormalizationPath = "docs/production/SAFE_RETURN_CANDIDATE_EOF_NORMALIZATION_2026-08-17.json";
const safeReturnCandidatePath = "docs/production/SAFE_RETURN_CHECKPOINT_CANDIDATE.json";
const safeReturnCompanionReportPath = "docs/production/SAFE_RETURN_CHECKPOINT_REPORT.md";
const alphaInspectStatusRefreshPath = "docs/production/ALPHA_INSPECT_SAFE_RETURN_STATUS_REFRESH_2026-08-17.json";
const alphaInspectReviewFixRefreshPath = "docs/production/ALPHA_INSPECT_REVIEW_FIX_CONTEXT_REFRESH_2026-08-17.json";
const upContactShadowRefreshPath = "docs/production/UP_CONTACT_SHADOW_CONTEXT_REFRESH_2026-08-17.json";
const healthStatusMedicineRefreshPath = "docs/production/HEALTH_ATTENTION_STATUS_MEDICINE_CONTEXT_REFRESH_2026-08-18.json";
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

function pathAttributedGitBlobOid(file, buffer = readFileSync(absolute(file))) {
  return execFileSync("git", ["hash-object", `--path=${file}`, "--stdin"], {
    cwd: root,
    input: buffer,
    encoding: "utf8",
  }).trim();
}

function jpegDimensions(file) {
  const data = readFileSync(absolute(file));
  if (data.length < 12 || data[0] !== 0xff || data[1] !== 0xd8 || data[2] !== 0xff || data.toString("ascii", 6, 10) !== "JFIF") return null;
  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = data[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > data.length) return null;
    const length = data.readUInt16BE(offset);
    if (length < 2 || offset + length > data.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { width: data.readUInt16BE(offset + 5), height: data.readUInt16BE(offset + 3), signature: "jpeg-jfif" };
    }
    offset += length;
  }
  return null;
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
  let evidenceRefresh;
  let postBaselineIntake;
  let postBaselineDelta;
  let postBaselineMasteredDelta;
  let v4ManagedContextRefresh;
  let initialJournalAmbiguityRefresh;
  let candidateEofNormalization;
  let safeReturnCandidate;
  let alphaInspectStatusRefresh;
  let alphaInspectReviewFixRefresh;
  let upContactShadowRefresh;
  let healthStatusMedicineRefresh;
  try {
    policy = JSON.parse(readFileSync(absolute(policyPath), "utf8"));
    inventory = JSON.parse(readFileSync(absolute(inventoryPath), "utf8"));
    normalization = existsSync(absolute(normalizationPath)) ? JSON.parse(readFileSync(absolute(normalizationPath), "utf8")) : null;
    evidenceRefresh = existsSync(absolute(evidenceRefreshPath)) ? JSON.parse(readFileSync(absolute(evidenceRefreshPath), "utf8")) : null;
    postBaselineIntake = existsSync(absolute(postBaselineIntakePath)) ? JSON.parse(readFileSync(absolute(postBaselineIntakePath), "utf8")) : null;
    postBaselineDelta = existsSync(absolute(postBaselineDeltaPath)) ? JSON.parse(readFileSync(absolute(postBaselineDeltaPath), "utf8")) : null;
    postBaselineMasteredDelta = existsSync(absolute(postBaselineMasteredDeltaPath)) ? JSON.parse(readFileSync(absolute(postBaselineMasteredDeltaPath), "utf8")) : null;
    v4ManagedContextRefresh = existsSync(absolute(v4ManagedContextRefreshPath)) ? JSON.parse(readFileSync(absolute(v4ManagedContextRefreshPath), "utf8")) : null;
    initialJournalAmbiguityRefresh = existsSync(absolute(initialJournalAmbiguityRefreshPath)) ? JSON.parse(readFileSync(absolute(initialJournalAmbiguityRefreshPath), "utf8")) : null;
    candidateEofNormalization = existsSync(absolute(candidateEofNormalizationPath)) ? JSON.parse(readFileSync(absolute(candidateEofNormalizationPath), "utf8")) : null;
    safeReturnCandidate = existsSync(absolute(safeReturnCandidatePath)) ? JSON.parse(readFileSync(absolute(safeReturnCandidatePath), "utf8")) : null;
    alphaInspectStatusRefresh = existsSync(absolute(alphaInspectStatusRefreshPath)) ? JSON.parse(readFileSync(absolute(alphaInspectStatusRefreshPath), "utf8")) : null;
    alphaInspectReviewFixRefresh = existsSync(absolute(alphaInspectReviewFixRefreshPath)) ? JSON.parse(readFileSync(absolute(alphaInspectReviewFixRefreshPath), "utf8")) : null;
    upContactShadowRefresh = existsSync(absolute(upContactShadowRefreshPath)) ? JSON.parse(readFileSync(absolute(upContactShadowRefreshPath), "utf8")) : null;
    healthStatusMedicineRefresh = existsSync(absolute(healthStatusMedicineRefreshPath)) ? JSON.parse(readFileSync(absolute(healthStatusMedicineRefreshPath), "utf8")) : null;
  } catch (error) {
    errors.push(`Policy/inventory JSON parse failure: ${error.message}`);
    return finish(errors, warnings);
  }

  assert(policy.schemaVersion === 1, `${policyPath} must use schemaVersion 1`);
  assert(inventory.schemaVersion === 1, `${inventoryPath} must use schemaVersion 1`);
  assert(inventory.hashAlgorithm === "sha256", `${inventoryPath} must use SHA-256`);
  const normalizationByPath = new Map((normalization?.entries ?? []).map((entry) => [normalize(entry.path), entry]));
  const normalizationBaselineCommit = policy.baselineTextNormalization?.baselineCommit;
  const evidenceRefreshByPath = new Map((evidenceRefresh?.entries ?? []).map((entry) => [normalize(entry.path), entry]));
  const allowedEvidenceRefreshPaths = new Set((policy.evidenceRefresh?.allowedPaths ?? []).map(normalize));
  assert(policy.evidenceRefresh?.record === evidenceRefreshPath, `Asset policy must point to ${evidenceRefreshPath}`);
  assert(evidenceRefresh?.schemaVersion === 1, `${evidenceRefreshPath} must use schemaVersion 1`);
  assert(evidenceRefresh?.hashAlgorithm === "sha256", `${evidenceRefreshPath} must use SHA-256`);
  assert(evidenceRefresh?.sourceInventory === inventoryPath, `${evidenceRefreshPath} source inventory mismatch`);
  assert(evidenceRefresh?.sourceInventoryEvidenceSha256 === inventory.scopes?.evidence?.aggregateSha256, `${evidenceRefreshPath} inventory evidence hash mismatch`);
  assert(evidenceRefreshByPath.size === allowedEvidenceRefreshPaths.size, "Evidence refresh record/path count mismatch");
  const representativeEvidencePaths = new Set((policy.representativeEvidenceSets ?? []).flatMap((set) => set.paths.map(normalize)));
  const trackedEvidencePaths = new Set(gitPaths(["ls-files", "--cached", "-z", "--", "evidence"]));
  for (const [path, entry] of evidenceRefreshByPath) {
    assert(allowedEvidenceRefreshPaths.has(path), `Unapproved evidence refresh path: ${path}`);
    assert(representativeEvidencePaths.has(path), `Evidence refresh is not in a representative set: ${path}`);
    assert(trackedEvidencePaths.has(path), `Evidence refresh path is not tracked: ${path}`);
    assert(classify(path, policy)?.tier === "normal-git", `Evidence refresh path is not normal Git: ${path}`);
    try {
      const prior = execFileSync("git", ["show", `${evidenceRefresh.priorGitCommit}:${path}`], { cwd: root });
      assert(prior.length === entry.priorBytes && sha256(prior) === entry.priorSha256, `Evidence refresh baseline identity mismatch: ${path}`);
    } catch (error) {
      errors.push(`Evidence refresh baseline is not recoverable for ${path}: ${error.message}`);
    }
    assert(existsSync(absolute(path)), `Evidence refresh current file is missing: ${path}`);
    if (existsSync(absolute(path))) {
      assert(statSync(absolute(path)).size === entry.currentBytes && fileHash(path) === entry.currentSha256, `Evidence refresh current identity mismatch: ${path}`);
    }
  }
  for (const path of allowedEvidenceRefreshPaths) {
    assert(evidenceRefreshByPath.has(path), `Missing evidence refresh record: ${path}`);
  }

  const postBaselinePolicy = (policy.postBaselineIntakes ?? []).find((entry) => normalize(entry.record) === postBaselineIntakePath);
  const postBaselineDeltaPolicy = (policy.postBaselineIntakes ?? []).find((entry) => normalize(entry.record) === postBaselineDeltaPath);
  const postBaselineMasteredDeltaPolicy = (policy.postBaselineIntakes ?? []).find((entry) => normalize(entry.record) === postBaselineMasteredDeltaPath);
  const v4ManagedContextRefreshPolicies = policy.managedContextRefreshes ?? [];
  const v4ManagedContextRefreshPolicy = v4ManagedContextRefreshPolicies.find((entry) => normalize(entry.record) === v4ManagedContextRefreshPath);
  const initialJournalAmbiguityRefreshPolicy = v4ManagedContextRefreshPolicies.find((entry) => normalize(entry.record) === initialJournalAmbiguityRefreshPath);
  const v4ManagedContextTransitions = v4ManagedContextRefresh?.transitions ?? [];
  const v4ManagedContextTransitionByPath = new Map(v4ManagedContextTransitions.map((entry) => [normalize(entry.path), entry]));
  const initialJournalAmbiguityTransitions = initialJournalAmbiguityRefresh?.transitions ?? [];
  const initialJournalAmbiguityTransitionByPath = new Map(initialJournalAmbiguityTransitions.map((entry) => [normalize(entry.path), entry]));
  const initialJournalSupportingTransitions = initialJournalAmbiguityRefresh?.supportingTransitions ?? [];
  const initialJournalSupportingTransitionByPath = new Map(initialJournalSupportingTransitions.map((entry) => [normalize(entry.path), entry]));
  const candidateEofPolicies = policy.candidateEofNormalizations ?? [];
  const candidateEofPolicy = candidateEofPolicies.find((entry) => normalize(entry.record) === candidateEofNormalizationPath);
  const candidateEofTransitions = candidateEofNormalization?.transitions ?? [];
  const candidateEofTransitionByPath = new Map(candidateEofTransitions.map((entry) => [normalize(entry.path), entry]));
  const expectedV4ManagedContextTransitions = new Map([
    ["App.tsx", {
      prior: { bytes: 107337, sha256: "8db9fb4de855a4bf632df0c599a4075badcd9ab480ac1831815821a39a49994f", lastWriteTimeUtc: "2026-08-16T19:46:22.3869550Z" },
      current: { bytes: 112038, sha256: "0f9893b566288adaec6a1000b4e05c4c5103a0d37692430de08aabe09423e5c2", lastWriteTimeUtc: "2026-08-17T00:07:49.8424495Z" },
    }],
    ["src/persistence.ts", {
      prior: { bytes: 28174, sha256: "5d448dad68e5fecda993bff898df6af03bcee05e246d3ff8b067648de8aee8d2", lastWriteTimeUtc: null },
      current: { bytes: 36091, sha256: "15f6d5e3ba55d134e61a68738416ca4bb6cbfbe12fb474982d4d53aeb07b51ce", lastWriteTimeUtc: "2026-08-17T00:09:59.2553069Z" },
    }],
    ["src/persistence.test.ts", {
      prior: { bytes: 55113, sha256: "fe62003127c9173a6224fb178f11da56cdde3cd46c62b7343e75ce51cc4e2e86", lastWriteTimeUtc: null },
      current: { bytes: 64557, sha256: "59dba686857a8476c4d20420876db227865579e3d749511b11133471eead9d9a", lastWriteTimeUtc: "2026-08-17T00:10:28.8515728Z" },
    }],
  ]);
  const expectedInitialJournalAmbiguityTransitions = new Map([
    ["App.tsx", {
      prior: { bytes: 112038, sha256: "0f9893b566288adaec6a1000b4e05c4c5103a0d37692430de08aabe09423e5c2", lastWriteTimeUtc: "2026-08-17T00:07:49.8424495Z" },
      current: { bytes: 117794, sha256: "8262c0892427dd1929e1d5c5724c50c655fd1b28ca8f59c6411b0d735a7cdf2a", lastWriteTimeUtc: "2026-08-17T04:08:14.0072771Z", gitState: "tracked-modified" },
    }],
    ["src/persistence.ts", {
      prior: { bytes: 36091, sha256: "15f6d5e3ba55d134e61a68738416ca4bb6cbfbe12fb474982d4d53aeb07b51ce", lastWriteTimeUtc: "2026-08-17T00:09:59.2553069Z" },
      current: { bytes: 50476, sha256: "c409b047a6bcaf956cc85fa02fa654279d1b307d90080325c10514b9cffa1996", lastWriteTimeUtc: "2026-08-17T04:09:11.8985253Z", gitState: "tracked-modified" },
    }],
    ["src/persistence.test.ts", {
      prior: { bytes: 64557, sha256: "59dba686857a8476c4d20420876db227865579e3d749511b11133471eead9d9a", lastWriteTimeUtc: "2026-08-17T00:10:28.8515728Z" },
      current: { bytes: 78712, sha256: "f46584fe22378e5d93bb860cadeb5ecfb8e2d39344b96d030f8403d35677c8ca", lastWriteTimeUtc: "2026-08-17T04:12:39.9460748Z", gitState: "tracked-modified" },
    }],
  ]);
  const expectedInitialJournalSupportingTransitions = new Map([
    ["src/day-one-ui.ts", {
      prior: { bytes: 9252, sha256: "f824e895f7d13fa9fea57cedcf0b493fe8c254f69383a383be205d860a055a73", lastWriteTimeUtc: "2026-08-17T00:08:20.1041850Z" },
      current: { bytes: 12245, sha256: "bcd70a9dabc53ce5ba9d0793da328f5d26d3e1ce80481c5bc029bbebcd32481a", lastWriteTimeUtc: "2026-08-17T04:15:32.3725533Z", gitState: "untracked" },
    }],
    ["src/day-one-ui.test.ts", {
      prior: { bytes: 28643, sha256: "da507dc5513b44c3d904f70cd86daa79b7b514c822545cca32c7fb9e0ffc6fc5", lastWriteTimeUtc: "2026-08-17T00:12:00.2844630Z" },
      current: { bytes: 34797, sha256: "76788e0491dcd6735aed4e03499ca5a169a2cc28d5052444c55f9575e3e67466", lastWriteTimeUtc: "2026-08-17T04:13:54.6610198Z", gitState: "untracked" },
    }],
  ]);
  const safeReturnCommit = "372b82d6853259a2580e554ed2d869f65f1f5c87";
  const safeReturnParent = "9c8a82140d6116b29b0fa7444d9ba64e73e2baf4";
  const safeReturnCandidateSha256 = "3593f4ce5d26242472c379fe84ed2b186ed0080a4702b7b50ee9e0c8b71348e4";
  const postCommitContextPolicies = policy.postCommitContextRefreshes ?? [];
  const alphaInspectStatusPolicy = postCommitContextPolicies.find((entry) => normalize(entry.record) === alphaInspectStatusRefreshPath);
  const alphaInspectStatusGroups = alphaInspectStatusRefresh?.safeReturnCommit?.statusExpectationGroups ?? [];
  const alphaInspectStatusGroupsById = new Map(alphaInspectStatusGroups.map((entry) => [entry.id, entry]));
  const alphaInspectTransitionByPath = new Map((alphaInspectStatusRefresh?.authorizedWorkingTreeTransitions ?? []).map((entry) => [normalize(entry.path), entry]));
  const alphaInspectPolicyTransitionByPath = new Map((alphaInspectStatusPolicy?.authorizedTransitions ?? []).map((entry) => [normalize(entry.path), entry]));
  const reviewFixContextPolicies = policy.reviewFixContextRefreshes ?? [];
  const alphaInspectReviewFixPolicy = reviewFixContextPolicies.find((entry) => normalize(entry.record) === alphaInspectReviewFixRefreshPath);
  const alphaInspectReviewFixTransitions = alphaInspectReviewFixRefresh?.transitions ?? [];
  const alphaInspectReviewFixTransitionByPath = new Map(alphaInspectReviewFixTransitions.map((entry) => [normalize(entry.path), entry]));
  const alphaInspectReviewFixPolicyTransitions = alphaInspectReviewFixPolicy?.authorizedTransitions ?? [];
  const alphaInspectReviewFixPolicyTransitionByPath = new Map(alphaInspectReviewFixPolicyTransitions.map((entry) => [normalize(entry.path), entry]));
  const upContactShadowPolicies = policy.upContactShadowContextRefreshes ?? [];
  const upContactShadowPolicy = upContactShadowPolicies.find((entry) => normalize(entry.record) === upContactShadowRefreshPath);
  const upContactShadowSceneChain = upContactShadowRefresh?.sceneIdentityChain ?? [];
  const upContactShadowPolicySceneChain = upContactShadowPolicy?.sceneIdentityChain ?? [];
  const upContactShadowSceneCurrent = upContactShadowSceneChain.find((entry) => entry.role === "authorized-up-contact-shadow-successor");
  const upContactShadowManagedFiles = upContactShadowRefresh?.currentManagedFiles ?? [];
  const upContactShadowManagedByPath = new Map(upContactShadowManagedFiles.map((entry) => [normalize(entry.path), entry]));
  const upContactShadowPolicyManagedFiles = upContactShadowPolicy?.currentManagedFiles ?? [];
  const upContactShadowPolicyManagedByPath = new Map(upContactShadowPolicyManagedFiles.map((entry) => [normalize(entry.path), entry]));
  const healthStatusMedicinePolicies = policy.healthStatusMedicineContextRefreshes ?? [];
  const healthStatusMedicinePolicy = healthStatusMedicinePolicies.find((entry) => normalize(entry.record) === healthStatusMedicineRefreshPath);
  const healthStatusMedicineTransitions = healthStatusMedicineRefresh?.transitions ?? [];
  const healthStatusMedicineTransitionByPath = new Map(healthStatusMedicineTransitions.map((entry) => [normalize(entry.path), entry]));
  const healthStatusMedicineSupportingTransitions = healthStatusMedicineRefresh?.supportingContentTransitions ?? [];
  const healthStatusMedicineSupportingTransitionByPath = new Map(healthStatusMedicineSupportingTransitions.map((entry) => [normalize(entry.path), entry]));
  const healthStatusMedicineStateSuccessors = healthStatusMedicineRefresh?.committedStateSuccessors ?? [];
  const healthStatusMedicineStateSuccessorByPath = new Map(healthStatusMedicineStateSuccessors.map((entry) => [normalize(entry.path), entry]));
  const healthStatusMedicineEvidenceFiles = healthStatusMedicineRefresh?.representativeEvidence?.files ?? [];
  const healthStatusMedicineEvidenceByPath = new Map(healthStatusMedicineEvidenceFiles.map((entry) => [normalize(entry.currentPath), entry]));
  const healthStatusMedicinePolicyTransitions = healthStatusMedicinePolicy?.authorizedTransitions ?? [];
  const healthStatusMedicinePolicyTransitionByPath = new Map(healthStatusMedicinePolicyTransitions.map((entry) => [normalize(entry.path), entry]));
  const expectedHealthStatusMedicineTransitions = new Map([
    ["App.tsx", {
      prior: { bytes: 117794, sha256: "8262c0892427dd1929e1d5c5724c50c655fd1b28ca8f59c6411b0d735a7cdf2a", gitBlobOid: "653263bb5ceb3ce429692886d0138e0d9834fe0d" },
      current: { bytes: 124143, sha256: "7606a0852ce92f5e14d429b63befa0961934e4f91d4efe6a95eafd04f36c9a1b", gitBlobOid: "aae7d69c2e3a50e8cf8622edd4b0d89aa241ec25", lastWriteTimeUtc: "2026-08-18T17:37:35.1810364Z" },
    }],
    ["src/persistence.ts", {
      prior: { bytes: 50476, sha256: "c409b047a6bcaf956cc85fa02fa654279d1b307d90080325c10514b9cffa1996", gitBlobOid: "450e14bd6df68416ba79fc3dcfe33b5837c08b9f" },
      current: { bytes: 56676, sha256: "86cca46e758c7fc98282ab223d313594d27edbc28cb4911d7588b35a9c2b1338", gitBlobOid: "ee8fdf7578b8f10a3331c1eed344e3be9a3e3229", lastWriteTimeUtc: "2026-08-18T20:00:11.1195883Z" },
    }],
    ["src/persistence.test.ts", {
      prior: { bytes: 78712, sha256: "f46584fe22378e5d93bb860cadeb5ecfb8e2d39344b96d030f8403d35677c8ca", gitBlobOid: "233351c4004f1f6d1fa9e69ba90a2e448d25323f" },
      current: { bytes: 87216, sha256: "798b9b143c0bfdddf7e74d0f9c6c95b2ceddf36c2161d2a3a27e6f11a0eee318", gitBlobOid: "b3624e32e80af85f00bf429afcc6c24a5c3cab0a", lastWriteTimeUtc: "2026-08-18T19:57:20.7631617Z" },
    }],
  ]);
  const expectedHealthStatusMedicineSupportingTransitions = new Map([
    ["docs/DECISIONS.md", {
      prior: { bytes: 27759, sha256: "c65e88042284aa7c858fe168980d05e953545778408b9d4dfa907fc91b1aa09a", gitBlobOid: "fd697d6e6da3fb99f5714a02b1d26b80839a22f3" },
      current: { bytes: 28988, sha256: "91b9a0a76e9e31bc7a2da4df1666bd699cc4055f3f42b852ddcdb32b17a2de3d", gitBlobOid: "bc4185e44ed6e56655f299a1ba5aa2bec41b62d1", lastWriteTimeUtc: "2026-08-18T17:44:04.2487759Z" },
    }],
    ["docs/QUALITY_GATES.md", {
      prior: { bytes: 11745, sha256: "b171ba588a25215c00b968a501bcede46fea6a9e1b6fe011543fbbf258aca632", gitBlobOid: "eb48455a5b527fa1bd3161805fae9b9d6a6a9aae" },
      current: { bytes: 12486, sha256: "b158a6f590564754c86aa7ac5a2e26ca82c9579b59abfedda96380022d2b7fa4", gitBlobOid: "b25b264ddf9a45985403e3091ed3f239c7bfc49e", lastWriteTimeUtc: "2026-08-18T17:44:07.4262712Z" },
    }],
    ["docs/production/PRODUCTION_DASHBOARD.md", {
      prior: { bytes: 9599, sha256: "2b1f9f1aa17f7acdd1e6ce3ae6b4955f087d154ab41113cf14314f007778c873", gitBlobOid: "e98e4740af85e08c621da26df91f1510272ded77" },
      current: { bytes: 10273, sha256: "0fa0a671ef67ae37a13464c32a7150860e8d61f0a40d47ff57232353a5c6fc0c", gitBlobOid: "31d8432bde6b4513758632cf4703922e483317d2", lastWriteTimeUtc: "2026-08-18T17:44:05.6779514Z" },
    }],
    ["src/day-one-ui.test.ts", {
      prior: { bytes: 34797, sha256: "76788e0491dcd6735aed4e03499ca5a169a2cc28d5052444c55f9575e3e67466", gitBlobOid: "12b751432b3efdb7b9375c77ca5f8fa488ed3342" },
      current: { bytes: 35071, sha256: "b7cd34d38473ae9cb0a3a63b2ad3d65a46c8a1eca64e4dc107985938dab27918", gitBlobOid: "b80d50afb72f3852724c6826a3073a0a600827c2", lastWriteTimeUtc: "2026-08-18T17:28:21.9297583Z" },
    }],
  ]);
  const expectedHealthStatusMedicineStateSuccessors = new Map([
    ["docs/production/CREATIVE_DIRECTION.md", { bytes: 5030, sha256: "e1c3222dcab31c53c4b920944c276aa8e7cf4a33896efcf87701cf8dc61db7ef", gitBlobOid: "8c443f800256e91861ba8ea66c4f89d10bd9779e", priorState: "tracked-modified" }],
    ["docs/design/3D_PET_ROOM_DIRECTION.md", { bytes: 32898, sha256: "edb0c5ac510b48b9b3ad7a0e6edb9a2b53a5a46b775623027e3048902dd35460", gitBlobOid: "92fd23ffdd088e283479908ea9f1f13c3d49f6ac", priorState: "tracked-modified" }],
    ["src/pet-room-scene-shell.tsx", { bytes: 8814, sha256: "83f584e3144eff26b62de9e5c9bafa9a4d6b54fcd451c2989aa6cf792df9e6d7", gitBlobOid: "710e0cc6a95cb5fbf84f761f01cb577b8d76bbc7", priorState: "tracked-modified" }],
    ["src/pet-room-scene.web.tsx", { bytes: 18031, sha256: "dcc5f779dfa7425b70795544f78a23d0351aafea681c8e06711c88cb6a23a644", gitBlobOid: "62e285f0bf708c46c0ef74d00f4e5ec53f4463d3", priorState: "tracked-modified" }],
    ["src/pet-room-3d-policy.ts", { bytes: 2804, sha256: "394bcad2239ca0d8af8dd9daa1ff2cba57f9451377a475752312f72e1983dd5b", gitBlobOid: "57e652ca1f105948f0386266c98108805eee2449", priorState: "untracked" }],
    ["src/pet-room-3d-policy.test.ts", { bytes: 3844, sha256: "a6d6fb93f08faee1c41c2526abe1206af3c3160f1664ac78627a3c87ee5acc19", gitBlobOid: "59a28efc8923c052e79774dbfa84bd9c12c54a01", priorState: "untracked" }],
    ["src/up-contact-shadow-policy.ts", { bytes: 1244, sha256: "92d7eb0ba294d928b7a630324397f431970bcb8cef19d0bb5cfd6b62d85700e7", gitBlobOid: "98f1a2efb9faebe483184da4ead0edd98f3d10d4", priorState: "untracked" }],
    ["src/up-contact-shadow-policy.test.ts", { bytes: 1764, sha256: "751e78825ec419dd537412b41db61cd434ecb7f4bb9b0aa6009ef9d993954735", gitBlobOid: "da67d3d0d28afc28c4a4a045dfbbad8b4bf9027f", priorState: "untracked" }],
  ]);
  const expectedHealthStatusMedicineEvidence = new Map([
    ["evidence/health-status-medicine/status-medicine-390x844.jpg", { sourcePath: "evidence/health-status-medicine/status-medicine-390x844.png", bytes: 40477, sha256: "9a15da2ad4edbfa9939fe28bee5023e21d6767a8073d0cf7e216499e33b08fe3", gitBlobOid: "3acaa3fb6257d907a89355a0a890c692f0adb805", width: 390, height: 844 }],
    ["evidence/health-status-medicine/status-medicine-1440x900.jpg", { sourcePath: "evidence/health-status-medicine/status-medicine-1440x900.png", bytes: 67890, sha256: "4396f872b40e6cc06f7804cbec51449e16f97b30dd5bb033f1d88d3ffe5f9b3d", gitBlobOid: "76c3a943b10f69202779cb3d3855976dd6779a1a", width: 1440, height: 900 }],
  ]);
  const expectedAlphaInspectReviewFixTransitions = new Map([
    ["docs/DECISIONS.md", {
      prior: { bytes: 27761, sha256: "84024a13f82c5264eaeba2d3a85623d429dc06c1a8080f11ca8b8c9a5a624e06", gitBlobOid: "458e7602fc5cfe76a333ff25e36dbced6f29612d", lastWriteTimeUtc: "2026-08-17T18:18:06.6079233Z", gitState: "tracked-modified" },
      current: { bytes: 27759, sha256: "c65e88042284aa7c858fe168980d05e953545778408b9d4dfa907fc91b1aa09a", gitBlobOid: "fd697d6e6da3fb99f5714a02b1d26b80839a22f3", lastWriteTimeUtc: "2026-08-17T19:05:45.6242060Z", gitState: "tracked-modified" },
      change: "grounding-runtime-version-label-only",
    }],
    ["src/pet-room-3d-policy.ts", {
      prior: { bytes: 2802, sha256: "231f7ff126c0473a71422e5a418bfd2cfc1f3491bb310ac0259453f7b6832c9c", gitBlobOid: "3723f9166948786847d35295909e3bbde8882143", lastWriteTimeUtc: "2026-08-17T18:18:03.2875519Z", gitState: "untracked" },
      current: { bytes: 2804, sha256: "394bcad2239ca0d8af8dd9daa1ff2cba57f9451377a475752312f72e1983dd5b", gitBlobOid: "57e652ca1f105948f0386266c98108805eee2449", lastWriteTimeUtc: "2026-08-17T19:05:43.9097908Z", gitState: "untracked" },
      change: "grounding-runtime-version-label-only",
    }],
    [selfPath, {
      prior: { bytes: 164833, sha256: "92ae88a7ce35e447e2c4a12c1cdd1758fae5b1d60795de3a677a87ada8b816eb", gitBlobOid: "1eb85ab44d4f6d65e9868bad2fa53a3f86f209c5", lastWriteTimeUtc: null, gitState: "tracked-modified" },
      current: null,
      change: "remove-seven-obsolete-unused-declarations-and-validate-exact-successor",
    }],
  ]);
  const expectedPostCommitHistory = new Map([
    [inventoryPath, { bytes: 209351, sha256: "d332853029ea2f46a3f28370b20e107d717e0fe32c65b642deee17fe5e53765f" }],
    [preservationPath, { bytes: 13321, sha256: "e52cb511d4595ba7e4853e21fc3c74cec2c6f5f760ad60c6c4efee8bc2cc4f4d" }],
    [normalizationPath, { bytes: 11168, sha256: "284966ba2bdd29709245200cebdcd3098476a7a051d5017c812ea2f66c6d1dc2" }],
    [evidenceRefreshPath, { bytes: 2257, sha256: "51ef99c420fe2e6eea5c3b19cfe0f5f7f2e86842bb9f3e57b16ce908a2192f33" }],
    [postBaselineIntakePath, { bytes: 38412, sha256: "f474bae293be22fa6ca8fd28011350106943dc2602067ad78ff85b976c06eeb6" }],
    [postBaselineDeltaPath, { bytes: 14229, sha256: "32dada5d7a6a3c075ed29939ca4bab0b8e1db87d773a1265429c2463311c1a23" }],
    [postBaselineMasteredDeltaPath, { bytes: 22053, sha256: "aa45bff433980f26600fe7627a49ad831e1d325556d8abf4f6095b873fc54f67" }],
    [v4ManagedContextRefreshPath, { bytes: 6217, sha256: "03f8dd11fd8f0860bc3a84a3b2d70f7c806b49bf6cbcf1daf11e4c030763f17a" }],
    [initialJournalAmbiguityRefreshPath, { bytes: 7885, sha256: "99717544e31e46774e88b56f9afd018fd734863066aeb79454d36954ab37e409" }],
    [candidateEofNormalizationPath, { bytes: 14789, sha256: "8863a6b7f1cddb04a751205ac4d3704c23fee2c242483764c6f81db86f0f96e0" }],
    [checkpointPath, { bytes: 159734, sha256: "045c0d74c7417649307aabadde2fcdc2327fbef19cd2ef02ed11eefc6cde4b21" }],
    [safeReturnCandidatePath, { bytes: 238966, sha256: safeReturnCandidateSha256 }],
  ]);
  const expectedStatusSuccessorGroups = new Map([
    ["initial-journal-current", {
      record: initialJournalAmbiguityRefreshPath,
      members: new Map([
        ["App.tsx", "tracked-modified"],
        ["src/persistence.ts", "tracked-modified"],
        ["src/persistence.test.ts", "tracked-modified"],
        ["src/day-one-ui.ts", "untracked"],
        ["src/day-one-ui.test.ts", "untracked"],
      ]),
    }],
    ["candidate-eof-current", {
      record: candidateEofNormalizationPath,
      members: new Map([
        ["assets/3d/jack/v3/README.md", "untracked"],
        ["assets/3d/jack/v3/SOURCE_LEDGER_V3.md", "untracked"],
        ["assets/3d/jack/v4/ADULT_LIKENESS_SPEC_V4.md", "untracked"],
        ["assets/3d/jack/v4/README.md", "untracked"],
        ["assets/3d/jack/v4/SOURCE_LEDGER_V4.md", "untracked"],
        ["assets/3d/jack/v4/tools/analyze_adult_components.py", "untracked"],
      ]),
    }],
    ["mastered-runtime-context", {
      record: postBaselineMasteredDeltaPath,
      members: new Map([
        ["App.tsx", "tracked-modified"],
        ["assets/audio/v1/audio-manifest.v1.json", "tracked-modified"],
        ["docs/audio/AUDIO_LICENSE_LEDGER.v1.md", "tracked-modified"],
        ["src/audio-cue-policy.test.ts", "tracked-modified"],
        ["scripts/verify-audio-v1.mjs", "untracked"],
        ["scripts/verify-export.mjs", "tracked-modified"],
        ["scripts/master-audio-v1.mjs", "untracked"],
        ["scripts/master-audio-music-v1.mjs", "untracked"],
        ["scripts/record-audio-source-evidence-v1.mjs", "untracked"],
      ]),
    }],
    ["managed-collision-context", {
      record: postBaselineIntakePath,
      members: new Map([
        ["assets/audio/v1/audio-manifest.v1.json", "tracked-modified"],
        ["docs/audio/AUDIO_LICENSE_LEDGER.v1.md", "tracked-modified"],
        ["docs/design/3D_JACK_MODEL_HANDOFF.md", "tracked-modified"],
        ["package.json", "tracked-modified"],
        ["src/audio-cue-policy.ts", "tracked-modified"],
        ["src/audio-cue-policy.test.ts", "tracked-modified"],
        ["scripts/verify-audio-v1.mjs", "untracked"],
      ]),
    }],
  ]);
  const candidateFiles = safeReturnCandidate?.candidate?.files ?? [];
  const candidateFilesByPath = new Map(candidateFiles.map((entry) => [normalize(entry.path), entry]));
  const currentTrackedPaths = new Set(gitPaths(["ls-files", "--cached", "-z"]));
  const currentModifiedPaths = new Set(gitPaths(["ls-files", "--modified", "-z"]));
  const currentUntrackedPaths = new Set(gitPaths(["ls-files", "--others", "--exclude-standard", "-z"]));

  assert(policy.status === "preservation-verified-alpha-inspect-local-commit-with-authorized-v7-health-status-successor", "Asset policy status must recognize the Alpha Inspect commit and exact V7 health/status successor");
  assert(postCommitContextPolicies.length === 1 && Boolean(alphaInspectStatusPolicy), "Asset policy must declare exactly one post-commit context refresh");
  assert(alphaInspectStatusPolicy?.recordBytes === 18829 && alphaInspectStatusPolicy?.recordSha256 === "e2849dbd7c9c0ad1214c286628dcedc73567beb86b39fb99223cffaae99f0839", "Alpha Inspect status policy record identity drifted");
  assert(existsSync(absolute(alphaInspectStatusRefreshPath)) && statSync(absolute(alphaInspectStatusRefreshPath)).size === 18829 && fileHash(alphaInspectStatusRefreshPath) === "e2849dbd7c9c0ad1214c286628dcedc73567beb86b39fb99223cffaae99f0839", "Alpha Inspect status refresh record drifted");
  assert(alphaInspectStatusRefresh?.schemaVersion === 1 && alphaInspectStatusRefresh?.kind === "managed-context-status-refresh" && alphaInspectStatusRefresh?.hashAlgorithm === "sha256", "Alpha Inspect status refresh schema/kind/hash contract drifted");
  assert(alphaInspectStatusRefresh?.authorization?.milestone === "Build — Alpha Inspect Managed-Context Reconciliation" && alphaInspectStatusRefresh?.authorization?.generalMutableContextException === false, "Alpha Inspect status refresh authorization drifted");
  assert(alphaInspectStatusRefresh?.authorization?.assetPathByteTierImportOrDispositionChangeAuthorized === false && alphaInspectStatusRefresh?.authorization?.dependencyChangeAuthorized === false && alphaInspectStatusRefresh?.authorization?.externalOrGitActionAuthorized === false && alphaInspectStatusRefresh?.authorization?.subjectiveAcceptanceOrLockAuthorized === false, "Alpha Inspect status refresh authority widened");
  assert(alphaInspectStatusPolicy?.kind === "checksum-bound-managed-context-status-refresh" && alphaInspectStatusPolicy?.milestone === "Build — Alpha Inspect Managed-Context Reconciliation" && alphaInspectStatusPolicy?.generalMutableContextException === false, "Alpha Inspect status policy contract drifted");
  assert(alphaInspectStatusPolicy?.assetPathByteTierImportOrDispositionChangeAuthorized === false && alphaInspectStatusPolicy?.subjectiveAcceptanceOrLockAuthorized === false, "Alpha Inspect status policy authority widened");
  assert(gitOutput(["rev-parse", "HEAD"]) === "8e01e9d36faaaa74d79ea6f51777fce6319875e5" && gitOutput(["merge-base", "--is-ancestor", safeReturnCommit, "HEAD"]) === "", "Alpha Inspect HEAD or Safe Return ancestry drifted");
  assert(gitOutput(["rev-parse", `${safeReturnCommit}^`]) === safeReturnParent, "Safe Return commit/parent identity drifted");
  assert(gitOutput(["rev-parse", `${safeReturnCommit}^{tree}`]) === "9093b7e66df70941e5a58da588c314523e6dfd58", "Safe Return commit tree drifted");
  assert(gitOutput(["show", "-s", "--format=%s", safeReturnCommit]) === "feat: secure safe return checkpoint", "Safe Return commit subject drifted");
  assert(gitOutput(["branch", "--show-current"]) === "codex/jack-v05", "Alpha Inspect status refresh branch drifted");
  assert(gitPaths(["diff", "--cached", "--name-only", "-z"]).length === 0, "Alpha Inspect status refresh requires an empty staging area");
  assert(alphaInspectStatusRefresh?.repositoryState?.head === safeReturnCommit && alphaInspectStatusRefresh?.repositoryState?.parent === safeReturnParent && alphaInspectStatusRefresh?.repositoryState?.tree === "9093b7e66df70941e5a58da588c314523e6dfd58" && alphaInspectStatusRefresh?.repositoryState?.branch === "codex/jack-v05", "Alpha Inspect repository-state identity drifted");
  assert(alphaInspectStatusRefresh?.repositoryState?.stagedPathCount === 0 && alphaInspectStatusRefresh?.repositoryState?.stagedPaths?.length === 0 && alphaInspectStatusRefresh?.repositoryState?.externalOrGitActionPerformedByThisMilestone === false, "Alpha Inspect repository-state scope widened");

  const postCommitHistory = alphaInspectStatusRefresh?.appendOnlyHistory ?? [];
  const postCommitHistoryByRecord = new Map(postCommitHistory.map((entry) => [normalize(entry.record), entry]));
  assert(postCommitHistory.length === expectedPostCommitHistory.size && postCommitHistoryByRecord.size === expectedPostCommitHistory.size, "Alpha Inspect append-only history set mismatch");
  for (const [record, expected] of expectedPostCommitHistory) {
    const entry = postCommitHistoryByRecord.get(record);
    assert(entry?.immutable === true && entry?.recordBytes === expected.bytes && entry?.recordSha256 === expected.sha256, `Alpha Inspect immutable history entry drifted: ${record}`);
    assert(existsSync(absolute(record)) && statSync(absolute(record)).size === expected.bytes && fileHash(record) === expected.sha256, `Alpha Inspect immutable history file drifted: ${record}`);
  }

  const recordedSafeReturnCommit = alphaInspectStatusRefresh?.safeReturnCommit;
  const recordedSafeReturnCandidate = recordedSafeReturnCommit?.candidate;
  assert(recordedSafeReturnCommit?.commit === safeReturnCommit && recordedSafeReturnCommit?.parent === safeReturnParent && recordedSafeReturnCommit?.tree === "9093b7e66df70941e5a58da588c314523e6dfd58" && recordedSafeReturnCommit?.subject === "feat: secure safe return checkpoint", "Safe Return commit record drifted");
  assert(recordedSafeReturnCandidate?.record === safeReturnCandidatePath && recordedSafeReturnCandidate?.recordBytes === 238966 && recordedSafeReturnCandidate?.recordSha256 === safeReturnCandidateSha256 && recordedSafeReturnCandidate?.commitBlobOid === "401cbad538f88e0015a0606f87a8a4e3bfcb39ac", "Safe Return candidate identity record drifted");
  assert(recordedSafeReturnCandidate?.fileCount === 86 && recordedSafeReturnCandidate?.bytes === 22866380 && recordedSafeReturnCandidate?.nonSelfFileCount === 85 && recordedSafeReturnCandidate?.nonSelfBytes === 22627414 && recordedSafeReturnCandidate?.nonSelfAggregateSha256 === "d7c995b8a6a2b6dd5a2ae5b86807327f2bf42a2a8ccd6222f93b46e231aea441", "Safe Return candidate summary record drifted");
  assert(alphaInspectStatusPolicy?.safeReturnCommit === safeReturnCommit && alphaInspectStatusPolicy?.safeReturnParent === safeReturnParent && alphaInspectStatusPolicy?.safeReturnCandidate === safeReturnCandidatePath && alphaInspectStatusPolicy?.safeReturnCandidateBytes === 238966 && alphaInspectStatusPolicy?.safeReturnCandidateSha256 === safeReturnCandidateSha256 && alphaInspectStatusPolicy?.safeReturnCandidateFileCount === 86 && alphaInspectStatusPolicy?.safeReturnCandidateTotalBytes === 22866380, "Safe Return candidate policy binding drifted");
  assert(safeReturnCandidate?.schemaVersion === 1 && safeReturnCandidate?.kind === "safe-return-checkpoint-candidate-index" && safeReturnCandidate?.parentHead === safeReturnParent, "Safe Return candidate schema/parent drifted");
  assert(safeReturnCandidate?.candidate?.fileCount === 86 && safeReturnCandidate?.candidate?.bytes === 22866380 && safeReturnCandidate?.candidate?.nonSelfFileCount === 85 && safeReturnCandidate?.candidate?.nonSelfBytes === 22627414 && safeReturnCandidate?.candidate?.nonSelfAggregateSha256 === "d7c995b8a6a2b6dd5a2ae5b86807327f2bf42a2a8ccd6222f93b46e231aea441", "Safe Return candidate file/byte summary drifted");
  assert(candidateFiles.length === 86 && candidateFilesByPath.size === 86 && candidateFilesByPath.has(safeReturnCandidatePath), "Safe Return candidate path set is not exactly 86 unique paths including self");
  const safeReturnCommitPaths = new Set(gitPaths(["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", safeReturnCommit]));
  assert(safeReturnCommitPaths.size === 86 && safeReturnCommitPaths.size === candidateFilesByPath.size, "Safe Return commit changed-path count drifted");
  for (const path of safeReturnCommitPaths) assert(candidateFilesByPath.has(path), `Safe Return commit contains a path outside the candidate: ${path}`);
  for (const [path, entry] of candidateFilesByPath) {
    assert(safeReturnCommitPaths.has(path), `Safe Return candidate path is absent from the commit: ${path}`);
    let committedBlobOid;
    try {
      committedBlobOid = gitOutput(["rev-parse", `${safeReturnCommit}:${path}`]);
    } catch (error) {
      errors.push(`Safe Return candidate path is not recoverable from the commit: ${path}: ${error.message}`);
      continue;
    }
    if (path === safeReturnCandidatePath) {
      assert(committedBlobOid === "401cbad538f88e0015a0606f87a8a4e3bfcb39ac", "Safe Return self-indexed candidate commit identity drifted");
      assert(entry.bytes === 238966 && entry.sha256 === null && entry.gitNormalizedBlobOid === null, "Safe Return self-index semantics drifted");
    } else {
      assert(committedBlobOid === entry.gitNormalizedBlobOid, `Safe Return committed candidate normalized blob identity drifted: ${path}`);
    }
  }

  let historicalStatusExpectationCount = 0;
  const uniqueStatusSuccessorPaths = new Set();
  assert(alphaInspectStatusGroups.length === expectedStatusSuccessorGroups.size && alphaInspectStatusGroupsById.size === expectedStatusSuccessorGroups.size, "Safe Return status-successor group set mismatch");
  for (const [groupId, expected] of expectedStatusSuccessorGroups) {
    const group = alphaInspectStatusGroupsById.get(groupId);
    const members = group?.members ?? [];
    const membersByPath = new Map(members.map((entry) => [normalize(entry.path), entry]));
    assert(group?.record === expected.record && group?.memberCount === expected.members.size && members.length === expected.members.size && membersByPath.size === expected.members.size, `Safe Return status-successor group drifted: ${groupId}`);
    historicalStatusExpectationCount += members.length;
    for (const [path, historicalGitState] of expected.members) {
      const member = membersByPath.get(path);
      const candidateEntry = candidateFilesByPath.get(path);
      uniqueStatusSuccessorPaths.add(path);
      assert(member?.historicalGitState === historicalGitState && member?.currentState === "tracked-committed-at-safe-return", `Safe Return status-successor member drifted: ${groupId}: ${path}`);
      assert(Boolean(candidateEntry), `Safe Return status-successor path is absent from the candidate: ${path}`);
      assert(candidateEntry?.statusRelativeToParent === (historicalGitState === "tracked-modified" ? "modified" : "untracked"), `Safe Return historical candidate status drifted: ${groupId}: ${path}`);
      const currentHealthSuccessor = healthStatusMedicineTransitionByPath.get(path) ?? healthStatusMedicineSupportingTransitionByPath.get(path);
      assert(currentTrackedPaths.has(path) && !currentUntrackedPaths.has(path), `Safe Return committed successor is not currently tracked: ${path}`);
      if (currentHealthSuccessor) {
        assert(currentModifiedPaths.has(path), `Authorized V7 health/status successor is not tracked-modified: ${path}`);
        assert(candidateEntry?.bytes === currentHealthSuccessor.prior?.bytes && candidateEntry?.sha256 === currentHealthSuccessor.prior?.sha256 && candidateEntry?.gitNormalizedBlobOid === currentHealthSuccessor.prior?.gitNormalizedBlobOid, `V7 health/status predecessor does not match the Safe Return commit: ${path}`);
        assert(existsSync(absolute(path)) && statSync(absolute(path)).size === currentHealthSuccessor.current?.bytes && fileHash(path) === currentHealthSuccessor.current?.sha256 && pathAttributedGitBlobOid(path) === currentHealthSuccessor.current?.gitNormalizedBlobOid, `Authorized V7 health/status working identity drifted: ${path}`);
      } else {
        assert(!currentModifiedPaths.has(path), `Safe Return committed successor is unexpectedly modified: ${path}`);
      }
      if (!currentHealthSuccessor && candidateEntry && existsSync(absolute(path))) {
        assert(statSync(absolute(path)).size === candidateEntry.bytes && fileHash(path) === candidateEntry.sha256 && pathAttributedGitBlobOid(path) === candidateEntry.gitNormalizedBlobOid, `Safe Return committed successor working identity drifted: ${path}`);
      }
    }
  }
  assert(historicalStatusExpectationCount === 27 && uniqueStatusSuccessorPaths.size === 22, "Safe Return status-successor totals must remain 27 historical expectations over 22 unique paths");
  assert(recordedSafeReturnCommit?.historicalStatusExpectationCount === 27 && recordedSafeReturnCommit?.uniqueStatusSuccessorPathCount === 22 && recordedSafeReturnCommit?.commitChangedPathCount === 86, "Safe Return status-successor record totals drifted");
  assert(alphaInspectStatusPolicy?.historicalStatusExpectationCount === 27 && alphaInspectStatusPolicy?.uniqueStatusSuccessorPathCount === 22, "Safe Return status-successor policy totals drifted");
  const assertCommittedStatusSuccessor = (groupId, path, historicalGitState) => {
    const group = alphaInspectStatusGroupsById.get(groupId);
    const member = (group?.members ?? []).find((entry) => normalize(entry.path) === normalize(path));
    assert(member?.historicalGitState === historicalGitState && member?.currentState === "tracked-committed-at-safe-return", `Missing exact Safe Return status successor: ${groupId}: ${path}`);
  };

  const companionReport = alphaInspectStatusRefresh?.companionReport;
  assert(companionReport?.path === safeReturnCompanionReportPath && companionReport?.bytes === 12114 && companionReport?.sha256 === "9c9dbc2430a9275e28b4b102b6d98615875b30fc798d5c0d442d63b1797f1e1a" && companionReport?.pathAttributedGitBlobOid === "5be8b2584d17f51a5ab8ee04218c3c158083ebe4", "Safe Return companion-report record identity drifted");
  assert(companionReport?.currentState === "untracked-companion-not-in-candidate-or-commit" && companionReport?.circularDigestReasonPreserved === true, "Safe Return companion-report disposition drifted");
  assert(existsSync(absolute(safeReturnCompanionReportPath)) && statSync(absolute(safeReturnCompanionReportPath)).size === 12114 && fileHash(safeReturnCompanionReportPath) === "9c9dbc2430a9275e28b4b102b6d98615875b30fc798d5c0d442d63b1797f1e1a" && pathAttributedGitBlobOid(safeReturnCompanionReportPath) === "5be8b2584d17f51a5ab8ee04218c3c158083ebe4", "Safe Return companion-report current identity drifted");
  assert(Math.abs(statSync(absolute(safeReturnCompanionReportPath)).mtimeMs - new Date("2026-08-17T16:39:50.1985037Z").getTime()) < 1, "Safe Return companion-report mtime drifted");
  assert(currentUntrackedPaths.has(safeReturnCompanionReportPath) && !currentTrackedPaths.has(safeReturnCompanionReportPath) && !candidateFilesByPath.has(safeReturnCompanionReportPath) && !safeReturnCommitPaths.has(safeReturnCompanionReportPath), "Safe Return companion report must remain untracked and outside the candidate/commit");

  const candidateExclusionGroups = safeReturnCandidate?.excluded?.groups ?? [];
  const candidateExcludedEntries = candidateExclusionGroups.flatMap((group) => group.files ?? []);
  const candidateExcludedByPath = new Map(candidateExcludedEntries.map((entry) => [normalize(entry.path), entry]));
  const candidateExclusionRecord = alphaInspectStatusRefresh?.candidateExclusions;
  assert(safeReturnCandidate?.excluded?.fileCount === 483 && safeReturnCandidate?.excluded?.bytes === 2603606367 && candidateExclusionGroups.length === 12 && candidateExcludedEntries.length === 483 && candidateExcludedByPath.size === 483, "Safe Return candidate exclusion summary drifted");
  assert(candidateExclusionRecord?.fileCount === 483 && candidateExclusionRecord?.bytes === 2603606367 && candidateExclusionRecord?.groupCount === 12 && candidateExclusionRecord?.candidateIntersectionCount === 0 && candidateExclusionRecord?.currentSceneIdentityIsAuthorizedSuccessor === true, "Safe Return exclusion successor record drifted");
  for (const group of candidateExclusionGroups) {
    const entries = group.files ?? [];
    const sortedEntries = [...entries].sort((a, b) => (normalize(a.path) < normalize(b.path) ? -1 : normalize(a.path) > normalize(b.path) ? 1 : 0));
    assert(group.fileCount === entries.length && group.bytes === entries.reduce((sum, entry) => sum + entry.bytes, 0) && group.aggregateSha256 === aggregate(sortedEntries), `Safe Return exclusion group summary drifted: ${group.id}`);
  }
  for (const [path, entry] of candidateExcludedByPath) {
    assert(!candidateFilesByPath.has(path), `Safe Return exclusion intersects the candidate: ${path}`);
    assert(existsSync(absolute(path)), `Safe Return excluded path is missing: ${path}`);
    if (!existsSync(absolute(path)) || path === "src/pet-room-scene.web.tsx") continue;
    assert(statSync(absolute(path)).size === entry.bytes && fileHash(path) === entry.sha256, `Safe Return excluded path identity drifted: ${path}`);
  }

  const expectedAlphaInspectTransitions = new Map([
    ["src/pet-room-scene.web.tsx", {
      prior: { bytes: 12121, sha256: "8d26ac3d5d65dc0c4ed943ed1d55435350b9d56e5bacbb6df7de6465fe8dd7df", gitBlobOid: "9b59e2cda25df99a34362fea7f45744ffe160f09" },
      current: { bytes: 16712, sha256: "ea74d4243ad80cf3d7e92001cd7b0bfebd869276ffb9c091c767cde09560ac14", gitBlobOid: "13d80295067773fe9dc39fa1f00825013a7bf5a5", lastWriteTimeUtc: "2026-08-17T18:25:08.8064919Z" },
    }],
    ["docs/production/CREATIVE_DIRECTION.md", {
      prior: { bytes: 4429, sha256: "f7d6a352d1713aaa17b3a240da1f32b670b6e8f88020107d5202a7c10efdc18a", gitBlobOid: "afab7d73b877df7e0f2e1a75db30d82841b99cb4" },
      current: { bytes: 5030, sha256: "e1c3222dcab31c53c4b920944c276aa8e7cf4a33896efcf87701cf8dc61db7ef", gitBlobOid: "8c443f800256e91861ba8ea66c4f89d10bd9779e", lastWriteTimeUtc: "2026-08-17T18:03:04.1951906Z" },
    }],
  ]);
  assert(alphaInspectTransitionByPath.size === expectedAlphaInspectTransitions.size && alphaInspectPolicyTransitionByPath.size === expectedAlphaInspectTransitions.size, "Alpha Inspect transition set must contain exactly the scene and Creative Direction");
  for (const [path, expected] of expectedAlphaInspectTransitions) {
    const transition = alphaInspectTransitionByPath.get(path);
    const policyTransition = alphaInspectPolicyTransitionByPath.get(path);
    assert(transition?.prior?.bytes === expected.prior.bytes && transition?.prior?.sha256 === expected.prior.sha256 && transition?.prior?.gitNormalizedBlobOid === expected.prior.gitBlobOid, `Alpha Inspect prior transition drifted: ${path}`);
    assert(transition?.current?.bytes === expected.current.bytes && transition?.current?.sha256 === expected.current.sha256 && transition?.current?.gitNormalizedBlobOid === expected.current.gitBlobOid && transition?.current?.lastWriteTimeUtc === expected.current.lastWriteTimeUtc && transition?.current?.gitState === "tracked-modified", `Alpha Inspect current transition record drifted: ${path}`);
    assert(policyTransition?.priorBytes === expected.prior.bytes && policyTransition?.priorSha256 === expected.prior.sha256 && policyTransition?.priorGitBlobOid === expected.prior.gitBlobOid && policyTransition?.currentBytes === expected.current.bytes && policyTransition?.currentSha256 === expected.current.sha256 && policyTransition?.currentGitBlobOid === expected.current.gitBlobOid, `Alpha Inspect policy transition drifted: ${path}`);
    if (path !== "src/pet-room-scene.web.tsx") {
      assert(existsSync(absolute(path)) && statSync(absolute(path)).size === expected.current.bytes && fileHash(path) === expected.current.sha256 && pathAttributedGitBlobOid(path) === expected.current.gitBlobOid, `Alpha Inspect current transition identity drifted: ${path}`);
      const stateSuccessor = healthStatusMedicineStateSuccessorByPath.get(path);
      if (stateSuccessor) {
        assert(stateSuccessor.bytes === expected.current.bytes && stateSuccessor.sha256 === expected.current.sha256 && stateSuccessor.gitNormalizedBlobOid === expected.current.gitBlobOid && stateSuccessor.priorState === "tracked-modified" && stateSuccessor.currentState === "tracked-clean-at-alpha-inspect-head" && stateSuccessor.bytesChanged === false, `Alpha Inspect committed-state successor drifted: ${path}`);
        assert(currentTrackedPaths.has(path) && !currentModifiedPaths.has(path) && !currentUntrackedPaths.has(path), `Alpha Inspect committed-state successor is not clean: ${path}`);
      } else {
        assert(Math.abs(statSync(absolute(path)).mtimeMs - new Date(expected.current.lastWriteTimeUtc).getTime()) < 1 && currentModifiedPaths.has(path), `Alpha Inspect current transition state/mtime drifted: ${path}`);
      }
    }
  }
  const sceneExclusion = candidateExcludedByPath.get("src/pet-room-scene.web.tsx");
  const recordedSceneExclusion = candidateExclusionRecord?.sceneExclusionAtCandidate;
  const sceneTransition = alphaInspectTransitionByPath.get("src/pet-room-scene.web.tsx");
  assert(sceneExclusion?.bytes === sceneTransition?.prior?.bytes && sceneExclusion?.sha256 === sceneTransition?.prior?.sha256 && sceneExclusion?.gitNormalizedBlobOid === sceneTransition?.prior?.gitNormalizedBlobOid, "Alpha Inspect scene successor does not chain from the exact candidate exclusion");
  assert(recordedSceneExclusion?.path === "src/pet-room-scene.web.tsx" && recordedSceneExclusion?.bytes === 12121 && recordedSceneExclusion?.sha256 === "8d26ac3d5d65dc0c4ed943ed1d55435350b9d56e5bacbb6df7de6465fe8dd7df" && recordedSceneExclusion?.gitNormalizedBlobOid === "9b59e2cda25df99a34362fea7f45744ffe160f09" && recordedSceneExclusion?.candidateIntersection === false, "Alpha Inspect recorded scene exclusion drifted");
  const creativePrior = execFileSync("git", ["show", `${safeReturnCommit}:docs/production/CREATIVE_DIRECTION.md`], { cwd: root });
  assert(creativePrior.length === 4429 && sha256(creativePrior) === "f7d6a352d1713aaa17b3a240da1f32b670b6e8f88020107d5202a7c10efdc18a" && gitOutput(["rev-parse", `${safeReturnCommit}:docs/production/CREATIVE_DIRECTION.md`]) === "afab7d73b877df7e0f2e1a75db30d82841b99cb4", "Alpha Inspect Creative Direction prior commit identity drifted");
  assert(postBaselineIntake?.creativeStatus?.authoritativeRecord === "docs/production/CREATIVE_DIRECTION.md" && postBaselineIntake?.creativeStatus?.authoritativeRecordSha256 === "f7d6a352d1713aaa17b3a240da1f32b670b6e8f88020107d5202a7c10efdc18a", "Alpha Inspect Creative Direction immutable prior link drifted");

  const expectedFrozenAlphaInspectFiles = new Map([
    ["docs/DECISIONS.md", { bytes: 27761, sha256: "84024a13f82c5264eaeba2d3a85623d429dc06c1a8080f11ca8b8c9a5a624e06", gitBlobOid: "458e7602fc5cfe76a333ff25e36dbced6f29612d", lastWriteTimeUtc: "2026-08-17T18:18:06.6079233Z", gitState: "tracked-modified" }],
    ["docs/QUALITY_GATES.md", { bytes: 11745, sha256: "b171ba588a25215c00b968a501bcede46fea6a9e1b6fe011543fbbf258aca632", gitBlobOid: "eb48455a5b527fa1bd3161805fae9b9d6a6a9aae", lastWriteTimeUtc: "2026-08-17T18:18:58.0544810Z", gitState: "tracked-modified" }],
    ["docs/design/3D_PET_ROOM_DIRECTION.md", { bytes: 32898, sha256: "edb0c5ac510b48b9b3ad7a0e6edb9a2b53a5a46b775623027e3048902dd35460", gitBlobOid: "92fd23ffdd088e283479908ea9f1f13c3d49f6ac", lastWriteTimeUtc: "2026-08-17T18:03:10.8167119Z", gitState: "tracked-modified" }],
    ["docs/production/CREATIVE_DIRECTION.md", { bytes: 5030, sha256: "e1c3222dcab31c53c4b920944c276aa8e7cf4a33896efcf87701cf8dc61db7ef", gitBlobOid: "8c443f800256e91861ba8ea66c4f89d10bd9779e", lastWriteTimeUtc: "2026-08-17T18:03:04.1951906Z", gitState: "tracked-modified" }],
    ["docs/production/PRODUCTION_DASHBOARD.md", { bytes: 9599, sha256: "2b1f9f1aa17f7acdd1e6ce3ae6b4955f087d154ab41113cf14314f007778c873", gitBlobOid: "e98e4740af85e08c621da26df91f1510272ded77", lastWriteTimeUtc: "2026-08-17T18:18:59.6422303Z", gitState: "tracked-modified" }],
    ["src/pet-room-scene-shell.tsx", { bytes: 8814, sha256: "83f584e3144eff26b62de9e5c9bafa9a4d6b54fcd451c2989aa6cf792df9e6d7", gitBlobOid: "710e0cc6a95cb5fbf84f761f01cb577b8d76bbc7", lastWriteTimeUtc: "2026-08-17T18:02:05.2538964Z", gitState: "tracked-modified" }],
    ["src/pet-room-scene.web.tsx", { bytes: 16712, sha256: "ea74d4243ad80cf3d7e92001cd7b0bfebd869276ffb9c091c767cde09560ac14", gitBlobOid: "13d80295067773fe9dc39fa1f00825013a7bf5a5", lastWriteTimeUtc: "2026-08-17T18:25:08.8064919Z", gitState: "tracked-modified" }],
    ["src/pet-room-3d-policy.ts", { bytes: 2802, sha256: "231f7ff126c0473a71422e5a418bfd2cfc1f3491bb310ac0259453f7b6832c9c", gitBlobOid: "3723f9166948786847d35295909e3bbde8882143", lastWriteTimeUtc: "2026-08-17T18:18:03.2875519Z", gitState: "untracked" }],
    ["src/pet-room-3d-policy.test.ts", { bytes: 3844, sha256: "a6d6fb93f08faee1c41c2526abe1206af3c3160f1664ac78627a3c87ee5acc19", gitBlobOid: "59a28efc8923c052e79774dbfa84bd9c12c54a01", lastWriteTimeUtc: "2026-08-17T18:18:04.9563362Z", gitState: "untracked" }],
  ]);
  const frozenAlphaInspectWorkingSet = alphaInspectStatusRefresh?.frozenAlphaInspectWorkingSet;
  const frozenAlphaInspectFiles = frozenAlphaInspectWorkingSet?.files ?? [];
  const frozenAlphaInspectByPath = new Map(frozenAlphaInspectFiles.map((entry) => [normalize(entry.path), entry]));
  assert(frozenAlphaInspectWorkingSet?.fileCount === 9 && frozenAlphaInspectWorkingSet?.bytes === 119205 && frozenAlphaInspectWorkingSet?.aggregateBodyBytes === 1271 && frozenAlphaInspectWorkingSet?.aggregateSha256 === "75ba006ab3ac58531b738917ff8fa923aec0ad9e64c7c8c01b1cb4cf0081dbcd", "Frozen Alpha Inspect working-set summary drifted");
  assert(alphaInspectStatusPolicy?.frozenAlphaInspectWorkingSet?.fileCount === 9 && alphaInspectStatusPolicy?.frozenAlphaInspectWorkingSet?.bytes === 119205 && alphaInspectStatusPolicy?.frozenAlphaInspectWorkingSet?.aggregateSha256 === "75ba006ab3ac58531b738917ff8fa923aec0ad9e64c7c8c01b1cb4cf0081dbcd", "Frozen Alpha Inspect policy summary drifted");
  assert(frozenAlphaInspectFiles.length === expectedFrozenAlphaInspectFiles.size && frozenAlphaInspectByPath.size === expectedFrozenAlphaInspectFiles.size, "Frozen Alpha Inspect working-set path count drifted");
  for (const [path, expected] of expectedFrozenAlphaInspectFiles) {
    const entry = frozenAlphaInspectByPath.get(path);
    assert(entry?.bytes === expected.bytes && entry?.sha256 === expected.sha256 && entry?.gitNormalizedBlobOid === expected.gitBlobOid && entry?.lastWriteTimeUtc === expected.lastWriteTimeUtc && entry?.gitState === expected.gitState, `Frozen Alpha Inspect recorded identity drifted: ${path}`);
    const authorizedSuccessor = alphaInspectReviewFixTransitionByPath.get(path);
    const contentSuccessor = healthStatusMedicineSupportingTransitionByPath.get(path);
    const stateSuccessor = healthStatusMedicineStateSuccessorByPath.get(path);
    if (authorizedSuccessor) {
      assert(path === "docs/DECISIONS.md" || path === "src/pet-room-3d-policy.ts", `Unexpected review-fix successor inside frozen Alpha Inspect working set: ${path}`);
      assert(authorizedSuccessor.prior?.bytes === expected.bytes && authorizedSuccessor.prior?.sha256 === expected.sha256 && authorizedSuccessor.prior?.gitNormalizedBlobOid === expected.gitBlobOid && authorizedSuccessor.prior?.lastWriteTimeUtc === expected.lastWriteTimeUtc && authorizedSuccessor.prior?.gitState === expected.gitState, `Alpha Inspect review-fix predecessor does not match frozen identity: ${path}`);
      const current = authorizedSuccessor.current;
      if (contentSuccessor) {
        assert(contentSuccessor.prior?.bytes === current?.bytes && contentSuccessor.prior?.sha256 === current?.sha256 && contentSuccessor.prior?.gitNormalizedBlobOid === current?.gitNormalizedBlobOid, `V7 content successor does not follow the review-fix identity: ${path}`);
        assert(existsSync(absolute(path)) && statSync(absolute(path)).size === contentSuccessor.current?.bytes && fileHash(path) === contentSuccessor.current?.sha256 && pathAttributedGitBlobOid(path) === contentSuccessor.current?.gitNormalizedBlobOid && currentModifiedPaths.has(path), `Frozen Alpha Inspect V7 content successor drifted: ${path}`);
      } else if (stateSuccessor) {
        assert(stateSuccessor.bytes === current?.bytes && stateSuccessor.sha256 === current?.sha256 && stateSuccessor.gitNormalizedBlobOid === current?.gitNormalizedBlobOid && stateSuccessor.priorState === current?.gitState && stateSuccessor.bytesChanged === false, `Review-fix committed-state successor drifted: ${path}`);
        assert(existsSync(absolute(path)) && statSync(absolute(path)).size === stateSuccessor.bytes && fileHash(path) === stateSuccessor.sha256 && pathAttributedGitBlobOid(path) === stateSuccessor.gitNormalizedBlobOid && currentTrackedPaths.has(path) && !currentModifiedPaths.has(path) && !currentUntrackedPaths.has(path), `Review-fix committed-state successor is not clean: ${path}`);
      } else {
        assert(existsSync(absolute(path)) && statSync(absolute(path)).size === current?.bytes && fileHash(path) === current?.sha256 && pathAttributedGitBlobOid(path) === current?.gitNormalizedBlobOid, `Frozen Alpha Inspect authorized successor drifted: ${path}`);
      }
    } else if (path === "src/pet-room-scene.web.tsx") {
      assert(upContactShadowSceneChain[0]?.bytes === expected.bytes && upContactShadowSceneChain[0]?.sha256 === expected.sha256 && upContactShadowSceneChain[0]?.gitNormalizedBlobOid === expected.gitBlobOid, "Up contact-shadow scene predecessor does not match the frozen Alpha Inspect scene identity");
      assert(existsSync(absolute(path)) && statSync(absolute(path)).size === upContactShadowSceneCurrent?.bytes && fileHash(path) === upContactShadowSceneCurrent?.sha256 && pathAttributedGitBlobOid(path) === upContactShadowSceneCurrent?.gitNormalizedBlobOid, "Frozen Alpha Inspect authorized Up contact-shadow scene successor drifted");
      assert(stateSuccessor?.bytes === upContactShadowSceneCurrent?.bytes && stateSuccessor?.sha256 === upContactShadowSceneCurrent?.sha256 && stateSuccessor?.gitNormalizedBlobOid === upContactShadowSceneCurrent?.gitNormalizedBlobOid && stateSuccessor?.priorState === "tracked-modified" && stateSuccessor?.currentState === "tracked-clean-at-alpha-inspect-head", "Up contact-shadow committed-state successor drifted");
      assert(currentTrackedPaths.has(path) && !currentModifiedPaths.has(path) && !currentUntrackedPaths.has(path), "Frozen Alpha Inspect authorized Up contact-shadow scene successor is not clean");
    } else if (contentSuccessor) {
      assert(contentSuccessor.prior?.bytes === expected.bytes && contentSuccessor.prior?.sha256 === expected.sha256 && contentSuccessor.prior?.gitNormalizedBlobOid === expected.gitBlobOid, `V7 content successor does not follow the frozen Alpha Inspect identity: ${path}`);
      assert(existsSync(absolute(path)) && statSync(absolute(path)).size === contentSuccessor.current?.bytes && fileHash(path) === contentSuccessor.current?.sha256 && pathAttributedGitBlobOid(path) === contentSuccessor.current?.gitNormalizedBlobOid && currentModifiedPaths.has(path), `Frozen Alpha Inspect V7 content successor drifted: ${path}`);
    } else if (stateSuccessor) {
      assert(stateSuccessor.bytes === expected.bytes && stateSuccessor.sha256 === expected.sha256 && stateSuccessor.gitNormalizedBlobOid === expected.gitBlobOid && stateSuccessor.priorState === expected.gitState && stateSuccessor.currentState === "tracked-clean-at-alpha-inspect-head" && stateSuccessor.bytesChanged === false, `Frozen Alpha Inspect committed-state successor drifted: ${path}`);
      assert(existsSync(absolute(path)) && statSync(absolute(path)).size === stateSuccessor.bytes && fileHash(path) === stateSuccessor.sha256 && pathAttributedGitBlobOid(path) === stateSuccessor.gitNormalizedBlobOid && currentTrackedPaths.has(path) && !currentModifiedPaths.has(path) && !currentUntrackedPaths.has(path), `Frozen Alpha Inspect committed-state successor is not clean: ${path}`);
    } else {
      assert(existsSync(absolute(path)) && statSync(absolute(path)).size === expected.bytes && fileHash(path) === expected.sha256 && pathAttributedGitBlobOid(path) === expected.gitBlobOid, `Frozen Alpha Inspect current identity drifted: ${path}`);
      assert(Math.abs(statSync(absolute(path)).mtimeMs - new Date(expected.lastWriteTimeUtc).getTime()) < 1, `Frozen Alpha Inspect current mtime drifted: ${path}`);
      if (expected.gitState === "tracked-modified") assert(currentModifiedPaths.has(path), `Frozen Alpha Inspect tracked-modified state drifted: ${path}`);
      else assert(currentUntrackedPaths.has(path), `Frozen Alpha Inspect untracked state drifted: ${path}`);
    }
  }
  const frozenAlphaInspectAggregateBody = frozenAlphaInspectFiles
    .sort((a, b) => (normalize(a.path) < normalize(b.path) ? -1 : normalize(a.path) > normalize(b.path) ? 1 : 0))
    .map((entry) => `${normalize(entry.path)}\t${entry.bytes}\t${entry.sha256}\t${entry.gitNormalizedBlobOid}\n`)
    .join("");
  assert(Buffer.byteLength(frozenAlphaInspectAggregateBody, "utf8") === 1271 && sha256(Buffer.from(frozenAlphaInspectAggregateBody, "utf8")) === "75ba006ab3ac58531b738917ff8fa923aec0ad9e64c7c8c01b1cb4cf0081dbcd", "Frozen Alpha Inspect working-set aggregate drifted");

  assert(reviewFixContextPolicies.length === 1 && Boolean(alphaInspectReviewFixPolicy), "Asset policy must declare exactly one Alpha Inspect review-fix context refresh");
  assert(existsSync(absolute(alphaInspectReviewFixRefreshPath)), `Missing Alpha Inspect review-fix context refresh: ${alphaInspectReviewFixRefreshPath}`);
  if (existsSync(absolute(alphaInspectReviewFixRefreshPath))) {
    assert(alphaInspectReviewFixPolicy?.recordBytes === statSync(absolute(alphaInspectReviewFixRefreshPath)).size && alphaInspectReviewFixPolicy?.recordSha256 === fileHash(alphaInspectReviewFixRefreshPath), "Alpha Inspect review-fix record identity drifted");
  }
  assert(alphaInspectReviewFixRefresh?.schemaVersion === 1 && alphaInspectReviewFixRefresh?.kind === "managed-context-review-fix-refresh" && alphaInspectReviewFixRefresh?.hashAlgorithm === "sha256", "Alpha Inspect review-fix schema/kind/hash contract drifted");
  assert(alphaInspectReviewFixRefresh?.authorization?.milestone === "Build — Alpha Inspect Camera & Jack Grounding" && alphaInspectReviewFixRefresh?.authorization?.reviewPass === 1 && alphaInspectReviewFixRefresh?.authorization?.fixRound === 1, "Alpha Inspect review-fix authorization drifted");
  assert(alphaInspectReviewFixRefresh?.authorization?.generalMutableContextException === false && alphaInspectReviewFixRefresh?.authorization?.assetPathByteTierImportOrDispositionChangeAuthorized === false && alphaInspectReviewFixRefresh?.authorization?.dependencyChangeAuthorized === false && alphaInspectReviewFixRefresh?.authorization?.externalOrGitActionAuthorized === false, "Alpha Inspect review-fix authority widened");
  assert(alphaInspectReviewFixRefresh?.immutablePredecessor?.record === alphaInspectStatusRefreshPath && alphaInspectReviewFixRefresh?.immutablePredecessor?.recordBytes === 18829 && alphaInspectReviewFixRefresh?.immutablePredecessor?.recordSha256 === "e2849dbd7c9c0ad1214c286628dcedc73567beb86b39fb99223cffaae99f0839" && alphaInspectReviewFixRefresh?.immutablePredecessor?.immutable === true, "Alpha Inspect review-fix predecessor drifted");
  assert(alphaInspectReviewFixPolicy?.kind === "checksum-bound-managed-context-review-fix-refresh" && alphaInspectReviewFixPolicy?.milestone === "Build — Alpha Inspect Camera & Jack Grounding" && alphaInspectReviewFixPolicy?.reviewPass === 1 && alphaInspectReviewFixPolicy?.fixRound === 1, "Alpha Inspect review-fix policy contract drifted");
  assert(alphaInspectReviewFixPolicy?.predecessor === alphaInspectStatusRefreshPath && alphaInspectReviewFixPolicy?.predecessorRecordSha256 === "e2849dbd7c9c0ad1214c286628dcedc73567beb86b39fb99223cffaae99f0839" && alphaInspectReviewFixPolicy?.generalMutableContextException === false, "Alpha Inspect review-fix policy predecessor/exception contract drifted");
  assert(alphaInspectReviewFixTransitions.length === expectedAlphaInspectReviewFixTransitions.size && alphaInspectReviewFixTransitionByPath.size === expectedAlphaInspectReviewFixTransitions.size, "Alpha Inspect review-fix record must bind exactly three transitions");
  assert(alphaInspectReviewFixPolicyTransitions.length === expectedAlphaInspectReviewFixTransitions.size && alphaInspectReviewFixPolicyTransitionByPath.size === expectedAlphaInspectReviewFixTransitions.size, "Alpha Inspect review-fix policy must bind exactly three transitions");
  for (const [path, expected] of expectedAlphaInspectReviewFixTransitions) {
    const transition = alphaInspectReviewFixTransitionByPath.get(path);
    const policyTransition = alphaInspectReviewFixPolicyTransitionByPath.get(path);
    const expectedCurrent = expected.current ?? (transition?.current ? {
      ...transition.current,
      gitBlobOid: transition.current.gitNormalizedBlobOid,
    } : null);
    assert(Boolean(transition && policyTransition && expectedCurrent), `Alpha Inspect review-fix transition chain is incomplete: ${path}`);
    if (!transition || !policyTransition || !expectedCurrent) continue;
    assert(transition.change === expected.change && transition.otherChanges === 0, `Alpha Inspect review-fix change scope drifted: ${path}`);
    assert(transition.prior?.bytes === expected.prior.bytes && transition.prior?.sha256 === expected.prior.sha256 && transition.prior?.gitNormalizedBlobOid === expected.prior.gitBlobOid && transition.prior?.lastWriteTimeUtc === expected.prior.lastWriteTimeUtc && transition.prior?.gitState === expected.prior.gitState, `Alpha Inspect review-fix prior identity drifted: ${path}`);
    assert(transition.current?.bytes === expectedCurrent.bytes && transition.current?.sha256 === expectedCurrent.sha256 && transition.current?.gitNormalizedBlobOid === expectedCurrent.gitBlobOid && transition.current?.lastWriteTimeUtc === expectedCurrent.lastWriteTimeUtc && transition.current?.gitState === expectedCurrent.gitState, `Alpha Inspect review-fix current record drifted: ${path}`);
    assert(policyTransition.priorBytes === expected.prior.bytes && policyTransition.priorSha256 === expected.prior.sha256 && policyTransition.priorGitBlobOid === expected.prior.gitBlobOid, `Alpha Inspect review-fix policy prior identity drifted: ${path}`);
    assert(policyTransition.currentBytes === expectedCurrent.bytes && policyTransition.currentSha256 === expectedCurrent.sha256 && policyTransition.currentGitBlobOid === expectedCurrent.gitBlobOid, `Alpha Inspect review-fix policy current identity drifted: ${path}`);
    if (path === selfPath) {
      assert(upContactShadowRefresh?.controlPlanePredecessors?.assetVerifier?.bytes === expectedCurrent.bytes && upContactShadowRefresh?.controlPlanePredecessors?.assetVerifier?.sha256 === expectedCurrent.sha256, "Up contact-shadow verifier predecessor does not match the Alpha Inspect review-fix verifier identity");
    } else {
      const contentSuccessor = healthStatusMedicineSupportingTransitionByPath.get(path);
      const stateSuccessor = healthStatusMedicineStateSuccessorByPath.get(path);
      if (contentSuccessor) {
        assert(contentSuccessor.prior?.bytes === expectedCurrent.bytes && contentSuccessor.prior?.sha256 === expectedCurrent.sha256 && contentSuccessor.prior?.gitNormalizedBlobOid === expectedCurrent.gitBlobOid, `V7 content successor does not follow the review-fix identity: ${path}`);
        assert(existsSync(absolute(path)) && statSync(absolute(path)).size === contentSuccessor.current?.bytes && fileHash(path) === contentSuccessor.current?.sha256 && pathAttributedGitBlobOid(path) === contentSuccessor.current?.gitNormalizedBlobOid && currentModifiedPaths.has(path), `Alpha Inspect review-fix V7 content successor drifted: ${path}`);
      } else if (stateSuccessor) {
        assert(stateSuccessor.bytes === expectedCurrent.bytes && stateSuccessor.sha256 === expectedCurrent.sha256 && stateSuccessor.gitNormalizedBlobOid === expectedCurrent.gitBlobOid && stateSuccessor.priorState === expectedCurrent.gitState && stateSuccessor.currentState === "tracked-clean-at-alpha-inspect-head", `Alpha Inspect review-fix committed-state successor drifted: ${path}`);
        assert(existsSync(absolute(path)) && statSync(absolute(path)).size === stateSuccessor.bytes && fileHash(path) === stateSuccessor.sha256 && pathAttributedGitBlobOid(path) === stateSuccessor.gitNormalizedBlobOid && currentTrackedPaths.has(path) && !currentModifiedPaths.has(path) && !currentUntrackedPaths.has(path), `Alpha Inspect review-fix committed-state successor is not clean: ${path}`);
      } else {
        assert(existsSync(absolute(path)) && statSync(absolute(path)).size === expectedCurrent.bytes && fileHash(path) === expectedCurrent.sha256 && pathAttributedGitBlobOid(path) === expectedCurrent.gitBlobOid, `Alpha Inspect review-fix current file drifted: ${path}`);
      }
    }
  }
  assert(upContactShadowPolicies.length === 1 && Boolean(upContactShadowPolicy), "Asset policy must declare exactly one Up contact-shadow context refresh");
  assert(existsSync(absolute(upContactShadowRefreshPath)), `Missing Up contact-shadow context refresh: ${upContactShadowRefreshPath}`);
  if (existsSync(absolute(upContactShadowRefreshPath))) {
    assert(statSync(absolute(upContactShadowRefreshPath)).size === 7020 && fileHash(upContactShadowRefreshPath) === "550ee99936cd52003b24e5e098cab2139d7fb6f4510aed36308f89dc6c88b70e", "Up contact-shadow refresh record identity drifted");
    assert(upContactShadowPolicy?.recordBytes === 7020 && upContactShadowPolicy?.recordSha256 === "550ee99936cd52003b24e5e098cab2139d7fb6f4510aed36308f89dc6c88b70e", "Up contact-shadow policy record identity drifted");
  }
  assert(upContactShadowRefresh?.schemaVersion === 1 && upContactShadowRefresh?.kind === "managed-context-up-contact-shadow-refresh" && upContactShadowRefresh?.hashAlgorithm === "sha256", "Up contact-shadow refresh schema/kind/hash contract drifted");
  assert(upContactShadowRefresh?.authorization?.milestone === "Build — Up Contact-Shadow Correction" && upContactShadowRefresh?.authorization?.sourceMilestone === "Build — Alpha Inspect Camera & Jack Grounding", "Up contact-shadow authorization drifted");
  assert(upContactShadowRefresh?.authorization?.generalMutableContextException === false && upContactShadowRefresh?.authorization?.assetPathByteTierImportOrDispositionChangeAuthorized === false && upContactShadowRefresh?.authorization?.dependencyChangeAuthorized === false && upContactShadowRefresh?.authorization?.externalOrGitActionAuthorized === false && upContactShadowRefresh?.authorization?.subjectiveAcceptanceOrLockAuthorized === false, "Up contact-shadow authority widened");
  assert(upContactShadowRefresh?.repositoryState?.head === "372b82d6853259a2580e554ed2d869f65f1f5c87" && upContactShadowRefresh?.repositoryState?.stagedPathCount === 0 && upContactShadowRefresh?.repositoryState?.stagedPaths?.length === 0 && upContactShadowRefresh?.repositoryState?.externalOrGitActionPerformed === false, "Up contact-shadow repository-state record drifted");
  assert(upContactShadowRefresh?.immutablePredecessor?.record === alphaInspectReviewFixRefreshPath && upContactShadowRefresh?.immutablePredecessor?.recordBytes === 7518 && upContactShadowRefresh?.immutablePredecessor?.recordSha256 === "db398e0d5772e1e0ab76fb5f3ad9580cf4eac21a82bf1d8a6b5ff5ec2e71655c" && upContactShadowRefresh?.immutablePredecessor?.immutable === true, "Up contact-shadow immutable predecessor drifted");
  assert(fileHash(alphaInspectReviewFixRefreshPath) === "db398e0d5772e1e0ab76fb5f3ad9580cf4eac21a82bf1d8a6b5ff5ec2e71655c", "Immutable Alpha Inspect review-fix record drifted after Up contact-shadow refresh");
  assert(upContactShadowPolicy?.kind === "checksum-bound-managed-context-up-contact-shadow-refresh" && upContactShadowPolicy?.milestone === "Build — Up Contact-Shadow Correction" && upContactShadowPolicy?.predecessor === alphaInspectReviewFixRefreshPath && upContactShadowPolicy?.predecessorRecordSha256 === "db398e0d5772e1e0ab76fb5f3ad9580cf4eac21a82bf1d8a6b5ff5ec2e71655c", "Up contact-shadow policy predecessor contract drifted");
  assert(upContactShadowPolicy?.generalMutableContextException === false && upContactShadowPolicy?.assetPathByteTierImportOrDispositionChangeAuthorized === false && upContactShadowPolicy?.dependencyChangeAuthorized === false && upContactShadowPolicy?.externalOrGitActionAuthorized === false && upContactShadowPolicy?.subjectiveAcceptanceOrLockAuthorized === false, "Up contact-shadow policy authority widened");

  const expectedUpContactShadowSceneChain = [
    { role: "review-fix-verified-predecessor", bytes: 16712, sha256: "ea74d4243ad80cf3d7e92001cd7b0bfebd869276ffb9c091c767cde09560ac14", gitBlobOid: "13d80295067773fe9dc39fa1f00825013a7bf5a5" },
    { role: "authorized-hard-reset-intermediate", bytes: 17125, sha256: "a79fbd66ee09ae45dd2da7c2485e4d4dc4b04914a80280b1f017d833ccce2357", gitBlobOid: "cf917727d9b63e4ff1c2d3fe4c2ee9c82e0b7f74" },
    { role: "authorized-up-contact-shadow-successor", bytes: 18031, sha256: "dcc5f779dfa7425b70795544f78a23d0351aafea681c8e06711c88cb6a23a644", gitBlobOid: "62e285f0bf708c46c0ef74d00f4e5ec53f4463d3", lastWriteTimeUtc: "2026-08-17T21:13:03.4896220Z", gitState: "tracked-modified" },
  ];
  assert(upContactShadowSceneChain.length === expectedUpContactShadowSceneChain.length && upContactShadowPolicySceneChain.length === expectedUpContactShadowSceneChain.length, "Up contact-shadow scene chain must contain exactly predecessor, hard-reset intermediate, and final successor");
  for (let index = 0; index < expectedUpContactShadowSceneChain.length; index += 1) {
    const expected = expectedUpContactShadowSceneChain[index];
    const recorded = upContactShadowSceneChain[index];
    const policyRecorded = upContactShadowPolicySceneChain[index];
    assert(recorded?.path === "src/pet-room-scene.web.tsx" && recorded?.role === expected.role && recorded?.bytes === expected.bytes && recorded?.sha256 === expected.sha256 && recorded?.gitNormalizedBlobOid === expected.gitBlobOid, `Up contact-shadow scene record chain drifted at index ${index}`);
    assert(policyRecorded?.role === expected.role && policyRecorded?.bytes === expected.bytes && policyRecorded?.sha256 === expected.sha256 && policyRecorded?.gitBlobOid === expected.gitBlobOid, `Up contact-shadow policy scene chain drifted at index ${index}`);
  }
  const expectedUpScene = expectedUpContactShadowSceneChain[2];
  assert(upContactShadowSceneCurrent?.lastWriteTimeUtc === expectedUpScene.lastWriteTimeUtc && upContactShadowSceneCurrent?.gitState === expectedUpScene.gitState, "Up contact-shadow final scene mtime/state drifted");
  const upSceneStateSuccessor = healthStatusMedicineStateSuccessorByPath.get("src/pet-room-scene.web.tsx");
  assert(upSceneStateSuccessor?.bytes === expectedUpScene.bytes && upSceneStateSuccessor?.sha256 === expectedUpScene.sha256 && upSceneStateSuccessor?.gitNormalizedBlobOid === expectedUpScene.gitBlobOid && upSceneStateSuccessor?.priorState === "tracked-modified" && upSceneStateSuccessor?.currentState === "tracked-clean-at-alpha-inspect-head", "Up contact-shadow current scene state-successor record drifted");
  assert(statSync(absolute("src/pet-room-scene.web.tsx")).size === expectedUpScene.bytes && fileHash("src/pet-room-scene.web.tsx") === expectedUpScene.sha256 && pathAttributedGitBlobOid("src/pet-room-scene.web.tsx") === expectedUpScene.gitBlobOid && currentTrackedPaths.has("src/pet-room-scene.web.tsx") && !currentModifiedPaths.has("src/pet-room-scene.web.tsx") && !currentUntrackedPaths.has("src/pet-room-scene.web.tsx"), "Up contact-shadow current scene identity/state drifted");

  const expectedUpContactShadowManagedFiles = new Map([
    ["src/up-contact-shadow-policy.ts", { bytes: 1244, sha256: "92d7eb0ba294d928b7a630324397f431970bcb8cef19d0bb5cfd6b62d85700e7", gitBlobOid: "98f1a2efb9faebe483184da4ead0edd98f3d10d4", lastWriteTimeUtc: "2026-08-17T21:22:28.8004666Z", gitState: "untracked" }],
    ["src/up-contact-shadow-policy.test.ts", { bytes: 1764, sha256: "751e78825ec419dd537412b41db61cd434ecb7f4bb9b0aa6009ef9d993954735", gitBlobOid: "da67d3d0d28afc28c4a4a045dfbbad8b4bf9027f", lastWriteTimeUtc: "2026-08-17T21:13:01.8978786Z", gitState: "untracked" }],
  ]);
  assert(upContactShadowManagedFiles.length === expectedUpContactShadowManagedFiles.size && upContactShadowManagedByPath.size === expectedUpContactShadowManagedFiles.size && upContactShadowPolicyManagedFiles.length === expectedUpContactShadowManagedFiles.size && upContactShadowPolicyManagedByPath.size === expectedUpContactShadowManagedFiles.size, "Up contact-shadow managed-file set drifted");
  for (const [path, expected] of expectedUpContactShadowManagedFiles) {
    const recorded = upContactShadowManagedByPath.get(path);
    const policyRecorded = upContactShadowPolicyManagedByPath.get(path);
    assert(recorded?.bytes === expected.bytes && recorded?.sha256 === expected.sha256 && recorded?.gitNormalizedBlobOid === expected.gitBlobOid && recorded?.lastWriteTimeUtc === expected.lastWriteTimeUtc && recorded?.gitState === expected.gitState, `Up contact-shadow managed-file record drifted: ${path}`);
    assert(policyRecorded?.bytes === expected.bytes && policyRecorded?.sha256 === expected.sha256 && policyRecorded?.gitBlobOid === expected.gitBlobOid, `Up contact-shadow managed-file policy drifted: ${path}`);
    const stateSuccessor = healthStatusMedicineStateSuccessorByPath.get(path);
    assert(stateSuccessor?.bytes === expected.bytes && stateSuccessor?.sha256 === expected.sha256 && stateSuccessor?.gitNormalizedBlobOid === expected.gitBlobOid && stateSuccessor?.priorState === "untracked" && stateSuccessor?.currentState === "tracked-clean-at-alpha-inspect-head", `Up contact-shadow committed-state successor drifted: ${path}`);
    assert(existsSync(absolute(path)) && statSync(absolute(path)).size === expected.bytes && fileHash(path) === expected.sha256 && pathAttributedGitBlobOid(path) === expected.gitBlobOid && currentTrackedPaths.has(path) && !currentModifiedPaths.has(path) && !currentUntrackedPaths.has(path), `Up contact-shadow current managed file drifted: ${path}`);
  }
  const upShadowContract = upContactShadowRefresh?.contactShadowContract;
  assert(upShadowContract?.enabledOnlyWhen?.clip === "training_up" && upShadowContract?.enabledOnlyWhen?.poseHeld === true && upShadowContract?.shadowCount === 2 && upShadowContract?.floorY === 0 && upShadowContract?.shadowY === 0.002, "Up contact-shadow activation/ground contract drifted");
  assert(upShadowContract?.radius === 0.18 && upShadowContract?.scale?.join(",") === "1,0.46,1" && upShadowContract?.opacity === 0.32 && upShadowContract?.heldUpBaseShadowOpacity === 0.16 && upShadowContract?.normalAndAirborneBaseShadowOpacity === 0.24, "Up contact-shadow visual treatment contract drifted");
  assert(upShadowContract?.modelRootAnimationOrGroundingTransformChanged === false && upShadowContract?.cameraContractChanged === false, "Up contact-shadow implementation widened into grounding or camera behavior");
  assert(upContactShadowRefresh?.authoritativeGroundingInvariants?.policySha256 === "394bcad2239ca0d8af8dd9daa1ff2cba57f9451377a475752312f72e1983dd5b" && fileHash("src/pet-room-3d-policy.ts") === "394bcad2239ca0d8af8dd9daa1ff2cba57f9451377a475752312f72e1983dd5b", "Authoritative grounding policy drifted during Up contact-shadow correction");
  assert(upContactShadowRefresh?.authoritativeGroundingInvariants?.testSha256 === "a6d6fb93f08faee1c41c2526abe1206af3c3160f1664ac78627a3c87ee5acc19" && fileHash("src/pet-room-3d-policy.test.ts") === "a6d6fb93f08faee1c41c2526abe1206af3c3160f1664ac78627a3c87ee5acc19", "Authoritative grounding-policy test drifted during Up contact-shadow correction");
  assert(upContactShadowRefresh?.liveVerification?.phone?.pageReportedViewport?.join("x") === "390x844" && upContactShadowRefresh?.liveVerification?.phone?.documentScrollWidth === 390 && upContactShadowRefresh?.liveVerification?.phone?.horizontalOverflow === false && upContactShadowRefresh?.liveVerification?.phone?.settledUpHindPawsReadAsGrounded === true, "Up contact-shadow phone verification record drifted");
  assert(upContactShadowRefresh?.liveVerification?.desktop?.pageReportedViewport?.join("x") === "1440x900" && upContactShadowRefresh?.liveVerification?.desktop?.documentScrollWidth === 1440 && upContactShadowRefresh?.liveVerification?.desktop?.horizontalOverflow === false && upContactShadowRefresh?.liveVerification?.desktop?.settledUpHindPawsReadAsGrounded === true, "Up contact-shadow desktop verification record drifted");
  assert(upContactShadowRefresh?.controlPlanePredecessors?.assetPolicy?.bytes === 42450 && upContactShadowRefresh?.controlPlanePredecessors?.assetPolicy?.sha256 === "55c8a85c4a05bfc354c6dc027dfa195596ca6089ad34b64caa6623bfc8f83305", "Up contact-shadow asset-policy predecessor drifted");
  assert(upContactShadowRefresh?.controlPlanePredecessors?.assetVerifier?.bytes === 176106 && upContactShadowRefresh?.controlPlanePredecessors?.assetVerifier?.sha256 === "adcd1309ac36d63cba93f02304c3f67161011edcbf03ec9f38c453659e94705d", "Up contact-shadow verifier predecessor drifted");
  assert(upContactShadowRefresh?.unchangedInvariants?.classificationSha256 === "6ffeda49065df33d9120aea0a452c2f710cec2829b045bf341faab4ec08f60fb" && upContactShadowPolicy?.unchangedClassificationSha256 === "6ffeda49065df33d9120aea0a452c2f710cec2829b045bf341faab4ec08f60fb", "Up contact-shadow historical classification invariant drifted");
  assert(upContactShadowRefresh?.unchangedInvariants?.packageJsonSha256 === "9a8da679e65de153a806328c432ef8040eab8eecae40f778961bd69840f1ecfa" && fileHash("package.json") === "9a8da679e65de153a806328c432ef8040eab8eecae40f778961bd69840f1ecfa", "Up contact-shadow package.json invariant drifted");
  assert(upContactShadowRefresh?.unchangedInvariants?.packageLockJsonSha256 === "cd14e95daefbd563eb2f58207cb9bbd3edbb40f05cfeafaeece4454a57522b38" && fileHash("package-lock.json") === "cd14e95daefbd563eb2f58207cb9bbd3edbb40f05cfeafaeece4454a57522b38", "Up contact-shadow package-lock invariant drifted");
  assert(upContactShadowRefresh?.unchangedInvariants?.governedAssetFileCount === 125 && upContactShadowRefresh?.unchangedInvariants?.governedAssetBytes === 448676672 && upContactShadowRefresh?.unchangedInvariants?.governedAssetAggregateSha256 === "531942b4f52e51762d142c04dc79dc280456c09e50d8f699da463baf402a7b4f", "Up contact-shadow governed-asset invariant drifted");
  assert(upContactShadowRefresh?.unchangedInvariants?.assetPathChanges === 0 && upContactShadowRefresh?.unchangedInvariants?.assetByteChanges === 0 && upContactShadowRefresh?.unchangedInvariants?.assetTierChanges === 0 && upContactShadowRefresh?.unchangedInvariants?.runtimeImportChanges === 0 && upContactShadowRefresh?.unchangedInvariants?.assetDispositionChanges === 0 && upContactShadowRefresh?.unchangedInvariants?.classificationChanges === 0, "Up contact-shadow asset/classification scope widened");
  assert(healthStatusMedicinePolicies.length === 1 && Boolean(healthStatusMedicinePolicy), "Asset policy must declare exactly one V7 health/status managed-context successor");
  assert(existsSync(absolute(healthStatusMedicineRefreshPath)) && statSync(absolute(healthStatusMedicineRefreshPath)).size === 14873 && fileHash(healthStatusMedicineRefreshPath) === "d68c8dde360cdd1cb303f8e8720978a259c97dfcb62008ce15b48a3ddc49ecd4" && healthStatusMedicinePolicy?.recordBytes === 14873 && healthStatusMedicinePolicy?.recordSha256 === "d68c8dde360cdd1cb303f8e8720978a259c97dfcb62008ce15b48a3ddc49ecd4", "V7 health/status context/policy record identity drifted");
  assert(healthStatusMedicineRefresh?.schemaVersion === 1 && healthStatusMedicineRefresh?.kind === "managed-context-health-status-medicine-refresh" && healthStatusMedicineRefresh?.hashAlgorithm === "sha256", "V7 health/status context schema/kind/hash drifted");
  const healthStatusClassificationScope = "Exactly one two-file, 108367-byte normal-Git representative-evidence group plus generatedAt; every prior group and source-inventory anchor remains unchanged.";
  assert(healthStatusMedicineRefresh?.authorization?.milestone === "Build — Health, Attention, Status & Medicine" && healthStatusMedicineRefresh?.authorization?.generalMutableContextException === false && healthStatusMedicineRefresh?.authorization?.assetPathByteTierImportOrDispositionChangeAuthorized === false && healthStatusMedicineRefresh?.authorization?.classificationChangeAuthorized === true && healthStatusMedicineRefresh?.authorization?.classificationChangeScope === healthStatusClassificationScope && healthStatusMedicineRefresh?.authorization?.evidenceExtensionCorrectionAuthorized === true && healthStatusMedicineRefresh?.authorization?.dependencyChangeAuthorized === false && healthStatusMedicineRefresh?.authorization?.externalOrGitActionAuthorized === false && healthStatusMedicineRefresh?.authorization?.subjectiveAcceptanceOrLockAuthorized === false, "V7 health/status context authority widened");
  assert(healthStatusMedicineRefresh?.repositoryState?.head === "8e01e9d36faaaa74d79ea6f51777fce6319875e5" && healthStatusMedicineRefresh?.repositoryState?.branch === "codex/jack-v05" && healthStatusMedicineRefresh?.repositoryState?.stagedPathCount === 0 && healthStatusMedicineRefresh?.repositoryState?.stagedPaths?.length === 0 && healthStatusMedicineRefresh?.repositoryState?.externalOrGitActionPerformed === false, "V7 health/status repository-state record drifted");
  const healthStatusPredecessors = new Map((healthStatusMedicineRefresh?.immutablePredecessors ?? []).map((entry) => [entry.role, entry]));
  assert(healthStatusPredecessors.size === 3, "V7 health/status immutable predecessor set drifted");
  assert(healthStatusPredecessors.get("authoritative-prior-identities")?.record === initialJournalAmbiguityRefreshPath && healthStatusPredecessors.get("authoritative-prior-identities")?.recordBytes === 7885 && healthStatusPredecessors.get("authoritative-prior-identities")?.recordSha256 === "99717544e31e46774e88b56f9afd018fd734863066aeb79454d36954ab37e409" && healthStatusPredecessors.get("authoritative-prior-identities")?.immutable === true, "V7 health/status identity predecessor drifted");
  assert(healthStatusPredecessors.get("safe-return-commit-status-witness")?.record === alphaInspectStatusRefreshPath && healthStatusPredecessors.get("safe-return-commit-status-witness")?.recordSha256 === "e2849dbd7c9c0ad1214c286628dcedc73567beb86b39fb99223cffaae99f0839" && healthStatusPredecessors.get("safe-return-commit-status-witness")?.immutable === true, "V7 health/status commit witness drifted");
  assert(healthStatusPredecessors.get("latest-append-only-asset-control-record")?.record === upContactShadowRefreshPath && healthStatusPredecessors.get("latest-append-only-asset-control-record")?.recordSha256 === "550ee99936cd52003b24e5e098cab2139d7fb6f4510aed36308f89dc6c88b70e" && healthStatusPredecessors.get("latest-append-only-asset-control-record")?.immutable === true, "V7 health/status latest append-only predecessor drifted");
  assert(fileHash(initialJournalAmbiguityRefreshPath) === "99717544e31e46774e88b56f9afd018fd734863066aeb79454d36954ab37e409" && fileHash(alphaInspectStatusRefreshPath) === "e2849dbd7c9c0ad1214c286628dcedc73567beb86b39fb99223cffaae99f0839" && fileHash(upContactShadowRefreshPath) === "550ee99936cd52003b24e5e098cab2139d7fb6f4510aed36308f89dc6c88b70e", "Immutable V7 health/status predecessor record drifted");
  assert(healthStatusMedicinePolicy?.kind === "checksum-bound-managed-context-health-status-medicine-refresh" && healthStatusMedicinePolicy?.milestone === "Build — Health, Attention, Status & Medicine", "V7 health/status policy kind or milestone drifted");
  assert(healthStatusMedicinePolicy?.identityPredecessor === initialJournalAmbiguityRefreshPath && healthStatusMedicinePolicy?.identityPredecessorRecordSha256 === "99717544e31e46774e88b56f9afd018fd734863066aeb79454d36954ab37e409" && healthStatusMedicinePolicy?.latestAppendOnlyPredecessor === upContactShadowRefreshPath && healthStatusMedicinePolicy?.latestAppendOnlyPredecessorRecordSha256 === "550ee99936cd52003b24e5e098cab2139d7fb6f4510aed36308f89dc6c88b70e", "V7 health/status policy predecessor chain drifted");
  assert(healthStatusMedicinePolicy?.generalMutableContextException === false && healthStatusMedicinePolicy?.assetPathByteTierImportOrDispositionChangeAuthorized === false && healthStatusMedicinePolicy?.classificationChangeAuthorized === true && healthStatusMedicinePolicy?.classificationChangeScope === healthStatusClassificationScope && healthStatusMedicinePolicy?.evidenceExtensionCorrectionAuthorized === true && healthStatusMedicinePolicy?.dependencyChangeAuthorized === false && healthStatusMedicinePolicy?.externalOrGitActionAuthorized === false && healthStatusMedicinePolicy?.subjectiveAcceptanceOrLockAuthorized === false, "V7 health/status policy authority widened");
  assert(healthStatusMedicineTransitions.length === 3 && healthStatusMedicineTransitionByPath.size === expectedHealthStatusMedicineTransitions.size && healthStatusMedicinePolicyTransitions.length === 3 && healthStatusMedicinePolicyTransitionByPath.size === expectedHealthStatusMedicineTransitions.size, "V7 health/status transition set drifted");
  for (const [path, expected] of expectedHealthStatusMedicineTransitions) {
    const transition = healthStatusMedicineTransitionByPath.get(path);
    const policyTransition = healthStatusMedicinePolicyTransitionByPath.get(path);
    const identityPredecessor = initialJournalAmbiguityTransitionByPath.get(path);
    assert(Boolean(transition && policyTransition && identityPredecessor), `V7 health/status transition chain is incomplete: ${path}`);
    assert(transition?.prior?.bytes === expected.prior.bytes && transition?.prior?.sha256 === expected.prior.sha256 && transition?.prior?.gitNormalizedBlobOid === expected.prior.gitBlobOid && transition?.prior?.identitySource === "safe-return-committed-successor", `V7 health/status prior identity drifted: ${path}`);
    assert(identityPredecessor?.current?.bytes === expected.prior.bytes && identityPredecessor?.current?.sha256 === expected.prior.sha256, `V7 health/status prior does not preserve initial-journal history: ${path}`);
    const committed = execFileSync("git", ["show", `HEAD:${path}`], { cwd: root });
    assert(committed.length === expected.prior.bytes && sha256(committed) === expected.prior.sha256 && gitOutput(["rev-parse", `HEAD:${path}`]) === expected.prior.gitBlobOid, `V7 health/status prior does not match committed HEAD: ${path}`);
    assert(transition?.current?.bytes === expected.current.bytes && transition?.current?.sha256 === expected.current.sha256 && transition?.current?.gitNormalizedBlobOid === expected.current.gitBlobOid && transition?.current?.lastWriteTimeUtc === expected.current.lastWriteTimeUtc && transition?.current?.gitState === "tracked-modified", `V7 health/status current record drifted: ${path}`);
    assert(policyTransition?.priorBytes === expected.prior.bytes && policyTransition?.priorSha256 === expected.prior.sha256 && policyTransition?.priorGitBlobOid === expected.prior.gitBlobOid && policyTransition?.currentBytes === expected.current.bytes && policyTransition?.currentSha256 === expected.current.sha256 && policyTransition?.currentGitBlobOid === expected.current.gitBlobOid, `V7 health/status policy transition drifted: ${path}`);
    assert(existsSync(absolute(path)) && statSync(absolute(path)).size === expected.current.bytes && fileHash(path) === expected.current.sha256 && pathAttributedGitBlobOid(path) === expected.current.gitBlobOid, `V7 health/status current file identity drifted: ${path}`);
    assert(Math.abs(statSync(absolute(path)).mtimeMs - new Date(expected.current.lastWriteTimeUtc).getTime()) < 1 && currentModifiedPaths.has(path) && !currentUntrackedPaths.has(path), `V7 health/status current state drifted: ${path}`);
  }
  assert(healthStatusMedicineSupportingTransitions.length === 4 && healthStatusMedicineSupportingTransitionByPath.size === expectedHealthStatusMedicineSupportingTransitions.size && healthStatusMedicinePolicy?.supportingContentTransitionCount === 4, "V7 supporting-content transition set drifted");
  for (const [path, expected] of expectedHealthStatusMedicineSupportingTransitions) {
    const transition = healthStatusMedicineSupportingTransitionByPath.get(path);
    assert(transition?.prior?.bytes === expected.prior.bytes && transition?.prior?.sha256 === expected.prior.sha256 && transition?.prior?.gitNormalizedBlobOid === expected.prior.gitBlobOid, `V7 supporting-content prior identity drifted: ${path}`);
    const committed = execFileSync("git", ["show", `HEAD:${path}`], { cwd: root });
    assert(committed.length === expected.prior.bytes && sha256(committed) === expected.prior.sha256 && gitOutput(["rev-parse", `HEAD:${path}`]) === expected.prior.gitBlobOid, `V7 supporting-content prior does not match committed HEAD: ${path}`);
    assert(transition?.current?.bytes === expected.current.bytes && transition?.current?.sha256 === expected.current.sha256 && transition?.current?.gitNormalizedBlobOid === expected.current.gitBlobOid && transition?.current?.lastWriteTimeUtc === expected.current.lastWriteTimeUtc && transition?.current?.gitState === "tracked-modified", `V7 supporting-content current record drifted: ${path}`);
    assert(existsSync(absolute(path)) && statSync(absolute(path)).size === expected.current.bytes && fileHash(path) === expected.current.sha256 && pathAttributedGitBlobOid(path) === expected.current.gitBlobOid && currentModifiedPaths.has(path) && !currentUntrackedPaths.has(path), `V7 supporting-content current identity/state drifted: ${path}`);
  }
  assert(healthStatusMedicineStateSuccessors.length === 8 && healthStatusMedicineStateSuccessorByPath.size === expectedHealthStatusMedicineStateSuccessors.size && healthStatusMedicinePolicy?.committedStateSuccessorCount === 8, "V7 committed-state successor set drifted");
  for (const [path, expected] of expectedHealthStatusMedicineStateSuccessors) {
    const successor = healthStatusMedicineStateSuccessorByPath.get(path);
    assert(successor?.bytes === expected.bytes && successor?.sha256 === expected.sha256 && successor?.gitNormalizedBlobOid === expected.gitBlobOid && successor?.priorState === expected.priorState && successor?.currentState === "tracked-clean-at-alpha-inspect-head" && successor?.bytesChanged === false, `V7 committed-state successor record drifted: ${path}`);
    const committed = execFileSync("git", ["show", `HEAD:${path}`], { cwd: root });
    assert(committed.length === expected.bytes && sha256(committed) === expected.sha256 && gitOutput(["rev-parse", `HEAD:${path}`]) === expected.gitBlobOid, `V7 committed-state successor does not match HEAD: ${path}`);
    assert(existsSync(absolute(path)) && statSync(absolute(path)).size === expected.bytes && fileHash(path) === expected.sha256 && pathAttributedGitBlobOid(path) === expected.gitBlobOid && currentTrackedPaths.has(path) && !currentModifiedPaths.has(path) && !currentUntrackedPaths.has(path), `V7 committed-state successor is not clean: ${path}`);
  }
  assert(healthStatusMedicineEvidenceFiles.length === 2 && healthStatusMedicineEvidenceByPath.size === expectedHealthStatusMedicineEvidence.size && healthStatusMedicineRefresh?.representativeEvidence?.bytes === 108367 && healthStatusMedicineRefresh?.representativeEvidence?.fileCount === 2, "V7 representative-evidence set drifted");
  for (const [path, expected] of expectedHealthStatusMedicineEvidence) {
    const evidence = healthStatusMedicineEvidenceByPath.get(path);
    const dimensions = existsSync(absolute(path)) ? jpegDimensions(path) : null;
    assert(evidence?.sourcePath === expected.sourcePath && evidence?.currentPath === path && evidence?.bytes === expected.bytes && evidence?.sha256 === expected.sha256 && evidence?.gitNormalizedBlobOid === expected.gitBlobOid && evidence?.dimensions?.join("x") === `${expected.width}x${expected.height}` && evidence?.signature === "jpeg-jfif" && evidence?.bytesChangedByRename === false, `V7 representative-evidence record drifted: ${path}`);
    assert(!existsSync(absolute(expected.sourcePath)), `V7 representative-evidence obsolete PNG extension still exists: ${expected.sourcePath}`);
    assert(existsSync(absolute(path)) && statSync(absolute(path)).size === expected.bytes && fileHash(path) === expected.sha256 && pathAttributedGitBlobOid(path) === expected.gitBlobOid, `V7 representative-evidence identity drifted: ${path}`);
    assert(dimensions?.width === expected.width && dimensions?.height === expected.height && dimensions?.signature === "jpeg-jfif", `V7 representative-evidence JPEG signature/dimensions drifted: ${path}`);
  }
  const healthStatusEvidenceRule = (policy.classificationRules ?? []).find((entry) => entry.id === "normal-git-evidence-health-status-medicine");
  const healthStatusEvidenceSet = (policy.representativeEvidenceSets ?? []).find((entry) => entry.id === "health-status-medicine");
  const expectedHealthStatusEvidencePaths = [...expectedHealthStatusMedicineEvidence.keys()];
  assert(healthStatusEvidenceRule?.tier === "normal-git" && healthStatusEvidenceRule?.pathGlobs?.length === 2 && new Set(healthStatusEvidenceRule.pathGlobs.map(normalize)).size === 2 && expectedHealthStatusEvidencePaths.every((path) => healthStatusEvidenceRule.pathGlobs.map(normalize).includes(path)), "V7 representative-evidence classification rule drifted");
  assert(healthStatusEvidenceSet?.maxFiles === 2 && healthStatusEvidenceSet?.paths?.length === 2 && new Set(healthStatusEvidenceSet.paths.map(normalize)).size === 2 && expectedHealthStatusEvidencePaths.every((path) => healthStatusEvidenceSet.paths.map(normalize).includes(path)), "V7 representative-evidence retention set drifted");
  const healthStatusInvariants = healthStatusMedicineRefresh?.unchangedInvariants;
  assert(healthStatusInvariants?.classificationPath === classificationPath && healthStatusInvariants?.priorClassificationBytes === 138055 && healthStatusInvariants?.priorClassificationSha256 === "6ffeda49065df33d9120aea0a452c2f710cec2829b045bf341faab4ec08f60fb" && healthStatusMedicinePolicy?.priorClassificationSha256 === "6ffeda49065df33d9120aea0a452c2f710cec2829b045bf341faab4ec08f60fb", "V7 health/status prior-classification invariant drifted");
  assert(healthStatusInvariants?.currentClassificationBytes === 138776 && healthStatusInvariants?.currentClassificationSha256 === "febaa595afbd1d65e536f292bacd448b2d7c601649c8f8a5b85b159feb35a84a" && healthStatusMedicinePolicy?.currentClassificationBytes === 138776 && healthStatusMedicinePolicy?.currentClassificationSha256 === "febaa595afbd1d65e536f292bacd448b2d7c601649c8f8a5b85b159feb35a84a" && statSync(absolute(classificationPath)).size === 138776 && fileHash(classificationPath) === "febaa595afbd1d65e536f292bacd448b2d7c601649c8f8a5b85b159feb35a84a", "V7 health/status current-classification identity drifted");
  const priorHealthStatusClassification = JSON.parse(execFileSync("git", ["show", `HEAD:${classificationPath}`], { cwd: root, encoding: "utf8" }));
  const currentHealthStatusClassification = JSON.parse(readFileSync(absolute(classificationPath), "utf8"));
  const healthStatusClassificationGroup = currentHealthStatusClassification.groups?.find((group) => group.id === "normal-git-evidence-health-status-medicine");
  const unchangedHealthStatusClassificationGroups = currentHealthStatusClassification.groups?.filter((group) => group.id !== "normal-git-evidence-health-status-medicine");
  assert(healthStatusInvariants?.priorClassificationGroupCount === 22 && healthStatusInvariants?.currentClassificationGroupCount === 23 && priorHealthStatusClassification.groups?.length === 22 && currentHealthStatusClassification.groups?.length === 23, "V7 health/status classification group count drifted");
  assert(currentHealthStatusClassification.sourceInventory === priorHealthStatusClassification.sourceInventory && currentHealthStatusClassification.sourceInventoryAssetsSha256 === priorHealthStatusClassification.sourceInventoryAssetsSha256 && currentHealthStatusClassification.sourceInventoryEvidenceSha256 === priorHealthStatusClassification.sourceInventoryEvidenceSha256, "V7 health/status classification source-inventory anchor drifted");
  assert(JSON.stringify(unchangedHealthStatusClassificationGroups) === JSON.stringify(priorHealthStatusClassification.groups), "V7 health/status classification changed a prior group");
  assert(healthStatusClassificationGroup?.tier === "normal-git" && healthStatusClassificationGroup?.fileCount === 2 && healthStatusClassificationGroup?.bytes === 108367 && healthStatusClassificationGroup?.files?.length === 2 && healthStatusClassificationGroup.files.every((entry) => expectedHealthStatusMedicineEvidence.get(normalize(entry.path))?.bytes === entry.bytes && expectedHealthStatusMedicineEvidence.get(normalize(entry.path))?.sha256 === entry.sha256), "V7 health/status classification evidence group drifted");
  assert(healthStatusInvariants?.packageJsonSha256 === "9a8da679e65de153a806328c432ef8040eab8eecae40f778961bd69840f1ecfa" && fileHash("package.json") === healthStatusInvariants.packageJsonSha256 && healthStatusInvariants?.packageLockJsonSha256 === "cd14e95daefbd563eb2f58207cb9bbd3edbb40f05cfeafaeece4454a57522b38" && fileHash("package-lock.json") === healthStatusInvariants.packageLockJsonSha256, "V7 health/status package invariant drifted");
  assert(healthStatusInvariants?.governedAssetFileCount === 125 && healthStatusInvariants?.governedAssetBytes === 448676672 && healthStatusInvariants?.governedAssetAggregateSha256 === "531942b4f52e51762d142c04dc79dc280456c09e50d8f699da463baf402a7b4f", "V7 health/status governed-asset invariant drifted");
  assert(healthStatusInvariants?.assetPathChanges === 0 && healthStatusInvariants?.assetByteChanges === 0 && healthStatusInvariants?.assetTierChanges === 0 && healthStatusInvariants?.runtimeImportChanges === 0 && healthStatusInvariants?.assetDispositionChanges === 0 && healthStatusInvariants?.classificationChanges === 1 && healthStatusInvariants?.evidencePathRenames === 2 && healthStatusInvariants?.evidenceByteChanges === 0, "V7 health/status asset/classification scope widened");
  assert(healthStatusMedicineRefresh?.controlPlanePredecessors?.assetPolicy?.bytes === 47778 && healthStatusMedicineRefresh?.controlPlanePredecessors?.assetPolicy?.sha256 === "5745e4e7dd54090a33ebf9bc220d15db3fd0b5126c170a3eb35a74bb8fb32e54" && healthStatusMedicineRefresh?.controlPlanePredecessors?.assetVerifier?.bytes === 206218 && healthStatusMedicineRefresh?.controlPlanePredecessors?.assetVerifier?.sha256 === "e6c84064c08c02cc5d5bce02e0cd3415d5d029e73a920b774a62524f33f24dc6", "V7 health/status control-plane predecessor identity drifted");
  assert(alphaInspectReviewFixRefresh?.controlPlanePredecessors?.assetPolicy?.bytes === 39843 && alphaInspectReviewFixRefresh?.controlPlanePredecessors?.assetPolicy?.sha256 === "19e656e02f1ebe953285b3e269bee22d927cacf8aea6e57b3c5fb38faf2146a0", "Alpha Inspect review-fix asset-policy predecessor drifted");
  assert(alphaInspectReviewFixRefresh?.unchangedInvariants?.sceneSha256 === "ea74d4243ad80cf3d7e92001cd7b0bfebd869276ffb9c091c767cde09560ac14", "Alpha Inspect review-fix historical scene invariant drifted");
  assert(alphaInspectReviewFixRefresh?.unchangedInvariants?.policyTestSha256 === "a6d6fb93f08faee1c41c2526abe1206af3c3160f1664ac78627a3c87ee5acc19" && fileHash("src/pet-room-3d-policy.test.ts") === "a6d6fb93f08faee1c41c2526abe1206af3c3160f1664ac78627a3c87ee5acc19", "Alpha Inspect review-fix policy-test invariant drifted");
  assert(alphaInspectReviewFixRefresh?.unchangedInvariants?.classificationSha256 === "6ffeda49065df33d9120aea0a452c2f710cec2829b045bf341faab4ec08f60fb", "Alpha Inspect review-fix historical classification invariant drifted");
  assert(alphaInspectReviewFixRefresh?.unchangedInvariants?.packageJsonSha256 === "9a8da679e65de153a806328c432ef8040eab8eecae40f778961bd69840f1ecfa" && fileHash("package.json") === "9a8da679e65de153a806328c432ef8040eab8eecae40f778961bd69840f1ecfa", "Alpha Inspect review-fix package.json invariant drifted");
  assert(alphaInspectReviewFixRefresh?.unchangedInvariants?.packageLockJsonSha256 === "cd14e95daefbd563eb2f58207cb9bbd3edbb40f05cfeafaeece4454a57522b38" && fileHash("package-lock.json") === "cd14e95daefbd563eb2f58207cb9bbd3edbb40f05cfeafaeece4454a57522b38", "Alpha Inspect review-fix package-lock.json invariant drifted");
  const alphaInspectInvariants = alphaInspectStatusRefresh?.unchangedInvariants;
  assert(alphaInspectInvariants?.classificationRecord === classificationPath && alphaInspectInvariants?.classificationRecordBytes === 138055 && alphaInspectInvariants?.classificationRecordSha256 === "6ffeda49065df33d9120aea0a452c2f710cec2829b045bf341faab4ec08f60fb", "Alpha Inspect historical classification invariant drifted");
  assert(alphaInspectStatusPolicy?.unchangedClassificationSha256 === "6ffeda49065df33d9120aea0a452c2f710cec2829b045bf341faab4ec08f60fb", "Alpha Inspect policy classification invariant drifted");
  assert(alphaInspectInvariants?.governedAssetFileCount === 125 && alphaInspectInvariants?.governedAssetBytes === 448676672 && alphaInspectInvariants?.governedAssetAggregateSha256 === "531942b4f52e51762d142c04dc79dc280456c09e50d8f699da463baf402a7b4f", "Alpha Inspect current governed-asset invariant drifted");
  assert(alphaInspectInvariants?.historicalGovernedAssetBytes === 448676678 && alphaInspectInvariants?.historicalGovernedAssetAggregateSha256 === "db504eb423e6e7eba9995421b708706062b554ed729762c9f75374901fb2f42b", "Alpha Inspect historical governed-asset invariant drifted");
  assert(alphaInspectInvariants?.packageJsonBytes === 1277 && alphaInspectInvariants?.packageJsonSha256 === "9a8da679e65de153a806328c432ef8040eab8eecae40f778961bd69840f1ecfa" && statSync(absolute("package.json")).size === 1277 && fileHash("package.json") === "9a8da679e65de153a806328c432ef8040eab8eecae40f778961bd69840f1ecfa", "Alpha Inspect package.json invariant drifted");
  assert(alphaInspectInvariants?.packageLockJsonBytes === 483873 && alphaInspectInvariants?.packageLockJsonSha256 === "cd14e95daefbd563eb2f58207cb9bbd3edbb40f05cfeafaeece4454a57522b38" && statSync(absolute("package-lock.json")).size === 483873 && fileHash("package-lock.json") === "cd14e95daefbd563eb2f58207cb9bbd3edbb40f05cfeafaeece4454a57522b38", "Alpha Inspect package-lock.json invariant drifted");
  assert(alphaInspectInvariants?.assetPathChanges === 0 && alphaInspectInvariants?.assetByteChanges === 0 && alphaInspectInvariants?.assetTierChanges === 0 && alphaInspectInvariants?.runtimeImportChanges === 0 && alphaInspectInvariants?.assetDispositionChanges === 0 && alphaInspectInvariants?.classificationChanges === 0, "Alpha Inspect asset/classification scope widened");
  assert(v4ManagedContextRefreshPolicies.length === 2 && Boolean(v4ManagedContextRefreshPolicy) && Boolean(initialJournalAmbiguityRefreshPolicy), "Asset policy must declare exactly the two authorized managed-context refreshes");
  assert(v4ManagedContextRefresh?.schemaVersion === 1 && v4ManagedContextRefresh?.kind === "managed-context-refresh", `${v4ManagedContextRefreshPath} schema/kind mismatch`);
  assert(v4ManagedContextRefresh?.hashAlgorithm === "sha256", `${v4ManagedContextRefreshPath} must use SHA-256`);
  assert(v4ManagedContextRefresh?.authorization?.milestone === "Build — V4 Managed-Context Hash Reconciliation" && v4ManagedContextRefresh?.authorization?.sourceMilestone === "Build — Explicit Reset Persistence Closure" && v4ManagedContextRefresh?.authorization?.sourceFixRound === 1, "V4 managed-context refresh authorization mismatch");
  assert(v4ManagedContextRefresh?.authorization?.generalMutableContextException === false, "V4 managed-context refresh must not create a general mutable-context exception");
  assert(v4ManagedContextRefresh?.repositoryState?.head === "9c8a82140d6116b29b0fa7444d9ba64e73e2baf4" && v4ManagedContextRefresh?.repositoryState?.stagedPathCount === 0 && v4ManagedContextRefresh?.repositoryState?.stagedPaths?.length === 0 && v4ManagedContextRefresh?.repositoryState?.externalOrGitActionPerformed === false, "V4 managed-context refresh repository-state record mismatch");
  assert(v4ManagedContextRefresh?.immutablePredecessor?.record === postBaselineMasteredDeltaPath && v4ManagedContextRefresh?.immutablePredecessor?.recordSha256 === "aa45bff433980f26600fe7627a49ad831e1d325556d8abf4f6095b873fc54f67" && v4ManagedContextRefresh?.immutablePredecessor?.immutable === true, "V4 managed-context immutable predecessor mismatch");
  assert(fileHash(postBaselineMasteredDeltaPath) === "aa45bff433980f26600fe7627a49ad831e1d325556d8abf4f6095b873fc54f67", "Immutable 95-to-125 intake delta record drifted");

  const expectedV4ManagedContextHistory = new Map([
    [postBaselineIntakePath, { recordSha256: "f474bae293be22fa6ca8fd28011350106943dc2602067ad78ff85b976c06eeb6", fileCount: 75, bytes: 418860110, aggregateSha256: "b0e16debbb690987ad84c168a3b84f8986f98263d44b4ff6c1502e872e9152a4" }],
    [postBaselineDeltaPath, { recordSha256: "32dada5d7a6a3c075ed29939ca4bab0b8e1db87d773a1265429c2463311c1a23", fileCount: 20, bytes: 7681560, aggregateSha256: "0691600367d637c1da18aee7bdcd17f4ebf79ce10b5a15674cf3d1af14a1180b" }],
    [postBaselineMasteredDeltaPath, { recordSha256: "aa45bff433980f26600fe7627a49ad831e1d325556d8abf4f6095b873fc54f67", fileCount: 30, bytes: 22135008, aggregateSha256: "de71338c2fb05e78a16eb0c7adb727c00f48756a06ba77201f3031215f9ca49f" }],
  ]);
  const v4ManagedContextHistory = v4ManagedContextRefresh?.appendOnlyHistory ?? [];
  const v4ManagedContextHistoryByRecord = new Map(v4ManagedContextHistory.map((entry) => [normalize(entry.record), entry]));
  assert(v4ManagedContextHistory.length === 3 && v4ManagedContextHistoryByRecord.size === expectedV4ManagedContextHistory.size, "V4 managed-context append-only history set mismatch");
  for (const [record, expected] of expectedV4ManagedContextHistory) {
    const entry = v4ManagedContextHistoryByRecord.get(record);
    assert(Boolean(entry) && entry?.immutable === true, `V4 managed-context history is missing or mutable: ${record}`);
    assert(entry?.recordSha256 === expected.recordSha256 && fileHash(record) === expected.recordSha256, `V4 managed-context history record identity drifted: ${record}`);
    assert(entry?.fileCount === expected.fileCount && entry?.bytes === expected.bytes && entry?.aggregateSha256 === expected.aggregateSha256, `V4 managed-context history summary drifted: ${record}`);
  }

  assert(v4ManagedContextTransitions.length === 3 && v4ManagedContextTransitionByPath.size === expectedV4ManagedContextTransitions.size, "V4 managed-context refresh must bind exactly three transitions");
  for (const [path, expected] of expectedV4ManagedContextTransitions) {
    const transition = v4ManagedContextTransitionByPath.get(path);
    assert(Boolean(transition), `V4 managed-context transition is missing: ${path}`);
    assert(transition?.prior?.bytes === expected.prior.bytes && transition?.prior?.sha256 === expected.prior.sha256 && transition?.prior?.lastWriteTimeUtc === expected.prior.lastWriteTimeUtc, `V4 managed-context prior identity drifted: ${path}`);
    assert(transition?.current?.bytes === expected.current.bytes && transition?.current?.sha256 === expected.current.sha256 && transition?.current?.lastWriteTimeUtc === expected.current.lastWriteTimeUtc && transition?.current?.gitState === "tracked-modified", `V4 managed-context current record drifted: ${path}`);
    const successor = initialJournalAmbiguityTransitionByPath.get(path);
    assert(successor?.prior?.bytes === expected.current.bytes && successor?.prior?.sha256 === expected.current.sha256 && successor?.prior?.lastWriteTimeUtc === expected.current.lastWriteTimeUtc, `V4 managed-context successor chain drifted: ${path}`);
    assert(existsSync(absolute(path)), `V4 managed-context current file is missing: ${path}`);
  }

  const v4PolicyTransitions = v4ManagedContextRefreshPolicy?.authorizedTransitions ?? [];
  const v4PolicyTransitionByPath = new Map(v4PolicyTransitions.map((entry) => [normalize(entry.path), entry]));
  assert(v4ManagedContextRefreshPolicy?.kind === "checksum-bound-managed-context-refresh" && v4ManagedContextRefreshPolicy?.predecessor === postBaselineMasteredDeltaPath && v4ManagedContextRefreshPolicy?.predecessorRecordSha256 === "aa45bff433980f26600fe7627a49ad831e1d325556d8abf4f6095b873fc54f67", "V4 managed-context policy predecessor contract mismatch");
  assert(v4ManagedContextRefreshPolicy?.sourceMilestone === "Build — Explicit Reset Persistence Closure" && v4ManagedContextRefreshPolicy?.sourceFixRound === 1 && v4ManagedContextRefreshPolicy?.generalMutableContextException === false, "V4 managed-context policy authorization mismatch");
  assert(v4ManagedContextRefreshPolicy?.governedAssetFileCount === 125 && v4ManagedContextRefreshPolicy?.governedAssetBytes === 448676678 && v4ManagedContextRefreshPolicy?.governedAssetAggregateSha256 === "db504eb423e6e7eba9995421b708706062b554ed729762c9f75374901fb2f42b", "V4 managed-context policy asset-set invariant mismatch");
  assert(v4PolicyTransitions.length === 3 && v4PolicyTransitionByPath.size === expectedV4ManagedContextTransitions.size, "V4 managed-context policy must contain exactly three authorized transitions");
  for (const [path, expected] of expectedV4ManagedContextTransitions) {
    const policyTransition = v4PolicyTransitionByPath.get(path);
    assert(policyTransition?.priorSha256 === expected.prior.sha256 && policyTransition?.currentSha256 === expected.current.sha256, `V4 managed-context policy transition drifted: ${path}`);
  }
  const v4AssetSet = v4ManagedContextRefresh?.governedAssetSet;
  assert(v4AssetSet?.fileCount === 125 && v4AssetSet?.bytes === 448676678 && v4AssetSet?.aggregateSha256 === "db504eb423e6e7eba9995421b708706062b554ed729762c9f75374901fb2f42b" && v4AssetSet?.missingFilesAtRecordCreation === 0 && v4AssetSet?.driftedFilesAtRecordCreation === 0 && v4AssetSet?.recordCreationRehashPasses === 1 && v4AssetSet?.requiredFinalVerifierPasses === 2, "V4 managed-context governed asset-set proof mismatch");
  const v4Invariants = v4ManagedContextRefresh?.unchangedInvariants;
  assert(v4Invariants?.assetPathChanges === 0 && v4Invariants?.assetByteChanges === 0 && v4Invariants?.assetTierChanges === 0 && v4Invariants?.runtimeImportChanges === 0 && v4Invariants?.assetDispositionChanges === 0 && v4Invariants?.classificationChanges === 0, "V4 managed-context refresh must record no asset or classification change");
  assert(v4Invariants?.classificationRecord === classificationPath && v4Invariants?.classificationRecordSha256 === "d1f1a637c1c438626bffb25911bdbcf50c754fc4581659f6cd507cb2a088f906", "V4 managed-context historical classification invariant drifted");
  assert(v4Invariants?.packageJsonSha256 === "9a8da679e65de153a806328c432ef8040eab8eecae40f778961bd69840f1ecfa" && fileHash("package.json") === v4Invariants.packageJsonSha256, "V4 managed-context package.json invariant drifted");
  assert(v4Invariants?.packageLockJsonSha256 === "cd14e95daefbd563eb2f58207cb9bbd3edbb40f05cfeafaeece4454a57522b38" && fileHash("package-lock.json") === v4Invariants.packageLockJsonSha256, "V4 managed-context package-lock.json invariant drifted");

  assert(initialJournalAmbiguityRefresh?.schemaVersion === 1 && initialJournalAmbiguityRefresh?.kind === "managed-context-refresh", `${initialJournalAmbiguityRefreshPath} schema/kind mismatch`);
  assert(initialJournalAmbiguityRefresh?.hashAlgorithm === "sha256", `${initialJournalAmbiguityRefreshPath} must use SHA-256`);
  assert(initialJournalAmbiguityRefresh?.authorization?.milestone === "Build — Initial Journal Ambiguity Closure" && initialJournalAmbiguityRefresh?.authorization?.sourceMilestone === "Build — Explicit Reset Persistence Closure" && initialJournalAmbiguityRefresh?.authorization?.sourceFixRound === 2, "Initial-journal ambiguity refresh authorization mismatch");
  assert(initialJournalAmbiguityRefresh?.authorization?.generalMutableContextException === false, "Initial-journal ambiguity refresh must not create a general mutable-context exception");
  assert(initialJournalAmbiguityRefresh?.repositoryState?.head === "9c8a82140d6116b29b0fa7444d9ba64e73e2baf4" && initialJournalAmbiguityRefresh?.repositoryState?.stagedPathCount === 0 && initialJournalAmbiguityRefresh?.repositoryState?.stagedPaths?.length === 0 && initialJournalAmbiguityRefresh?.repositoryState?.externalOrGitActionPerformed === false, "Initial-journal ambiguity repository-state record mismatch");
  assert(initialJournalAmbiguityRefresh?.immutablePredecessor?.record === v4ManagedContextRefreshPath && initialJournalAmbiguityRefresh?.immutablePredecessor?.recordSha256 === "03f8dd11fd8f0860bc3a84a3b2d70f7c806b49bf6cbcf1daf11e4c030763f17a" && initialJournalAmbiguityRefresh?.immutablePredecessor?.immutable === true, "Initial-journal ambiguity predecessor mismatch");
  assert(fileHash(v4ManagedContextRefreshPath) === "03f8dd11fd8f0860bc3a84a3b2d70f7c806b49bf6cbcf1daf11e4c030763f17a", "Immutable V4 managed-context refresh drifted");

  const initialJournalHistory = initialJournalAmbiguityRefresh?.appendOnlyHistory ?? [];
  const initialJournalHistoryByRecord = new Map(initialJournalHistory.map((entry) => [normalize(entry.record), entry]));
  assert(initialJournalHistory.length === 4 && initialJournalHistoryByRecord.size === 4, "Initial-journal ambiguity append-only history set mismatch");
  for (const [record, expected] of expectedV4ManagedContextHistory) {
    const entry = initialJournalHistoryByRecord.get(record);
    assert(Boolean(entry) && entry?.immutable === true, `Initial-journal ambiguity history is missing or mutable: ${record}`);
    assert(entry?.recordSha256 === expected.recordSha256 && fileHash(record) === expected.recordSha256, `Initial-journal ambiguity history record identity drifted: ${record}`);
    assert(entry?.fileCount === expected.fileCount && entry?.bytes === expected.bytes && entry?.aggregateSha256 === expected.aggregateSha256, `Initial-journal ambiguity history summary drifted: ${record}`);
  }
  const priorContextHistory = initialJournalHistoryByRecord.get(v4ManagedContextRefreshPath);
  assert(priorContextHistory?.recordSha256 === "03f8dd11fd8f0860bc3a84a3b2d70f7c806b49bf6cbcf1daf11e4c030763f17a" && priorContextHistory?.immutable === true && priorContextHistory?.transitionCount === 3 && priorContextHistory?.sourceFixRound === 1, "Initial-journal ambiguity V4 history link drifted");

  assert(initialJournalAmbiguityTransitions.length === 3 && initialJournalAmbiguityTransitionByPath.size === expectedInitialJournalAmbiguityTransitions.size, "Initial-journal ambiguity refresh must bind exactly three predecessor transitions");
  for (const [path, expected] of expectedInitialJournalAmbiguityTransitions) {
    const transition = initialJournalAmbiguityTransitionByPath.get(path);
    const predecessor = v4ManagedContextTransitionByPath.get(path);
    assert(Boolean(transition) && Boolean(predecessor), `Initial-journal ambiguity transition chain is missing: ${path}`);
    assert(transition?.prior?.bytes === expected.prior.bytes && transition?.prior?.sha256 === expected.prior.sha256 && transition?.prior?.lastWriteTimeUtc === expected.prior.lastWriteTimeUtc, `Initial-journal ambiguity prior identity drifted: ${path}`);
    assert(predecessor?.current?.bytes === transition?.prior?.bytes && predecessor?.current?.sha256 === transition?.prior?.sha256 && predecessor?.current?.lastWriteTimeUtc === transition?.prior?.lastWriteTimeUtc, `Initial-journal ambiguity predecessor linkage drifted: ${path}`);
    assert(transition?.current?.bytes === expected.current.bytes && transition?.current?.sha256 === expected.current.sha256 && transition?.current?.lastWriteTimeUtc === expected.current.lastWriteTimeUtc && transition?.current?.gitState === expected.current.gitState, `Initial-journal ambiguity current record drifted: ${path}`);
    assert(existsSync(absolute(path)), `Initial-journal ambiguity current file is missing: ${path}`);
    const currentSuccessor = healthStatusMedicineTransitionByPath.get(path);
    assert(currentSuccessor?.prior?.bytes === expected.current.bytes && currentSuccessor?.prior?.sha256 === expected.current.sha256, `Initial-journal ambiguity authorized V7 successor link drifted: ${path}`);
    assertCommittedStatusSuccessor("initial-journal-current", path, expected.current.gitState);
  }

  assert(initialJournalSupportingTransitions.length === 2 && initialJournalSupportingTransitionByPath.size === expectedInitialJournalSupportingTransitions.size, "Initial-journal ambiguity refresh must bind exactly two supporting transitions");
  for (const [path, expected] of expectedInitialJournalSupportingTransitions) {
    const transition = initialJournalSupportingTransitionByPath.get(path);
    assert(Boolean(transition), `Initial-journal ambiguity supporting transition is missing: ${path}`);
    assert(transition?.prior?.bytes === expected.prior.bytes && transition?.prior?.sha256 === expected.prior.sha256 && transition?.prior?.lastWriteTimeUtc === expected.prior.lastWriteTimeUtc && transition?.prior?.identitySource === "frozen-pass-2-handoff", `Initial-journal ambiguity supporting prior identity drifted: ${path}`);
    assert(transition?.current?.bytes === expected.current.bytes && transition?.current?.sha256 === expected.current.sha256 && transition?.current?.lastWriteTimeUtc === expected.current.lastWriteTimeUtc && transition?.current?.gitState === expected.current.gitState, `Initial-journal ambiguity supporting current record drifted: ${path}`);
    assert(existsSync(absolute(path)), `Initial-journal ambiguity supporting file is missing: ${path}`);
    const currentSuccessor = healthStatusMedicineSupportingTransitionByPath.get(path);
    if (currentSuccessor) {
      assert(currentSuccessor.prior?.bytes === expected.current.bytes && currentSuccessor.prior?.sha256 === expected.current.sha256 && currentSuccessor.prior?.gitNormalizedBlobOid === pathAttributedGitBlobOid(path, execFileSync("git", ["show", `HEAD:${path}`], { cwd: root })), `Initial-journal supporting V7 predecessor drifted: ${path}`);
      assert(statSync(absolute(path)).size === currentSuccessor.current?.bytes && fileHash(path) === currentSuccessor.current?.sha256 && pathAttributedGitBlobOid(path) === currentSuccessor.current?.gitNormalizedBlobOid && currentModifiedPaths.has(path), `Initial-journal supporting V7 current identity drifted: ${path}`);
    } else if (existsSync(absolute(path))) {
      assert(statSync(absolute(path)).size === expected.current.bytes && fileHash(path) === expected.current.sha256, `Initial-journal ambiguity supporting identity drifted: ${path}`);
      assert(Math.abs(statSync(absolute(path)).mtimeMs - new Date(expected.current.lastWriteTimeUtc).getTime()) < 1, `Initial-journal ambiguity supporting mtime drifted: ${path}`);
    }
    assertCommittedStatusSuccessor("initial-journal-current", path, expected.current.gitState);
  }

  const initialJournalPolicyTransitions = initialJournalAmbiguityRefreshPolicy?.authorizedTransitions ?? [];
  const initialJournalPolicyTransitionByPath = new Map(initialJournalPolicyTransitions.map((entry) => [normalize(entry.path), entry]));
  const initialJournalPolicySupporting = initialJournalAmbiguityRefreshPolicy?.supportingTransitions ?? [];
  const initialJournalPolicySupportingByPath = new Map(initialJournalPolicySupporting.map((entry) => [normalize(entry.path), entry]));
  assert(initialJournalAmbiguityRefreshPolicy?.kind === "checksum-bound-managed-context-refresh" && initialJournalAmbiguityRefreshPolicy?.predecessor === v4ManagedContextRefreshPath && initialJournalAmbiguityRefreshPolicy?.predecessorRecordSha256 === "03f8dd11fd8f0860bc3a84a3b2d70f7c806b49bf6cbcf1daf11e4c030763f17a", "Initial-journal ambiguity policy predecessor contract mismatch");
  assert(initialJournalAmbiguityRefreshPolicy?.sourceMilestone === "Build — Explicit Reset Persistence Closure" && initialJournalAmbiguityRefreshPolicy?.sourceFixRound === 2 && initialJournalAmbiguityRefreshPolicy?.correctionMilestone === "Build — Initial Journal Ambiguity Closure" && initialJournalAmbiguityRefreshPolicy?.generalMutableContextException === false, "Initial-journal ambiguity policy authorization mismatch");
  assert(initialJournalAmbiguityRefreshPolicy?.governedAssetFileCount === 125 && initialJournalAmbiguityRefreshPolicy?.governedAssetBytes === 448676678 && initialJournalAmbiguityRefreshPolicy?.governedAssetAggregateSha256 === "db504eb423e6e7eba9995421b708706062b554ed729762c9f75374901fb2f42b", "Initial-journal ambiguity policy asset-set invariant mismatch");
  assert(initialJournalPolicyTransitions.length === 3 && initialJournalPolicyTransitionByPath.size === expectedInitialJournalAmbiguityTransitions.size, "Initial-journal ambiguity policy transition set mismatch");
  for (const [path, expected] of expectedInitialJournalAmbiguityTransitions) {
    const transition = initialJournalPolicyTransitionByPath.get(path);
    assert(transition?.priorSha256 === expected.prior.sha256 && transition?.currentSha256 === expected.current.sha256, `Initial-journal ambiguity policy transition drifted: ${path}`);
  }
  assert(initialJournalPolicySupporting.length === 2 && initialJournalPolicySupportingByPath.size === expectedInitialJournalSupportingTransitions.size, "Initial-journal ambiguity policy supporting transition set mismatch");
  for (const [path, expected] of expectedInitialJournalSupportingTransitions) {
    const transition = initialJournalPolicySupportingByPath.get(path);
    assert(transition?.priorSha256 === expected.prior.sha256 && transition?.currentSha256 === expected.current.sha256, `Initial-journal ambiguity policy supporting transition drifted: ${path}`);
  }
  const initialJournalAssetSet = initialJournalAmbiguityRefresh?.governedAssetSet;
  assert(initialJournalAssetSet?.fileCount === 125 && initialJournalAssetSet?.bytes === 448676678 && initialJournalAssetSet?.aggregateSha256 === "db504eb423e6e7eba9995421b708706062b554ed729762c9f75374901fb2f42b" && initialJournalAssetSet?.missingFilesAtRecordCreation === 0 && initialJournalAssetSet?.driftedFilesAtRecordCreation === 0 && initialJournalAssetSet?.recordCreationRehashPasses === 1 && initialJournalAssetSet?.requiredFinalVerifierPasses === 2, "Initial-journal ambiguity governed asset-set proof mismatch");
  const initialJournalInvariants = initialJournalAmbiguityRefresh?.unchangedInvariants;
  assert(initialJournalInvariants?.assetPathChanges === 0 && initialJournalInvariants?.assetByteChanges === 0 && initialJournalInvariants?.assetTierChanges === 0 && initialJournalInvariants?.runtimeImportChanges === 0 && initialJournalInvariants?.assetDispositionChanges === 0 && initialJournalInvariants?.classificationChanges === 0, "Initial-journal ambiguity refresh must record no asset or classification change");
  assert(initialJournalInvariants?.classificationRecord === classificationPath && initialJournalInvariants?.classificationRecordSha256 === "d1f1a637c1c438626bffb25911bdbcf50c754fc4581659f6cd507cb2a088f906", "Initial-journal ambiguity historical classification invariant drifted");
  assert(initialJournalInvariants?.packageJsonSha256 === "9a8da679e65de153a806328c432ef8040eab8eecae40f778961bd69840f1ecfa" && fileHash("package.json") === initialJournalInvariants.packageJsonSha256, "Initial-journal ambiguity package.json invariant drifted");
  assert(initialJournalInvariants?.packageLockJsonSha256 === "cd14e95daefbd563eb2f58207cb9bbd3edbb40f05cfeafaeece4454a57522b38" && fileHash("package-lock.json") === initialJournalInvariants.packageLockJsonSha256, "Initial-journal ambiguity package-lock.json invariant drifted");
  const originalPostBaselineEntries = postBaselineIntake?.files ?? [];
  const postBaselineDeltaEntries = postBaselineDelta?.files ?? [];
  const postBaselineMasteredEntries = postBaselineMasteredDelta?.files ?? [];
  const postBaselineSourceEntries = [...originalPostBaselineEntries, ...postBaselineDeltaEntries]
    .sort((a, b) => (normalize(a.path) < normalize(b.path) ? -1 : normalize(a.path) > normalize(b.path) ? 1 : 0));
  const postBaselineEntries = [...postBaselineSourceEntries, ...postBaselineMasteredEntries]
    .sort((a, b) => (normalize(a.path) < normalize(b.path) ? -1 : normalize(a.path) > normalize(b.path) ? 1 : 0));
  const originalPostBaselineByPath = new Map(originalPostBaselineEntries.map((entry) => [normalize(entry.path), entry]));
  const postBaselineDeltaByPath = new Map(postBaselineDeltaEntries.map((entry) => [normalize(entry.path), entry]));
  const postBaselineMasteredByPath = new Map(postBaselineMasteredEntries.map((entry) => [normalize(entry.path), entry]));
  const postBaselineSourceByPath = new Map(postBaselineSourceEntries.map((entry) => [normalize(entry.path), entry]));
  const postBaselineByPath = new Map(postBaselineEntries.map((entry) => [normalize(entry.path), entry]));
  const postBaselineRoots = (postBaselineIntake?.scope?.roots ?? []).map(normalize);
  const postBaselineSourcePaths = new Set(postBaselineSourceByPath.keys());
  const postBaselinePaths = new Set(postBaselineByPath.keys());
  const postBaselineAssetPaths = new Set([...postBaselinePaths].filter((path) => path.startsWith("assets/")));
  const postBaselineEvidencePaths = new Set([...postBaselinePaths].filter((path) => path.startsWith("evidence/")));
  const authorizedEvidenceExtensionPaths = new Set(expectedHealthStatusMedicineEvidence.keys());
  const allowedCurrentEvidencePaths = new Set([...postBaselineEvidencePaths, ...authorizedEvidenceExtensionPaths]);
  const expectedCandidateEofTransitions = new Map([
    ["assets/3d/jack/v3/README.md", {
      currentBytes: 1553,
      currentSha256: "deb50c2968e148413b50251b461cd728f15a74d07687032d557ca1e8082298c3",
      currentGitBlobOid: "8eea00ae9318036543d9c9b741caa7ca4005a9b0",
      currentLastWriteTimeUtc: "2026-08-17T16:18:31.0126296Z",
    }],
    ["assets/3d/jack/v3/SOURCE_LEDGER_V3.md", {
      currentBytes: 1545,
      currentSha256: "c655601ef3dd32a81a4e9b30ce03d87d9091dca195a687d13f2705eea5ded7e0",
      currentGitBlobOid: "135168c8a08ce29ea26d7c32a50cc3712abcf130",
      currentLastWriteTimeUtc: "2026-08-17T16:18:32.5634844Z",
    }],
    ["assets/3d/jack/v4/ADULT_LIKENESS_SPEC_V4.md", {
      currentBytes: 3252,
      currentSha256: "555bb30734df9a642b0b574ffc11e2656b7bebb0966d4cf6221a14355165b071",
      currentGitBlobOid: "947c0a454feba15de4453f9efce36b794736ee1f",
      currentLastWriteTimeUtc: "2026-08-17T16:18:34.0834199Z",
    }],
    ["assets/3d/jack/v4/README.md", {
      currentBytes: 2629,
      currentSha256: "801563a3bb518e5fc1cb7c88d99a53dcb740a224ca55ac3d8faa1afaea6703dc",
      currentGitBlobOid: "edb5f3ce0bea18334da2f4b9f19552ecdc550b22",
      currentLastWriteTimeUtc: "2026-08-17T16:18:35.6841431Z",
    }],
    ["assets/3d/jack/v4/SOURCE_LEDGER_V4.md", {
      currentBytes: 1582,
      currentSha256: "c743ccb0bc2c0422177bef82740f94c6c6aa61c85c96f68b34811a0220aa8a6a",
      currentGitBlobOid: "e98d528ee61b5ed916fd857f9ca8e599045b045c",
      currentLastWriteTimeUtc: "2026-08-17T16:18:37.2439775Z",
    }],
    ["assets/3d/jack/v4/tools/analyze_adult_components.py", {
      currentBytes: 2919,
      currentSha256: "ba41ea722a0dcbc0f8867c1c700874951e5e78422eb1f61c9ba051066d4ce2ff",
      currentGitBlobOid: "5ef376cea143122e8d8d67b4d5dc54c5df3cb3a9",
      currentLastWriteTimeUtc: "2026-08-17T16:18:38.7539378Z",
    }],
  ]);
  const candidateEofPolicyTransitions = candidateEofPolicy?.authorizedTransitions ?? [];
  const candidateEofPolicyTransitionByPath = new Map(candidateEofPolicyTransitions.map((entry) => [normalize(entry.path), entry]));
  assert(candidateEofPolicies.length === 1 && Boolean(candidateEofPolicy), "Asset policy must declare exactly one bounded Safe Return candidate EOF normalization");
  assert(candidateEofNormalization?.schemaVersion === 1 && candidateEofNormalization?.kind === "checksum-bound-candidate-eof-normalization", `${candidateEofNormalizationPath} schema/kind mismatch`);
  assert(candidateEofNormalization?.hashAlgorithm === "sha256", `${candidateEofNormalizationPath} must use SHA-256`);
  assert(candidateEofNormalization?.authorization?.milestone === "Build — Safe Return Candidate EOF Normalization" && candidateEofNormalization?.authorization?.generalMutableContextException === false, "Candidate EOF normalization authorization mismatch");
  assert(candidateEofNormalization?.authorization?.runtimeBehaviorChangeAuthorized === false && candidateEofNormalization?.authorization?.creativeStatusChangeAuthorized === false && candidateEofNormalization?.authorization?.assetTierOrDispositionChangeAuthorized === false, "Candidate EOF normalization authority widened");
  assert(candidateEofNormalization?.repositoryState?.head === "9c8a82140d6116b29b0fa7444d9ba64e73e2baf4" && candidateEofNormalization?.repositoryState?.branch === "codex/jack-v05" && candidateEofNormalization?.repositoryState?.stagedPathCountAfterAuthorizedUnstage === 0 && candidateEofNormalization?.repositoryState?.workingByteDriftDuringUnstage === 0 && candidateEofNormalization?.repositoryState?.externalActionPerformed === false, "Candidate EOF normalization repository-state record mismatch");
  assert(candidateEofNormalization?.immutableIdentitySource?.record === postBaselineIntakePath && candidateEofNormalization?.immutableIdentitySource?.recordSha256 === "f474bae293be22fa6ca8fd28011350106943dc2602067ad78ff85b976c06eeb6" && candidateEofNormalization?.immutableIdentitySource?.immutable === true, "Candidate EOF normalization immutable identity source mismatch");
  assert(candidateEofPolicy?.kind === "checksum-bound-candidate-eof-normalization" && candidateEofPolicy?.identitySource === postBaselineIntakePath && candidateEofPolicy?.identitySourceRecordSha256 === "f474bae293be22fa6ca8fd28011350106943dc2602067ad78ff85b976c06eeb6", "Candidate EOF normalization policy identity source mismatch");
  assert(candidateEofPolicy?.milestone === "Build — Safe Return Candidate EOF Normalization" && candidateEofPolicy?.generalMutableContextException === false, "Candidate EOF normalization policy authorization mismatch");
  assert(candidateEofTransitions.length === 6 && candidateEofTransitionByPath.size === expectedCandidateEofTransitions.size, "Candidate EOF normalization must bind exactly six unique transitions");
  assert(candidateEofPolicyTransitions.length === 6 && candidateEofPolicyTransitionByPath.size === expectedCandidateEofTransitions.size, "Candidate EOF policy must bind exactly six unique transitions");

  const expectedCandidateEofHistory = new Map([
    [normalizationPath, { bytes: 11168, sha256: "284966ba2bdd29709245200cebdcd3098476a7a051d5017c812ea2f66c6d1dc2" }],
    [postBaselineIntakePath, { bytes: 38412, sha256: "f474bae293be22fa6ca8fd28011350106943dc2602067ad78ff85b976c06eeb6" }],
    [postBaselineDeltaPath, { bytes: 14229, sha256: "32dada5d7a6a3c075ed29939ca4bab0b8e1db87d773a1265429c2463311c1a23" }],
    [postBaselineMasteredDeltaPath, { bytes: 22053, sha256: "aa45bff433980f26600fe7627a49ad831e1d325556d8abf4f6095b873fc54f67" }],
    [v4ManagedContextRefreshPath, { bytes: 6217, sha256: "03f8dd11fd8f0860bc3a84a3b2d70f7c806b49bf6cbcf1daf11e4c030763f17a" }],
    [initialJournalAmbiguityRefreshPath, { bytes: 7885, sha256: "99717544e31e46774e88b56f9afd018fd734863066aeb79454d36954ab37e409" }],
  ]);
  const candidateEofHistory = candidateEofNormalization?.appendOnlyHistory ?? [];
  const candidateEofHistoryByRecord = new Map(candidateEofHistory.map((entry) => [normalize(entry.record), entry]));
  assert(candidateEofHistory.length === expectedCandidateEofHistory.size && candidateEofHistoryByRecord.size === expectedCandidateEofHistory.size, "Candidate EOF append-only history set mismatch");
  for (const [record, expected] of expectedCandidateEofHistory) {
    const entry = candidateEofHistoryByRecord.get(record);
    assert(entry?.immutable === true && entry?.recordBytes === expected.bytes && entry?.recordSha256 === expected.sha256, `Candidate EOF immutable history entry drifted: ${record}`);
    assert(existsSync(absolute(record)) && statSync(absolute(record)).size === expected.bytes && fileHash(record) === expected.sha256, `Candidate EOF immutable history file drifted: ${record}`);
  }

  for (const [path, expectedCurrent] of expectedCandidateEofTransitions) {
    const transition = candidateEofTransitionByPath.get(path);
    const policyTransition = candidateEofPolicyTransitionByPath.get(path);
    const original = originalPostBaselineByPath.get(path);
    assert(Boolean(transition && policyTransition && original), `Candidate EOF transition chain is incomplete: ${path}`);
    if (!transition || !policyTransition || !original) continue;
    assert(transition.classificationRuleId === original.classificationRuleId, `Candidate EOF classification rule drifted: ${path}`);
    assert(transition.prior?.bytes === original.bytes && transition.prior?.sha256 === original.sha256, `Candidate EOF prior raw identity drifted: ${path}`);
    assert(Math.abs(new Date(transition.prior?.lastWriteTimeUtc).getTime() - new Date(original.lastWriteTimeUtc).getTime()) < 1, `Candidate EOF prior mtime drifted: ${path}`);
    assert(transition.current?.bytes === expectedCurrent.currentBytes && transition.current?.sha256 === expectedCurrent.currentSha256 && transition.current?.pathAttributedGitBlobOid === expectedCurrent.currentGitBlobOid, `Candidate EOF current recorded identity drifted: ${path}`);
    assert(Math.abs(new Date(transition.current?.lastWriteTimeUtc).getTime() - new Date(expectedCurrent.currentLastWriteTimeUtc).getTime()) < 1 && transition.current?.gitState === "untracked", `Candidate EOF current mtime/state drifted: ${path}`);
    assert(policyTransition.priorBytes === original.bytes && policyTransition.priorSha256 === original.sha256 && policyTransition.priorGitBlobOid === transition.prior?.pathAttributedGitBlobOid, `Candidate EOF policy prior identity drifted: ${path}`);
    assert(policyTransition.currentBytes === expectedCurrent.currentBytes && policyTransition.currentSha256 === expectedCurrent.currentSha256 && policyTransition.currentGitBlobOid === expectedCurrent.currentGitBlobOid, `Candidate EOF policy current identity drifted: ${path}`);
    assert(existsSync(absolute(path)), `Candidate EOF current file is missing: ${path}`);
    if (!existsSync(absolute(path))) continue;
    const currentBuffer = readFileSync(absolute(path));
    const reconstructedPrior = Buffer.concat([currentBuffer, Buffer.from([0x0a])]);
    const crCount = [...currentBuffer].filter((byte) => byte === 0x0d).length;
    const lfCount = [...currentBuffer].filter((byte) => byte === 0x0a).length;
    let trailingLfCount = 0;
    for (let index = currentBuffer.length - 1; index >= 0 && currentBuffer[index] === 0x0a; index -= 1) trailingLfCount += 1;
    assert(currentBuffer.length === expectedCurrent.currentBytes && sha256(currentBuffer) === expectedCurrent.currentSha256, `Candidate EOF current raw file drifted: ${path}`);
    assert(pathAttributedGitBlobOid(path, currentBuffer) === expectedCurrent.currentGitBlobOid, `Candidate EOF current path-attributed Git blob drifted: ${path}`);
    assert(reconstructedPrior.length === transition.prior.bytes && sha256(reconstructedPrior) === transition.prior.sha256, `Candidate EOF exact one-byte prior reconstruction failed: ${path}`);
    assert(pathAttributedGitBlobOid(path, reconstructedPrior) === transition.prior.pathAttributedGitBlobOid, `Candidate EOF prior path-attributed Git blob reconstruction failed: ${path}`);
    assert(currentBuffer.equals(Buffer.from(currentBuffer.toString("utf8"), "utf8")) && !(currentBuffer[0] === 0xef && currentBuffer[1] === 0xbb && currentBuffer[2] === 0xbf), `Candidate EOF UTF-8/no-BOM invariant failed: ${path}`);
    assert(crCount === 0 && transition.current?.crByteCount === 0 && transition.current?.lineEndings === "LF-only", `Candidate EOF LF-only invariant failed: ${path}`);
    assert(lfCount === transition.current?.lfByteCount && transition.prior?.lfByteCount === lfCount + 1 && trailingLfCount === 1 && transition.prior?.terminalLfCount === 2 && transition.current?.terminalLfCount === 1, `Candidate EOF newline-count invariant failed: ${path}`);
    assert(transition.reversibleTransformation?.type === "blank-line-at-eof-removed" && transition.reversibleTransformation?.removedBytes === 1 && transition.reversibleTransformation?.removedByteHex === "0a" && transition.reversibleTransformation?.otherByteChanges === 0, `Candidate EOF reversible transformation contract drifted: ${path}`);
    assert(Math.abs(statSync(absolute(path)).mtimeMs - new Date(expectedCurrent.currentLastWriteTimeUtc).getTime()) < 1, `Candidate EOF current filesystem mtime drifted: ${path}`);
    assertCommittedStatusSuccessor("candidate-eof-current", path, "untracked");
  }

  const transitionAggregateBody = [...candidateEofTransitionByPath.values()]
    .sort((a, b) => (normalize(a.path) < normalize(b.path) ? -1 : normalize(a.path) > normalize(b.path) ? 1 : 0))
    .map((entry) => `${normalize(entry.path)}\t${entry.prior.bytes}\t${entry.prior.sha256}\t${entry.current.bytes}\t${entry.current.sha256}\n`)
    .join("");
  assert(Buffer.byteLength(transitionAggregateBody, "utf8") === 1068 && candidateEofNormalization?.transitionAggregateBytes === 1068, "Candidate EOF transition aggregate byte count drifted");
  assert(sha256(Buffer.from(transitionAggregateBody, "utf8")) === "a6134cc01fa9d8a3c768f78c515d384cc62bb648dfedbdf28290c883ccf15a51" && candidateEofNormalization?.transitionAggregateSha256 === "a6134cc01fa9d8a3c768f78c515d384cc62bb648dfedbdf28290c883ccf15a51", "Candidate EOF transition aggregate hash drifted");
  assert(candidateEofNormalization?.transitionSummary?.fileCount === 6 && candidateEofNormalization?.transitionSummary?.priorBytes === 13486 && candidateEofNormalization?.transitionSummary?.currentBytes === 13480 && candidateEofNormalization?.transitionSummary?.netBytes === -6 && candidateEofNormalization?.transitionSummary?.removedBytesPerFile === 1 && candidateEofNormalization?.transitionSummary?.otherByteChanges === 0, "Candidate EOF transition summary drifted");
  assert(candidateEofPolicy?.fileCount === 6 && candidateEofPolicy?.priorBytes === 13486 && candidateEofPolicy?.currentBytes === 13480 && candidateEofPolicy?.netBytes === -6 && candidateEofPolicy?.transitionAggregateSha256 === "a6134cc01fa9d8a3c768f78c515d384cc62bb648dfedbdf28290c883ccf15a51", "Candidate EOF policy summary drifted");

  const withCandidateEofSuccessors = (entries) => entries.map((entry) => {
    const successor = candidateEofTransitionByPath.get(normalize(entry.path));
    return successor ? { path: normalize(entry.path), bytes: successor.current.bytes, sha256: successor.current.sha256 } : { path: normalize(entry.path), bytes: entry.bytes, sha256: entry.sha256 };
  });
  const currentOriginalPostBaselineEntries = withCandidateEofSuccessors(originalPostBaselineEntries);
  const currentPostBaselineSourceEntries = withCandidateEofSuccessors(postBaselineSourceEntries);
  const currentPostBaselineEntries = withCandidateEofSuccessors(postBaselineEntries);
  const expectedCurrentGovernedSets = [
    ["original75Current", "original75", currentOriginalPostBaselineEntries, 75, 418860104, "1520051aaf04994ebfadb24022cdcb550a362a2fac7127f9c6e35bf1381d54fb"],
    ["source95Current", "source95", currentPostBaselineSourceEntries, 95, 426541664, "b1eefc1819b746995e951e651b4629972eb9c34123b8d914006a298b825ffc31"],
    ["combined125Current", "combined125", currentPostBaselineEntries, 125, 448676672, "531942b4f52e51762d142c04dc79dc280456c09e50d8f699da463baf402a7b4f"],
  ];
  for (const [recordKey, policyKey, entries, fileCount, bytes, aggregateSha256] of expectedCurrentGovernedSets) {
    const recorded = candidateEofNormalization?.governedSuccessorSets?.[recordKey];
    const declared = candidateEofPolicy?.currentGovernedSets?.[policyKey];
    const actualBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
    const actualAggregate = aggregate(entries);
    assert(entries.length === fileCount && actualBytes === bytes && actualAggregate === aggregateSha256, `Candidate EOF current governed set drifted: ${policyKey}`);
    assert(recorded?.fileCount === fileCount && recorded?.bytes === bytes && recorded?.aggregateSha256 === aggregateSha256, `Candidate EOF record governed set drifted: ${recordKey}`);
    assert(declared?.fileCount === fileCount && declared?.bytes === bytes && declared?.aggregateSha256 === aggregateSha256, `Candidate EOF policy governed set drifted: ${policyKey}`);
  }
  const candidateEofClassificationEffect = candidateEofNormalization?.classificationEffect;
  assert(candidateEofClassificationEffect?.record === classificationPath && candidateEofClassificationEffect?.priorRecordSha256 === "d1f1a637c1c438626bffb25911bdbcf50c754fc4581659f6cd507cb2a088f906", "Candidate EOF classification predecessor drifted");
  assert(candidateEofClassificationEffect?.currentRecordBytes === 138055 && candidateEofClassificationEffect?.currentRecordSha256 === "6ffeda49065df33d9120aea0a452c2f710cec2829b045bf341faab4ec08f60fb", "Candidate EOF historical classification identity drifted");
  assert(candidateEofClassificationEffect?.changedPaths === 6 && candidateEofClassificationEffect?.pathChanges === 0 && candidateEofClassificationEffect?.fileCountChanges === 0 && candidateEofClassificationEffect?.tierChanges === 0 && candidateEofClassificationEffect?.dispositionChanges === 0 && candidateEofClassificationEffect?.runtimeImportChanges === 0 && candidateEofClassificationEffect?.expectedV3GroupByteDelta === -2 && candidateEofClassificationEffect?.expectedV4GroupByteDelta === -4, "Candidate EOF classification scope widened");
  const candidateEofScene = candidateEofNormalization?.excludedSceneInvariant;
  assert(candidateEofScene?.path === "src/pet-room-scene.web.tsx" && candidateEofScene?.bytes === 12121 && candidateEofScene?.sha256 === "8d26ac3d5d65dc0c4ed943ed1d55435350b9d56e5bacbb6df7de6465fe8dd7df" && candidateEofScene?.pathAttributedGitBlobOid === "9b59e2cda25df99a34362fea7f45744ffe160f09" && candidateEofScene?.excluded === true && candidateEofScene?.staged === false && candidateEofScene?.editedByThisMilestone === false, "Candidate EOF excluded scene record drifted");
  assert(candidateEofScene?.bytes === sceneTransition?.prior?.bytes && candidateEofScene?.sha256 === sceneTransition?.prior?.sha256 && candidateEofScene?.pathAttributedGitBlobOid === sceneTransition?.prior?.gitNormalizedBlobOid, "Candidate EOF excluded scene successor chain drifted");
  assert(postBaselineIntake?.schemaVersion === 1, `${postBaselineIntakePath} must use schemaVersion 1`);
  assert(postBaselineIntake?.kind === "post-baseline-asset-intake", `${postBaselineIntakePath} kind mismatch`);
  assert(postBaselineIntake?.hashAlgorithm === "sha256", `${postBaselineIntakePath} must use SHA-256`);
  assert(postBaselineIntake?.baselineCommit === "9c8a82140d6116b29b0fa7444d9ba64e73e2baf4", `${postBaselineIntakePath} baseline commit mismatch`);
  assert(Boolean(postBaselinePolicy), `Asset policy must declare ${postBaselineIntakePath}`);
  assert(originalPostBaselineEntries.length === originalPostBaselineByPath.size, `${postBaselineIntakePath} contains duplicate paths`);
  assert(postBaselineIntake?.scope?.fileCount === originalPostBaselineEntries.length, `${postBaselineIntakePath} file count mismatch`);
  assert(postBaselineIntake?.scope?.bytes === originalPostBaselineEntries.reduce((sum, entry) => sum + entry.bytes, 0), `${postBaselineIntakePath} byte total mismatch`);
  assert(postBaselineIntake?.scope?.aggregateSha256 === aggregate(originalPostBaselineEntries), `${postBaselineIntakePath} aggregate hash mismatch`);
  assert(postBaselinePolicy?.fileCount === postBaselineIntake?.scope?.fileCount, "Post-baseline policy/intake file count mismatch");
  assert(postBaselinePolicy?.bytes === postBaselineIntake?.scope?.bytes, "Post-baseline policy/intake byte total mismatch");
  assert(postBaselinePolicy?.aggregateSha256 === postBaselineIntake?.scope?.aggregateSha256, "Post-baseline policy/intake aggregate hash mismatch");
  assert(JSON.stringify(postBaselinePolicy?.roots ?? []) === JSON.stringify(postBaselineRoots), "Post-baseline policy/intake root mismatch");
  for (const entry of originalPostBaselineEntries) {
    const path = normalize(entry.path);
    const eofSuccessor = candidateEofTransitionByPath.get(path);
    assert(postBaselineRoots.some((rootPath) => path.startsWith(`${rootPath}/`)), `Post-baseline path is outside approved roots: ${path}`);
    assert(existsSync(absolute(path)), `Post-baseline file is missing: ${path}`);
    if (existsSync(absolute(path))) {
      const expectedBytes = eofSuccessor?.current?.bytes ?? entry.bytes;
      const expectedSha256 = eofSuccessor?.current?.sha256 ?? entry.sha256;
      assert(statSync(absolute(path)).size === expectedBytes && fileHash(path) === expectedSha256, `Post-baseline current file identity drifted: ${path}`);
    }
    const rule = classify(path, policy);
    assert(rule?.id === entry.classificationRuleId, `Post-baseline classification drifted: ${path}`);
  }

  assert(postBaselineDelta?.schemaVersion === 1, `${postBaselineDeltaPath} must use schemaVersion 1`);
  assert(postBaselineDelta?.kind === "post-baseline-asset-intake-delta", `${postBaselineDeltaPath} kind mismatch`);
  assert(postBaselineDelta?.hashAlgorithm === "sha256", `${postBaselineDeltaPath} must use SHA-256`);
  assert(postBaselineDelta?.baselineCommit === postBaselineIntake?.baselineCommit, `${postBaselineDeltaPath} baseline commit mismatch`);
  assert(Boolean(postBaselineDeltaPolicy), `Asset policy must declare ${postBaselineDeltaPath}`);
  assert(postBaselineDelta?.predecessor?.record === postBaselineIntakePath && postBaselineDelta?.predecessor?.immutable === true, "Post-baseline delta must preserve the immutable 75-file predecessor");
  assert(postBaselineDelta?.predecessor?.recordSha256 === fileHash(postBaselineIntakePath), "Post-baseline predecessor record identity drifted");
  assert(postBaselineDelta?.predecessor?.fileCount === postBaselineIntake?.scope?.fileCount && postBaselineDelta?.predecessor?.bytes === postBaselineIntake?.scope?.bytes && postBaselineDelta?.predecessor?.aggregateSha256 === postBaselineIntake?.scope?.aggregateSha256, "Post-baseline predecessor scope mismatch");
  assert(postBaselineDelta?.predecessor?.rehashPasses === 2 && postBaselineDelta?.predecessor?.missingFiles === 0 && postBaselineDelta?.predecessor?.driftedFiles === 0, "Post-baseline predecessor rehash proof is incomplete");
  assert(postBaselineDeltaEntries.length === postBaselineDeltaByPath.size && postBaselineSourceByPath.size === postBaselineSourceEntries.length, `${postBaselineDeltaPath} contains duplicate or predecessor-overlapping paths`);
  assert(postBaselineDelta?.scope?.additionFileCount === postBaselineDeltaEntries.length, `${postBaselineDeltaPath} file count mismatch`);
  assert(postBaselineDelta?.scope?.additionBytes === postBaselineDeltaEntries.reduce((sum, entry) => sum + entry.bytes, 0), `${postBaselineDeltaPath} byte total mismatch`);
  assert(postBaselineDelta?.scope?.additionAggregateSha256 === aggregate(postBaselineDeltaEntries), `${postBaselineDeltaPath} aggregate hash mismatch`);
  assert(postBaselineDelta?.scope?.rehashPasses === 2 && postBaselineDelta?.scope?.manifestIdentityMismatches === 0, "Post-baseline delta stability/manifest proof is incomplete");
  assert(postBaselineDeltaPolicy?.kind === "checksum-bound-addition" && postBaselineDeltaPolicy?.predecessor === postBaselineIntakePath, "Post-baseline delta policy contract mismatch");
  assert(postBaselineDeltaPolicy?.fileCount === postBaselineDelta?.scope?.additionFileCount && postBaselineDeltaPolicy?.bytes === postBaselineDelta?.scope?.additionBytes && postBaselineDeltaPolicy?.aggregateSha256 === postBaselineDelta?.scope?.additionAggregateSha256, "Post-baseline delta policy identity mismatch");
  assert(JSON.stringify(postBaselineDeltaPolicy?.roots ?? []) === JSON.stringify([normalize(postBaselineDelta?.scope?.root ?? "")]), "Post-baseline delta policy root mismatch");
  assert(postBaselineDeltaPolicy?.resultingFileCount === postBaselineDelta?.resultingGovernedRoots?.fileCount && postBaselineDeltaPolicy?.resultingBytes === postBaselineDelta?.resultingGovernedRoots?.bytes && postBaselineDeltaPolicy?.resultingAggregateSha256 === postBaselineDelta?.resultingGovernedRoots?.aggregateSha256, "Post-baseline delta resulting-scope policy mismatch");
  assert(JSON.stringify((postBaselineDelta?.resultingGovernedRoots?.roots ?? []).map(normalize)) === JSON.stringify(postBaselineRoots), "Post-baseline delta resulting roots mismatch");
  assert(postBaselineDelta?.resultingGovernedRoots?.unexpectedFiles === 0 && postBaselineDelta?.resultingGovernedRoots?.missingFiles === 0, "Post-baseline delta root-set proof is incomplete");
  assert(postBaselineDelta?.classification?.id === "postbaseline-audio-source-preservation-pending" && postBaselineDelta?.classification?.tier === "cold-archive-pending" && postBaselineDelta?.classification?.status === "excluded-until-preserved", "Post-baseline delta classification must remain preservation-pending");
  assert(postBaselineDelta?.classification?.fileCount === postBaselineDeltaEntries.length && postBaselineDelta?.classification?.bytes === postBaselineDeltaEntries.reduce((sum, entry) => sum + entry.bytes, 0), "Post-baseline delta classification summary mismatch");
  assert(postBaselineDelta?.preservation?.checksumIsBackup === false && postBaselineDelta?.preservation?.backupVerified === false && postBaselineDelta?.preservation?.archiveUploaded === false && postBaselineDelta?.preservation?.lfsConfiguredOrUploaded === false, "Post-baseline delta must not claim external preservation");
  assert(postBaselineDelta?.preservation?.originalsDeleted === false && postBaselineDelta?.preservation?.originalsMoved === false && postBaselineDelta?.preservation?.originalsRenamed === false && postBaselineDelta?.preservation?.originalsRewritten === false, "Post-baseline delta originals must remain untouched");
  for (const entry of postBaselineDeltaEntries) {
    const path = normalize(entry.path);
    assert(path.startsWith(`${normalize(postBaselineDelta.scope.root)}/`), `Post-baseline delta path is outside its exact root: ${path}`);
    assert(!originalPostBaselineByPath.has(path), `Post-baseline delta path already exists in the immutable predecessor: ${path}`);
    assert(existsSync(absolute(path)), `Post-baseline delta file is missing: ${path}`);
    if (existsSync(absolute(path))) assert(statSync(absolute(path)).size === entry.bytes && fileHash(path) === entry.sha256, `Post-baseline delta file identity drifted: ${path}`);
    assert(classify(path, policy)?.id === entry.classificationRuleId && entry.classificationRuleId === postBaselineDelta.classification.id, `Post-baseline delta classification drifted: ${path}`);
  }

  assert(postBaselineMasteredDelta?.schemaVersion === 1, `${postBaselineMasteredDeltaPath} must use schemaVersion 1`);
  assert(postBaselineMasteredDelta?.kind === "post-baseline-asset-intake-delta", `${postBaselineMasteredDeltaPath} kind mismatch`);
  assert(postBaselineMasteredDelta?.hashAlgorithm === "sha256", `${postBaselineMasteredDeltaPath} must use SHA-256`);
  assert(postBaselineMasteredDelta?.baselineCommit === postBaselineIntake?.baselineCommit, `${postBaselineMasteredDeltaPath} baseline commit mismatch`);
  assert(Boolean(postBaselineMasteredDeltaPolicy), `Asset policy must declare ${postBaselineMasteredDeltaPath}`);
  assert(postBaselineMasteredDelta?.predecessor?.record === postBaselineDeltaPath && postBaselineMasteredDelta?.predecessor?.immutable === true, "Mastered/runtime delta must preserve the immutable 95-file predecessor");
  assert(fileHash(postBaselineIntakePath) === "f474bae293be22fa6ca8fd28011350106943dc2602067ad78ff85b976c06eeb6", "Immutable original 75-file intake record drifted");
  assert(fileHash(postBaselineDeltaPath) === "32dada5d7a6a3c075ed29939ca4bab0b8e1db87d773a1265429c2463311c1a23", "Immutable 75-to-95 intake delta record drifted");
  assert(postBaselineMasteredDelta?.predecessor?.recordSha256 === fileHash(postBaselineDeltaPath), "Mastered/runtime predecessor record identity drifted");
  assert(postBaselineMasteredDelta?.predecessor?.fileCount === postBaselineDelta?.resultingGovernedRoots?.fileCount && postBaselineMasteredDelta?.predecessor?.bytes === postBaselineDelta?.resultingGovernedRoots?.bytes && postBaselineMasteredDelta?.predecessor?.aggregateSha256 === postBaselineDelta?.resultingGovernedRoots?.aggregateSha256, "Mastered/runtime predecessor scope mismatch");
  assert(postBaselineMasteredDelta?.predecessor?.rehashPasses === 2 && postBaselineMasteredDelta?.predecessor?.missingFiles === 0 && postBaselineMasteredDelta?.predecessor?.driftedFiles === 0, "Mastered/runtime predecessor rehash proof is incomplete");
  assert(postBaselineMasteredDelta?.appendOnlyHistory?.original75?.record === postBaselineIntakePath && postBaselineMasteredDelta?.appendOnlyHistory?.original75?.recordSha256 === fileHash(postBaselineIntakePath) && postBaselineMasteredDelta?.appendOnlyHistory?.original75?.immutable === true, "Mastered/runtime delta original-75 history chain drifted");
  assert(postBaselineMasteredDelta?.appendOnlyHistory?.sourceAddition20?.record === postBaselineDeltaPath && postBaselineMasteredDelta?.appendOnlyHistory?.sourceAddition20?.recordSha256 === fileHash(postBaselineDeltaPath) && postBaselineMasteredDelta?.appendOnlyHistory?.sourceAddition20?.immutable === true, "Mastered/runtime delta source-20 history chain drifted");
  assert(postBaselineMasteredDelta?.appendOnlyHistory?.original75?.fileCount === 75 && postBaselineMasteredDelta?.appendOnlyHistory?.original75?.bytes === 418860110 && postBaselineMasteredDelta?.appendOnlyHistory?.original75?.aggregateSha256 === "b0e16debbb690987ad84c168a3b84f8986f98263d44b4ff6c1502e872e9152a4", "Mastered/runtime delta original-75 summary drifted");
  assert(postBaselineMasteredDelta?.appendOnlyHistory?.sourceAddition20?.fileCount === 20 && postBaselineMasteredDelta?.appendOnlyHistory?.sourceAddition20?.bytes === 7681560 && postBaselineMasteredDelta?.appendOnlyHistory?.sourceAddition20?.aggregateSha256 === "0691600367d637c1da18aee7bdcd17f4ebf79ce10b5a15674cf3d1af14a1180b", "Mastered/runtime delta source-20 summary drifted");
  assert(postBaselineMasteredEntries.length === postBaselineMasteredByPath.size && postBaselineByPath.size === postBaselineEntries.length, `${postBaselineMasteredDeltaPath} contains duplicate or predecessor-overlapping paths`);
  assert(postBaselineMasteredDelta?.scope?.additionFileCount === postBaselineMasteredEntries.length && postBaselineMasteredEntries.length === 30, `${postBaselineMasteredDeltaPath} file count mismatch`);
  assert(postBaselineMasteredDelta?.scope?.additionBytes === postBaselineMasteredEntries.reduce((sum, entry) => sum + entry.bytes, 0) && postBaselineMasteredDelta?.scope?.additionBytes === 22135008, `${postBaselineMasteredDeltaPath} byte total mismatch`);
  assert(postBaselineMasteredDelta?.scope?.additionAggregateSha256 === aggregate(postBaselineMasteredEntries) && postBaselineMasteredDelta?.scope?.additionAggregateSha256 === "de71338c2fb05e78a16eb0c7adb727c00f48756a06ba77201f3031215f9ca49f", `${postBaselineMasteredDeltaPath} aggregate hash mismatch`);
  assert(postBaselineMasteredDelta?.scope?.rehashPasses === 2 && postBaselineMasteredDelta?.scope?.manifestMasterCount === 30 && postBaselineMasteredDelta?.scope?.manifestIdentityMismatches === 0 && postBaselineMasteredDelta?.scope?.unexpectedNewAudioFiles === 0 && postBaselineMasteredDelta?.scope?.missingMasterFiles === 0, "Mastered/runtime delta stability and exact-set proof is incomplete");
  assert(postBaselineMasteredDelta?.resultingGovernedSet?.fileCount === postBaselineEntries.length && postBaselineEntries.length === 125, "Mastered/runtime resulting file count mismatch");
  assert(postBaselineMasteredDelta?.resultingGovernedSet?.bytes === postBaselineEntries.reduce((sum, entry) => sum + entry.bytes, 0) && postBaselineMasteredDelta?.resultingGovernedSet?.bytes === 448676678, "Mastered/runtime resulting byte total mismatch");
  assert(postBaselineMasteredDelta?.resultingGovernedSet?.aggregateSha256 === aggregate(postBaselineEntries) && postBaselineMasteredDelta?.resultingGovernedSet?.aggregateSha256 === "db504eb423e6e7eba9995421b708706062b554ed729762c9f75374901fb2f42b", "Mastered/runtime resulting aggregate mismatch");
  assert(postBaselineMasteredDelta?.resultingGovernedSet?.unexpectedFiles === 0 && postBaselineMasteredDelta?.resultingGovernedSet?.missingFiles === 0, "Mastered/runtime resulting exact-set proof is incomplete");
  assert(postBaselineMasteredDeltaPolicy?.kind === "checksum-bound-addition" && postBaselineMasteredDeltaPolicy?.predecessor === postBaselineDeltaPath && postBaselineMasteredDeltaPolicy?.selection === "exact-current-audio-manifest-masterCandidate-files", "Mastered/runtime delta policy contract mismatch");
  assert(postBaselineMasteredDeltaPolicy?.fileCount === 30 && postBaselineMasteredDeltaPolicy?.bytes === 22135008 && postBaselineMasteredDeltaPolicy?.aggregateSha256 === "de71338c2fb05e78a16eb0c7adb727c00f48756a06ba77201f3031215f9ca49f", "Mastered/runtime delta policy identity mismatch");
  assert(postBaselineMasteredDeltaPolicy?.resultingFileCount === 125 && postBaselineMasteredDeltaPolicy?.resultingBytes === 448676678 && postBaselineMasteredDeltaPolicy?.resultingAggregateSha256 === "db504eb423e6e7eba9995421b708706062b554ed729762c9f75374901fb2f42b", "Mastered/runtime delta policy resulting-set mismatch");
  assert(postBaselineMasteredDeltaPolicy?.runtimeImportedFileCount === 21 && postBaselineMasteredDeltaPolicy?.unwiredCandidateFileCount === 9, "Mastered/runtime delta policy split mismatch");

  const masteredClassifications = new Map((postBaselineMasteredDelta?.classifications ?? []).map((entry) => [entry.id, entry]));
  const runtimeMasteredEntries = postBaselineMasteredEntries.filter((entry) => entry.classificationRuleId === "postbaseline-audio-runtime-normal-git");
  const unwiredMasteredEntries = postBaselineMasteredEntries.filter((entry) => entry.classificationRuleId === "postbaseline-audio-master-preservation-pending");
  const runtimeMasteredSummary = masteredClassifications.get("postbaseline-audio-runtime-normal-git");
  const unwiredMasteredSummary = masteredClassifications.get("postbaseline-audio-master-preservation-pending");
  assert(masteredClassifications.size === 2, "Mastered/runtime delta must contain exactly two classification summaries");
  assert(runtimeMasteredEntries.length === 21 && runtimeMasteredSummary?.tier === "normal-git" && runtimeMasteredSummary?.status === "existing-runtime-routing-only-awaiting-Mark-audible-review", "Mastered/runtime normal-Git split mismatch");
  assert(runtimeMasteredSummary?.fileCount === 21 && runtimeMasteredSummary?.bytes === 19077012 && runtimeMasteredSummary?.aggregateSha256 === aggregate(runtimeMasteredEntries) && runtimeMasteredSummary?.aggregateSha256 === "f9c24038361d8efa9841dc5017f8b694e4e6a20c7c01224b596b499240fa63c1", "Mastered/runtime normal-Git identity mismatch");
  assert(unwiredMasteredEntries.length === 9 && unwiredMasteredSummary?.tier === "cold-archive-pending" && unwiredMasteredSummary?.status === "unapproved-preservation-pending", "Mastered/unwired candidate split mismatch");
  assert(unwiredMasteredSummary?.fileCount === 9 && unwiredMasteredSummary?.bytes === 3057996 && unwiredMasteredSummary?.aggregateSha256 === aggregate(unwiredMasteredEntries) && unwiredMasteredSummary?.aggregateSha256 === "ad3e5d2ab87f0c66f018ed51e6b4f8cfe64bb3353ae41849a1e31e255c48185c", "Mastered/unwired candidate identity mismatch");
  assert(postBaselineMasteredDelta?.preservation?.checksumIsBackup === false && postBaselineMasteredDelta?.preservation?.backupVerified === false && postBaselineMasteredDelta?.preservation?.archiveUploaded === false && postBaselineMasteredDelta?.preservation?.lfsConfiguredOrUploaded === false, "Mastered/runtime delta must not claim external preservation");
  assert(postBaselineMasteredDelta?.preservation?.originalsDeleted === false && postBaselineMasteredDelta?.preservation?.originalsMoved === false && postBaselineMasteredDelta?.preservation?.originalsRenamed === false && postBaselineMasteredDelta?.preservation?.originalsRewritten === false, "Mastered/runtime originals must remain untouched");

  const audioManifestPath = "assets/audio/v1/audio-manifest.v1.json";
  const audioManifestForMasteredDelta = JSON.parse(readFileSync(absolute(audioManifestPath), "utf8"));
  const manifestMasterByPath = new Map((audioManifestForMasteredDelta.assets ?? []).map((asset) => [normalize(posix.join("assets/audio/v1", asset.masterCandidate?.file ?? "")), asset]));
  assert(audioManifestForMasteredDelta.releaseStatus === "planned", "Audio manifest release status must remain planned");
  assert(manifestMasterByPath.size === 30, "Audio manifest must contain exactly 30 unique master candidates");
  const appMasteredReferences = runtimeAssetReferences().filter((reference) => reference.source === "App.tsx" && postBaselineMasteredByPath.has(reference.resolved));
  const appMasteredPaths = new Set(appMasteredReferences.map((reference) => reference.resolved));
  assert(appMasteredReferences.length === 21 && appMasteredPaths.size === 21, "Frozen App must import exactly 21 unique mastered/runtime WAVs");
  const capturedAssetPaths = new Set((inventory.scopes?.assets?.files ?? []).map((entry) => normalize(entry.path)));
  const currentNewAudioWavs = walk("assets/audio/v1").filter((path) => path.endsWith(".wav") && !capturedAssetPaths.has(path) && !postBaselineSourceByPath.has(path));
  assert(currentNewAudioWavs.length === 30 && currentNewAudioWavs.every((path) => postBaselineMasteredByPath.has(path)), "Unexpected post-inventory Audio V1 WAV addition outside the exact mastered/runtime delta");
  for (const path of postBaselineMasteredByPath.keys()) assert(currentNewAudioWavs.includes(path), `Missing mastered/runtime WAV from current exact set: ${path}`);
  for (const entry of postBaselineMasteredEntries) {
    const path = normalize(entry.path);
    assert(!postBaselineSourceByPath.has(path), `Mastered/runtime delta path overlaps the immutable 95-file predecessor: ${path}`);
    assert(existsSync(absolute(path)), `Mastered/runtime delta file is missing: ${path}`);
    if (existsSync(absolute(path))) {
      assert(statSync(absolute(path)).size === entry.bytes && fileHash(path) === entry.sha256, `Mastered/runtime delta file identity drifted: ${path}`);
      assert(Math.abs(statSync(absolute(path)).mtimeMs - new Date(entry.lastWriteTimeUtc).getTime()) < 1, `Mastered/runtime delta file mtime drifted: ${path}`);
    }
    const manifestAsset = manifestMasterByPath.get(path);
    assert(Boolean(manifestAsset) && manifestAsset?.id === entry.assetId, `Audio manifest master mapping mismatch: ${path}`);
    assert(manifestAsset?.masterCandidate?.reviewStatus === "awaiting-Mark-audible-review" && entry.manifestReviewStatus === "awaiting-Mark-audible-review", `Audio master review status drifted: ${path}`);
    const masteredRule = classify(path, policy);
    assert(masteredRule?.id === entry.classificationRuleId, `Mastered/runtime classification drifted: ${path}`);
    assert(entry.appImported === appMasteredPaths.has(path), `Mastered/runtime App-import flag drifted: ${path}`);
    if (entry.appImported) assert(entry.classificationRuleId === "postbaseline-audio-runtime-normal-git" && masteredRule?.tier === "normal-git", `App-imported master is not routed to normal Git: ${path}`);
    else assert(entry.classificationRuleId === "postbaseline-audio-master-preservation-pending" && masteredRule?.tier === "cold-archive-pending", `Unwired master is not preservation-pending: ${path}`);
  }

  const deltaRuntimePolicyEntries = (policy.runtimeImports ?? []).filter((entry) => postBaselineMasteredByPath.has(normalize(entry.path)));
  const deltaRuntimePolicyByPath = new Map(deltaRuntimePolicyEntries.map((entry) => [normalize(entry.path), entry]));
  assert(deltaRuntimePolicyEntries.length === 21 && deltaRuntimePolicyByPath.size === 21, "Asset policy must declare exactly the 21 existing mastered/runtime App imports");
  for (const entry of runtimeMasteredEntries) {
    const declared = deltaRuntimePolicyByPath.get(normalize(entry.path));
    assert(Boolean(declared), `Missing mastered/runtime policy declaration: ${entry.path}`);
    assert(declared?.maxBytes === entry.bytes && declared?.sha256 === entry.sha256 && declared?.reviewStatus === "awaiting-Mark-audible-review", `Mastered/runtime policy identity or review status drifted: ${entry.path}`);
  }
  for (const entry of unwiredMasteredEntries) assert(!deltaRuntimePolicyByPath.has(normalize(entry.path)), `Unwired candidate must not be declared as a runtime import: ${entry.path}`);

  const expectedMasteredContextStates = new Map([
    ["App.tsx", "tracked-modified"],
    ["assets/audio/v1/audio-manifest.v1.json", "tracked-modified"],
    ["docs/audio/AUDIO_LICENSE_LEDGER.v1.md", "tracked-modified"],
    ["src/audio-cue-policy.test.ts", "tracked-modified"],
    ["scripts/verify-audio-v1.mjs", "untracked"],
    ["scripts/verify-export.mjs", "tracked-modified"],
    ["scripts/master-audio-v1.mjs", "untracked"],
    ["scripts/master-audio-music-v1.mjs", "untracked"],
    ["scripts/record-audio-source-evidence-v1.mjs", "untracked"],
  ]);
  const masteredContext = postBaselineMasteredDelta?.managedContext ?? [];
  const masteredContextByPath = new Map(masteredContext.map((entry) => [normalize(entry.path), entry]));
  assert(masteredContext.length === 9 && masteredContextByPath.size === expectedMasteredContextStates.size, "Mastered/runtime delta must bind exactly nine managed-context files");
  for (const [path, expectedState] of expectedMasteredContextStates) {
    const entry = masteredContextByPath.get(path);
    assert(Boolean(entry), `Mastered/runtime managed context is missing: ${path}`);
    assert(entry?.gitState === expectedState && entry?.editedByThisMilestone === false, `Mastered/runtime managed context state mismatch: ${path}`);
    assertCommittedStatusSuccessor("mastered-runtime-context", path, expectedState);
    assert(existsSync(absolute(path)), `Mastered/runtime managed context file is missing: ${path}`);
    const authorizedTransition = v4ManagedContextTransitionByPath.get(path);
    if (authorizedTransition) {
      assert(path === "App.tsx", `Unexpected V4 transition inside mastered/runtime managed context: ${path}`);
      assert(entry?.bytes === authorizedTransition.prior.bytes && entry?.sha256 === authorizedTransition.prior.sha256 && entry?.lastWriteTimeUtc === authorizedTransition.prior.lastWriteTimeUtc, `Mastered/runtime immutable prior context drifted: ${path}`);
      const successor = initialJournalAmbiguityTransitionByPath.get(path);
      assert(Boolean(successor) && successor?.prior?.bytes === authorizedTransition.current.bytes && successor?.prior?.sha256 === authorizedTransition.current.sha256 && successor?.prior?.lastWriteTimeUtc === authorizedTransition.current.lastWriteTimeUtc, `Mastered/runtime authorized successor chain drifted: ${path}`);
      const currentSuccessor = healthStatusMedicineTransitionByPath.get(path);
      assert(currentSuccessor?.prior?.bytes === successor?.current?.bytes && currentSuccessor?.prior?.sha256 === successor?.current?.sha256, `Mastered/runtime V7 successor chain drifted: ${path}`);
    } else if (existsSync(absolute(path))) {
      assert(statSync(absolute(path)).size === entry?.bytes && fileHash(path) === entry?.sha256, `Mastered/runtime managed context identity drifted: ${path}`);
      assert(Math.abs(statSync(absolute(path)).mtimeMs - new Date(entry?.lastWriteTimeUtc).getTime()) < 1, `Mastered/runtime managed context mtime drifted: ${path}`);
    }
  }
  const frozenV4Expected = new Map([
    ["App.tsx", "8db9fb4de855a4bf632df0c599a4075badcd9ab480ac1831815821a39a49994f"],
    ["src/persistence.ts", "5d448dad68e5fecda993bff898df6af03bcee05e246d3ff8b067648de8aee8d2"],
    ["src/persistence.test.ts", "fe62003127c9173a6224fb178f11da56cdde3cd46c62b7343e75ce51cc4e2e86"],
  ]);
  const frozenV4 = postBaselineMasteredDelta?.frozenV4 ?? [];
  const frozenV4ByPath = new Map(frozenV4.map((entry) => [normalize(entry.path), entry]));
  assert(frozenV4.length === 3 && frozenV4ByPath.size === frozenV4Expected.size, "Mastered/runtime delta frozen V4 set mismatch");
  for (const [path, expectedSha256] of frozenV4Expected) {
    const entry = frozenV4ByPath.get(path);
    assert(Boolean(entry) && entry?.sha256 === expectedSha256, `Frozen V4 record identity mismatch: ${path}`);
    const authorizedTransition = v4ManagedContextTransitionByPath.get(path);
    assert(Boolean(authorizedTransition) && authorizedTransition?.prior?.bytes === entry?.bytes && authorizedTransition?.prior?.sha256 === expectedSha256, `Frozen V4 authorized history chain drifted: ${path}`);
    const successor = initialJournalAmbiguityTransitionByPath.get(path);
    assert(Boolean(successor) && successor?.prior?.bytes === authorizedTransition?.current?.bytes && successor?.prior?.sha256 === authorizedTransition?.current?.sha256 && successor?.prior?.lastWriteTimeUtc === authorizedTransition?.current?.lastWriteTimeUtc, `Frozen V4 authorized successor chain drifted: ${path}`);
    const currentSuccessor = healthStatusMedicineTransitionByPath.get(path);
    assert(currentSuccessor?.prior?.bytes === successor?.current?.bytes && currentSuccessor?.prior?.sha256 === successor?.current?.sha256, `Frozen V4 V7 successor chain drifted: ${path}`);
  }

  const currentPostBaseline = recordFiles(postBaselineRoots.flatMap((rootPath) => walk(rootPath)));
  assert(currentPostBaseline.length === currentPostBaselineSourceEntries.length, `Unexpected post-baseline source/research file count: expected ${currentPostBaselineSourceEntries.length}, found ${currentPostBaseline.length}`);
  assert(currentPostBaseline.reduce((sum, entry) => sum + entry.bytes, 0) === 426541664, "Post-baseline current byte total drifted after exact EOF normalization");
  assert(aggregate(currentPostBaseline) === "b1eefc1819b746995e951e651b4629972eb9c34123b8d914006a298b825ffc31", "Post-baseline current aggregate hash drifted after exact EOF normalization");
  for (const current of currentPostBaseline) assert(postBaselineSourcePaths.has(current.path), `Unexpected file inside post-baseline source/research roots: ${current.path}`);

  const intakeGroupById = new Map((postBaselineIntake?.classificationGroups ?? []).map((group) => [group.id, group]));
  for (const group of intakeGroupById.values()) {
    const members = originalPostBaselineEntries.filter((entry) => entry.classificationRuleId === group.id);
    assert(group.fileCount === members.length, `Post-baseline classification group count mismatch: ${group.id}`);
    assert(group.bytes === members.reduce((sum, entry) => sum + entry.bytes, 0), `Post-baseline classification group byte mismatch: ${group.id}`);
    const policyRule = policy.classificationRules.find((rule) => rule.id === group.id);
    assert(policyRule?.tier === group.tier, `Post-baseline policy tier mismatch: ${group.id}`);
  }
  for (const entry of originalPostBaselineEntries) assert(intakeGroupById.has(entry.classificationRuleId), `Post-baseline file references a missing group: ${entry.path}`);
  assert(postBaselineIntake?.preservation?.checksumIsBackup === false && postBaselineIntake?.preservation?.backupVerified === false, "Post-baseline checksum must not be represented as a backup");
  assert(postBaselineIntake?.preservation?.archiveUploaded === false && postBaselineIntake?.preservation?.lfsConfiguredOrUploaded === false, "Post-baseline external preservation must remain pending");
  assert(postBaselineIntake?.preservation?.originalsDeleted === false && postBaselineIntake?.preservation?.originalsMoved === false && postBaselineIntake?.preservation?.originalsRenamed === false && postBaselineIntake?.preservation?.originalsRewritten === false, "Post-baseline originals must remain untouched");
  assert(postBaselineIntake?.creativeStatus?.acceptedOrLockedByMark === false, "Post-baseline intake must not claim subjective acceptance");
  assert(postBaselineIntake?.creativeStatus?.v3Research === "rejected-as-beta-replacement", "Jack V3 must remain rejected as the beta/runtime replacement");
  assert(postBaselineIntake?.creativeStatus?.v4CandidatesBAndC === "rejected", "Jack V4 Candidates B/C rejection status drifted");
  assert(postBaselineIntake?.creativeStatus?.v4CandidateD === "exploratory-pending-mark-likeness-review", "Jack V4 Candidate D must remain exploratory and unapproved");
  assert(postBaselineIntake?.creativeStatus?.v4CandidateDRigBound === false && postBaselineIntake?.creativeStatus?.v4CandidateDRuntimeCandidate === false, "Jack V4 Candidate D must remain unrigged and non-runtime");
  assert(postBaselineIntake?.provenance?.v3Donor?.license === "CC-BY-3.0" && Boolean(postBaselineIntake?.provenance?.v3Donor?.requiredAttribution), "V3 donor CC BY 3.0 attribution record is incomplete");
  assert(postBaselineIntake?.provenance?.v3Donor?.licenseTextPresentInIntakeRoots === false && postBaselineIntake?.provenance?.v3Donor?.distributionAllowedBeforeLicenseAndAttributionDecision === false, "V3 donor distribution must remain blocked pending license/attribution packaging");
  const v4Provenance = postBaselineIntake?.provenance?.v4ProjectResearch;
  assert(v4Provenance?.privateReferenceCount === 10 && v4Provenance?.privateReferencesCopiedEmbeddedOrUploaded === false, "V4 private-reference protection record is incomplete");
  assert(v4Provenance?.newThirdPartyAssetUsed === false && v4Provenance?.candidateDStatus === "unapproved-unrigged-static-review-candidate", "V4 provenance/status record is incomplete");
  const v4CandidateDReportPath = "evidence/3d-jack/v4/jack-adult-v4-candidate-d-report.json";
  if (existsSync(absolute(v4CandidateDReportPath))) {
    const candidateDReport = JSON.parse(readFileSync(absolute(v4CandidateDReportPath), "utf8"));
    assert(candidateDReport.status === "exploratory-pending-mark-likeness-review", "V4 Candidate D report must remain exploratory and pending Mark review");
    assert(candidateDReport.rigBound === false && candidateDReport.runtimeCandidate === false && candidateDReport.animationCount === 0, "V4 Candidate D report must remain unrigged, static, and non-runtime");
    assert(candidateDReport.privateReferencesEmbedded === false, "V4 Candidate D must not embed private references");
  }
  const audioProvenance = postBaselineIntake?.provenance?.elevenLabsCandidates;
  const expectedDeltaContextPaths = new Set([
    "assets/audio/v1/audio-manifest.v1.json",
    "docs/audio/AUDIO_LICENSE_LEDGER.v1.md",
    "src/audio-cue-policy.test.ts",
  ]);
  const changedManagedContext = postBaselineDelta?.changedManagedContext ?? [];
  const changedManagedContextByPath = new Map(changedManagedContext.map((entry) => [normalize(entry.path), entry]));
  const originalCollisionContextByPath = new Map((postBaselineIntake?.managedCollisionContext ?? []).map((entry) => [normalize(entry.path), entry]));
  assert(changedManagedContext.length === expectedDeltaContextPaths.size && changedManagedContextByPath.size === expectedDeltaContextPaths.size, "Post-baseline delta must bind exactly three changed managed context files");
  for (const path of expectedDeltaContextPaths) {
    const entry = changedManagedContextByPath.get(path);
    const prior = originalCollisionContextByPath.get(path);
    assert(Boolean(entry && prior), `Post-baseline delta managed context chain is incomplete: ${path}`);
    assert(entry?.priorAcceptedBytes === prior?.bytes && entry?.priorAcceptedSha256 === prior?.sha256, `Post-baseline delta prior managed identity mismatch: ${path}`);
    assert(entry?.kind === "historical-handoff-context" && entry?.gitState === "tracked-modified" && entry?.editedByThisMilestone === false, `Post-baseline delta managed handoff contract mismatch: ${path}`);
    assert(existsSync(absolute(path)), `Post-baseline delta managed context is missing: ${path}`);
    if (existsSync(absolute(path))) assert(statSync(absolute(path)).size === entry?.currentBytes && fileHash(path) === entry?.currentSha256, `Post-baseline delta managed context identity drifted: ${path}`);
    if (path === "assets/audio/v1/audio-manifest.v1.json") assert(entry?.jsonValid === true && entry?.gatePromotion === "exact-second-refresh-mapping-only", "Audio manifest delta context must be exact, JSON-valid, and refresh-only");
    else assert(entry?.gatePromotion === "none-context-only", `Managed delta context must not promote gate status: ${path}`);
  }
  for (const record of [postBaselineIntake?.creativeStatus?.authoritativeRecord, postBaselineIntake?.provenance?.v3Donor?.record, v4Provenance?.sourceLedger, v4Provenance?.likenessSpec, audioProvenance?.licenseRecord, audioProvenance?.manifest]) {
    assert(Boolean(record && existsSync(absolute(record))), `Missing post-baseline provenance record: ${record ?? "undefined"}`);
  }
  if (existsSync(absolute(postBaselineIntake?.creativeStatus?.authoritativeRecord ?? ""))) {
    const creativeSuccessor = alphaInspectTransitionByPath.get(normalize(postBaselineIntake.creativeStatus.authoritativeRecord));
    assert(creativeSuccessor?.prior?.sha256 === postBaselineIntake.creativeStatus.authoritativeRecordSha256 && fileHash(postBaselineIntake.creativeStatus.authoritativeRecord) === creativeSuccessor?.current?.sha256, "Post-baseline creative authority successor chain drifted");
  }
  if (existsSync(absolute(postBaselineIntake?.provenance?.v3Donor?.record ?? ""))) {
    const successor = candidateEofTransitionByPath.get(normalize(postBaselineIntake.provenance.v3Donor.record));
    assert(successor?.prior?.sha256 === postBaselineIntake.provenance.v3Donor.recordSha256 && fileHash(postBaselineIntake.provenance.v3Donor.record) === successor?.current?.sha256, "Post-baseline V3 provenance successor chain drifted");
  }
  if (existsSync(absolute(v4Provenance?.sourceLedger ?? ""))) {
    const successor = candidateEofTransitionByPath.get(normalize(v4Provenance.sourceLedger));
    assert(successor?.prior?.sha256 === v4Provenance.sourceLedgerSha256 && fileHash(v4Provenance.sourceLedger) === successor?.current?.sha256, "Post-baseline V4 source-ledger successor chain drifted");
  }
  if (existsSync(absolute(v4Provenance?.likenessSpec ?? ""))) {
    const successor = candidateEofTransitionByPath.get(normalize(v4Provenance.likenessSpec));
    assert(successor?.prior?.sha256 === v4Provenance.likenessSpecSha256 && fileHash(v4Provenance.likenessSpec) === successor?.current?.sha256, "Post-baseline V4 likeness-specification successor chain drifted");
  }
  const audioLicenseDeltaContext = changedManagedContextByPath.get(normalize(audioProvenance?.licenseRecord ?? ""));
  const audioManifestDeltaContext = changedManagedContextByPath.get(normalize(audioProvenance?.manifest ?? ""));
  assert(audioLicenseDeltaContext?.priorAcceptedSha256 === audioProvenance?.licenseRecordSha256, "Post-baseline audio license history chain drifted");
  assert(audioManifestDeltaContext?.priorAcceptedSha256 === audioProvenance?.manifestSha256, "Post-baseline audio manifest history chain drifted");
  assert(audioProvenance?.generationBatchCount === 23 && audioProvenance?.generatedCandidateCount === 92, "Post-baseline ElevenLabs generation totals must remain 23 batches / 92 candidates");
  assert(audioProvenance?.locallyDownloadedRawCount === 2 && audioProvenance?.downloaded?.length === 2 && audioProvenance?.remainingDownloadsPending === true, "Post-baseline ElevenLabs download status mismatch");
  assert(audioProvenance?.runtimeOrMastered === false, "Raw ElevenLabs candidates must not be promoted to runtime/mastered status");
  if (existsSync(absolute(audioProvenance?.manifest ?? ""))) {
    const audioManifest = JSON.parse(readFileSync(absolute(audioProvenance.manifest), "utf8"));
    assert(audioManifest.schemaVersion === 1, "Post-baseline audio manifest schema mismatch");
    for (const candidate of audioProvenance.downloaded ?? []) {
      const intakeEntry = postBaselineByPath.get(normalize(candidate.path));
      assert(Boolean(intakeEntry), `Downloaded ElevenLabs candidate is absent from the intake: ${candidate.path}`);
      if (intakeEntry) assert(intakeEntry.bytes === candidate.bytes && intakeEntry.sha256 === candidate.sha256, `Downloaded ElevenLabs intake identity mismatch: ${candidate.path}`);
      assert(classify(normalize(candidate.path), policy)?.tier === "cold-archive-pending", `Downloaded ElevenLabs candidate must remain preservation-pending: ${candidate.path}`);
      const asset = audioManifest.assets?.find((entry) => entry.id === candidate.assetId);
      const relativeSource = normalize(candidate.path).replace(/^assets\/audio\/v1\//, "");
      const sourceCandidate = asset?.sourceCandidates?.find((entry) => normalize(entry.sourceFile) === relativeSource && entry.candidate === candidate.candidate);
      assert(asset?.generationId === candidate.generationId, `ElevenLabs generation ID mismatch: ${candidate.assetId}`);
      assert(Boolean(sourceCandidate), `ElevenLabs manifest is missing downloaded candidate: ${candidate.assetId}`);
      if (sourceCandidate) assert(sourceCandidate.bytes === candidate.bytes && sourceCandidate.sha256.toLowerCase() === candidate.sha256, `ElevenLabs manifest candidate identity mismatch: ${candidate.assetId}`);
    }
    for (const candidate of postBaselineDeltaEntries) {
      const asset = audioManifest.assets?.find((entry) => entry.id === candidate.assetId);
      const relativeSource = normalize(candidate.path).replace(/^assets\/audio\/v1\//, "");
      const sourceCandidate = asset?.sourceCandidates?.find((entry) => normalize(entry.sourceFile) === relativeSource && entry.candidate === candidate.candidate);
      assert(asset?.generationId === candidate.generationId, `Post-baseline delta generation ID mismatch: ${candidate.assetId}`);
      assert(Boolean(sourceCandidate), `Audio manifest is missing post-baseline delta candidate: ${candidate.assetId}`);
      if (sourceCandidate) assert(sourceCandidate.bytes === candidate.bytes && sourceCandidate.sha256.toLowerCase() === candidate.sha256, `Audio manifest post-baseline delta identity mismatch: ${candidate.assetId}`);
    }
    const localElevenLabsCandidates = audioManifest.assets?.flatMap((asset) => (asset.sourceCandidates ?? [])
      .filter((entry) => normalize(entry.sourceFile).startsWith("source/elevenlabs/2026-08-16/"))
      .map((entry) => ({ asset, entry }))) ?? [];
    assert(localElevenLabsCandidates.length === postBaselineEntries.filter((entry) => normalize(entry.path).startsWith("assets/audio/v1/source/elevenlabs/2026-08-16/")).length, "Audio manifest/current ElevenLabs intake count mismatch");
  }

  const managedAssetRefreshes = postBaselineIntake?.managedAssetRefreshes ?? [];
  const originalManagedAssetRefreshByPath = new Map(managedAssetRefreshes.map((entry) => [normalize(entry.path), entry]));
  const audioManifestRefreshPath = "assets/audio/v1/audio-manifest.v1.json";
  const audioManifestRefresh = originalManagedAssetRefreshByPath.get(audioManifestRefreshPath);
  assert(managedAssetRefreshes.length === 1 && originalManagedAssetRefreshByPath.size === 1 && Boolean(audioManifestRefresh), "Post-baseline managed asset refresh must be limited to the audio manifest");
  assert(audioManifestRefresh?.baselineCommit === "9c8a82140d6116b29b0fa7444d9ba64e73e2baf4", "Audio manifest refresh baseline commit mismatch");
  assert(audioManifestRefresh?.priorJsonValid === true && audioManifestRefresh?.currentJsonValid === true, "Audio manifest refresh JSON-validity evidence is incomplete");
  assert(audioManifestRefresh?.tracked === true && audioManifestRefresh?.gitState === "tracked-modified", "Audio manifest refresh must record tracked-modified status");
  try {
    const baselineManifest = execFileSync("git", ["show", `${audioManifestRefresh.baselineCommit}:${audioManifestRefreshPath}`], { cwd: root });
    assert(baselineManifest.length === audioManifestRefresh.priorBytes && sha256(baselineManifest) === audioManifestRefresh.priorSha256, "Audio manifest refresh baseline identity mismatch");
    JSON.parse(baselineManifest.toString("utf8"));
  } catch (error) {
    errors.push(`Audio manifest refresh baseline is not recoverable JSON: ${error.message}`);
  }
  assert(audioManifestDeltaContext?.priorAcceptedBytes === audioManifestRefresh?.currentBytes && audioManifestDeltaContext?.priorAcceptedSha256 === audioManifestRefresh?.currentSha256, "Audio manifest second-refresh history chain mismatch");
  assert(existsSync(absolute(audioManifestRefreshPath)), "Audio manifest refresh current file is missing");
  if (existsSync(absolute(audioManifestRefreshPath))) {
    assert(statSync(absolute(audioManifestRefreshPath)).size === audioManifestDeltaContext?.currentBytes && fileHash(audioManifestRefreshPath) === audioManifestDeltaContext?.currentSha256, "Audio manifest second-refresh current identity mismatch");
    try {
      JSON.parse(readFileSync(absolute(audioManifestRefreshPath), "utf8"));
    } catch (error) {
      errors.push(`Audio manifest refresh current JSON is invalid: ${error.message}`);
    }
  }
  const managedAssetRefreshByPath = new Map([[audioManifestRefreshPath, {
    priorBytes: audioManifestRefresh?.priorBytes,
    priorSha256: audioManifestRefresh?.priorSha256,
    currentBytes: audioManifestDeltaContext?.currentBytes,
    currentSha256: audioManifestDeltaContext?.currentSha256,
  }]]);

  const expectedCollisionStates = new Map([
    ["assets/audio/v1/audio-manifest.v1.json", "tracked-modified"],
    ["docs/audio/AUDIO_LICENSE_LEDGER.v1.md", "tracked-modified"],
    ["docs/design/3D_JACK_MODEL_HANDOFF.md", "tracked-modified"],
    ["package.json", "tracked-modified"],
    ["src/audio-cue-policy.ts", "tracked-modified"],
    ["src/audio-cue-policy.test.ts", "tracked-modified"],
    ["scripts/verify-audio-v1.mjs", "untracked"],
  ]);
  const expectedCollisionPaths = new Set(expectedCollisionStates.keys());
  const managedCollisionContext = postBaselineIntake?.managedCollisionContext ?? [];
  const collisionByPath = new Map(managedCollisionContext.map((entry) => [normalize(entry.path), entry]));
  assert(collisionByPath.size === expectedCollisionPaths.size && managedCollisionContext.length === expectedCollisionPaths.size, "Managed collision context must contain exactly seven unique files");
  for (const path of expectedCollisionPaths) {
    const entry = collisionByPath.get(path);
    const expectedState = expectedCollisionStates.get(path);
    assert(Boolean(entry), `Managed collision context is missing: ${path}`);
    assert(entry?.gitState === expectedState, `Managed collision recorded state mismatch: ${path}`);
    assertCommittedStatusSuccessor("managed-collision-context", path, expectedState);
    assert(existsSync(absolute(path)), `Managed collision path is missing: ${path}`);
    const masteredLatestContext = masteredContextByPath.get(path);
    const latestContext = masteredLatestContext ?? changedManagedContextByPath.get(path);
    const expectedBytes = masteredLatestContext?.bytes ?? latestContext?.currentBytes ?? entry?.bytes;
    const expectedSha256 = masteredLatestContext?.sha256 ?? latestContext?.currentSha256 ?? entry?.sha256;
    if (existsSync(absolute(path))) assert(statSync(absolute(path)).size === expectedBytes && fileHash(path) === expectedSha256, `Managed collision identity drifted: ${path}`);
    if (path === audioManifestRefreshPath) assert(entry?.gatePromotion === "exact-refresh-mapping-only", "Audio manifest collision context must be limited to the exact refresh mapping");
    else assert(entry?.gatePromotion === "none-context-only", `Managed collision context must not promote gate status: ${path}`);
  }

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
        const refreshed = scopeName === "evidence" ? evidenceRefreshByPath.get(original.path) : null;
        const managedAssetRefresh = scopeName === "assets" ? managedAssetRefreshByPath.get(original.path) : null;
        assert(Boolean(mapped || refreshed || managedAssetRefresh), `Captured ${scopeName} file drifted without an approved normalization/refresh mapping: ${original.path}`);
        if (mapped) {
          assert(mapped.rawBytes === original.bytes && mapped.rawSha256 === original.sha256, `Normalization raw identity mismatch: ${original.path}`);
          assert(mapped.normalizedBytes === found.bytes && mapped.normalizedSha256 === found.sha256, `Normalization current identity mismatch: ${original.path}`);
        } else if (refreshed) {
          assert(refreshed.priorBytes === original.bytes && refreshed.priorSha256 === original.sha256, `Evidence refresh prior identity mismatch: ${original.path}`);
          assert(refreshed.currentBytes === found.bytes && refreshed.currentSha256 === found.sha256, `Evidence refresh current identity mismatch: ${original.path}`);
        } else if (managedAssetRefresh) {
          assert(managedAssetRefresh.priorBytes === original.bytes && managedAssetRefresh.priorSha256 === original.sha256, `Managed asset refresh prior identity mismatch: ${original.path}`);
          assert(managedAssetRefresh.currentBytes === found.bytes && managedAssetRefresh.currentSha256 === found.sha256, `Managed asset refresh current identity mismatch: ${original.path}`);
        }
      }
    }
    const capturedPaths = new Set(captured.files.map((file) => file.path));
    const extras = current.files.filter((file) => !capturedPaths.has(file.path));
    if (scopeName === "assets") {
      const allowedAssets = new Set([...(policy.canonicalCopies ?? []).map((mapping) => normalize(mapping.copy)), ...postBaselineAssetPaths]);
      assert(extras.length === allowedAssets.size, `Unexpected post-inventory asset count: expected ${allowedAssets.size}, found ${extras.length}`);
      for (const extra of extras) assert(allowedAssets.has(extra.path), `Unexpected post-inventory asset: ${extra.path}`);
      for (const allowed of allowedAssets) assert(extras.some((extra) => extra.path === allowed), `Missing approved post-inventory asset: ${allowed}`);
    } else {
      assert(extras.length === allowedCurrentEvidencePaths.size, `Unexpected post-inventory evidence count: expected ${allowedCurrentEvidencePaths.size}, found ${extras.length}`);
      for (const extra of extras) assert(allowedCurrentEvidencePaths.has(extra.path), `Unexpected post-inventory evidence file: ${extra.path}`);
      for (const allowed of allowedCurrentEvidencePaths) assert(extras.some((extra) => extra.path === allowed), `Missing approved post-inventory evidence: ${allowed}`);
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
    assert(policy.baselineTextNormalization?.record === normalizationPath, `Asset policy must point to ${normalizationPath}`);
    assert(policy.baselineTextNormalization?.memberCount === 21, "Asset policy baseline-text member count must remain 21");
    assert(normalizationBaselineCommit === "9c8a82140d6116b29b0fa7444d9ba64e73e2baf4", "Asset policy baseline-text commit must remain the recoverable V0.6–V0.8 checkpoint");
    const rawManifestPath = normalize(posix.join(baselineText.stagingRoot, baselineText.manifest.name));
    const rawManifest = JSON.parse(readFileSync(absolute(rawManifestPath), "utf8"));
    const rawByPath = new Map((rawManifest.members ?? []).map((entry) => [normalize(entry.path), entry]));
    const trackedNormalizationPaths = new Set(gitPaths(["ls-files", "--cached", "-z", "--", ...normalizationByPath.keys()]));
    assert(rawManifest.memberCount === 21 && rawByPath.size === 21, "Baseline text private manifest must contain 21 unique members");
    for (const [path, entry] of normalizationByPath) {
      const raw = rawByPath.get(path);
      assert(Boolean(raw), `Normalization path missing from raw preservation manifest: ${path}`);
      if (raw) assert(raw.bytes === entry.rawBytes && raw.sha256 === entry.rawSha256, `Normalization raw preservation mismatch: ${path}`);
      assert(trackedNormalizationPaths.has(path), `Normalized path is no longer tracked: ${path}`);
      try {
        const baseline = execFileSync("git", ["show", `${normalizationBaselineCommit}:${path}`], { cwd: root });
        assert(baseline.length === entry.normalizedBytes && sha256(baseline) === entry.normalizedSha256, `Committed normalized baseline identity mismatch: ${path}`);
        assert(!baseline.toString("utf8").includes("\r"), `Committed normalized baseline must use LF only: ${path}`);
      } catch (error) {
        errors.push(`Committed normalized baseline is not recoverable for ${path}: ${error.message}`);
      }
      assert(existsSync(absolute(path)), `Current mapped text path is missing: ${path}`);
      if (existsSync(absolute(path))) {
        const text = readFileSync(absolute(path), "utf8");
        assert(!text.includes("\r"), `Current mapped text must use LF only: ${path}`);
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
    if (runtime.sha256) assert(bytes === runtime.maxBytes && fileHash(runtime.path) === runtime.sha256, `Checksum-bound runtime asset identity drifted: ${runtime.path}`);
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
  for (const entry of postBaselineEntries) {
    const tier = classify(normalize(entry.path), policy)?.tier;
    if (tier === "cold-archive-pending") assert(!trackedAssetPaths.has(normalize(entry.path)), `Preservation-pending post-baseline file must remain untracked: ${entry.path}`);
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
  if (!process.argv.includes("--write-classification") && existsSync(absolute(classificationPath))) {
    try {
      const recorded = JSON.parse(readFileSync(absolute(classificationPath), "utf8"));
      assert(recorded.sourceInventory === classification.sourceInventory, `${classificationPath} source inventory mismatch`);
      assert(recorded.sourceInventoryAssetsSha256 === classification.sourceInventoryAssetsSha256, `${classificationPath} asset anchor mismatch`);
      assert(recorded.sourceInventoryEvidenceSha256 === classification.sourceInventoryEvidenceSha256, `${classificationPath} evidence anchor mismatch`);
      assert(JSON.stringify(recorded.groups) === JSON.stringify(classification.groups), `${classificationPath} does not match the deterministic current classification`);
    } catch (error) {
      errors.push(`Invalid current classification ${classificationPath}: ${error.message}`);
    }
  }
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

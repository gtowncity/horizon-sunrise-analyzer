import { execFileSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import { resolve, relative } from "node:path";
import { createHash } from "node:crypto";
import { zipSync } from "fflate";
import { verifyZip } from "./verify-astro-360-audit.mjs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const root = resolve("."),
  output = resolve(process.env.ASTRO_AUDIT_OUTPUT ?? "../astro-audit-output");
const evidence = resolve(
  process.env.ASTRO_AUDIT_EVIDENCE ?? "../astro-audit-evidence",
);
if (!relative(root, output).startsWith(".."))
  throw new Error("ZIP must be outside source checkout");
const branch =
    git("branch", "--show-current") ||
    process.env.GITHUB_HEAD_REF ||
    process.env.GITHUB_REF_NAME ||
    "DETACHED",
  commit = git("rev-parse", "HEAD");
if (branch !== "feature/astro-360-horizon" && !process.env.CI)
  throw new Error("Unexpected branch");
const hash = (b) => createHash("sha256").update(b).digest("hex"),
  files = {};
const sanitize = (text) =>
  text
    .replaceAll(root, "<CHECKOUT>")
    .replaceAll(root.replaceAll("\\", "/"), "<CHECKOUT>")
    .replaceAll(/C:[\\/]Users[\\/][^\\/\r\n ]+/gi, "<LOCAL_USER>");
const add = (name, bytes, clean = false) => {
  const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  files[name] = clean ? Buffer.from(sanitize(data.toString())) : data;
};
const tracked = git("ls-files", "-z").split("\0").filter(Boolean);
for (const path of tracked) {
  if (
    /(^|\/)(node_modules|_local_audit|test-results|dist|\.env|work|outputs)(\/|$)/.test(
      path,
    ) ||
    /\.(zip|log)$/.test(path)
  )
    continue;
  add("project/" + path, readFileSync(path));
}
const walk = (dir, prefix) => {
  for (const name of readdirSync(dir).sort()) {
    const file = resolve(dir, name);
    if (statSync(file).isDirectory()) walk(file, prefix + name + "/");
    else if (/\.(json|log|md|csv|png)$/.test(name))
      add(prefix + name, readFileSync(file), !name.endsWith(".png"));
  }
};
if (!existsSync(evidence)) throw new Error("Validation evidence missing");
walk(evidence, "evidence/");
const report = JSON.parse(readFileSync(resolve(evidence, "report.json")));
const required = [
  "npm run lint",
  "npm run typecheck",
  "npm test",
  "npm run build",
  "npm run test:e2e",
  "npm audit --audit-level=high",
];
const commandSuccess = required.every((c) =>
  report.results.some((r) => r.command === c && r.exitCode === 0),
);
const ninaReference = existsSync(
  resolve(evidence, "nina-parser-execution.json"),
)
  ? JSON.parse(readFileSync(resolve(evidence, "nina-parser-execution.json")))
  : null;
const success =
  commandSuccess &&
  (!existsSync("docs/astro-360/ROUND2_STATUS.json") ||
    ninaReference?.classification === "PASS_WITH_KNOWN_GAPS");
const gaps = [
  "Native bilinear-support and deterministic uncertainty bounds implemented only in projected-grid model; geographic/physical certification missing",
  "Multi-site DGM1/DOM20 physical accuracy and independent on-site controls pending",
  "LoD2 roof-edge control collected with discrepancies up to ~40 m; agreement not accepted; LAS/LAZ and measured override layer pending",
  "NINA installed-application import NOT_EXECUTED",
  "Geographic error enclosure, directed rounding, verified uncertainty parameters, resume and full accessibility/large-domain memory audit pending",
];
const validation = {
  schema: "astro360-audit-1",
  classification: success ? "PASS_WITH_KNOWN_GAPS" : "FAIL",
  scientificRelease: "BLOCKED",
  branch,
  commit,
  testResults: report.results,
  ninaParserReference: ninaReference,
  knownGaps: gaps,
  ninaExport: "DENIED_FOR_ALL_SUPPORTED_SCHEMAS",
  modelBounds: "CONDITIONAL_PROJECTED_GRID_ONLY",
  roundStatus: existsSync("docs/astro-360/ROUND2_STATUS.json")
    ? JSON.parse(readFileSync("docs/astro-360/ROUND2_STATUS.json"))
    : null,
  realData: existsSync(resolve(evidence, "real-data.json"))
    ? JSON.parse(readFileSync(resolve(evidence, "real-data.json")))
    : "NOT_EXECUTED",
  deployment: "NOT_DEPLOYED",
};
add(
  "MACHINE_READABLE_VALIDATION_REPORT.json",
  JSON.stringify(validation, null, 2),
);
add(
  "README_FIRST.md",
  "# Astro360 audit\n\nIntegrity checked independently after ZIP close. Validation: " +
    validation.classification +
    ". Scientific release BLOCKED. No production deployment.\n\nAll current git-tracked public source and documentation is in project/. Sanitized execution logs are in evidence/. SOURCE_MANIFEST.json lists sizes and SHA256, excluding only itself. Separate ZIP .sha256 and .verification.json verify the final closed archive. Known gaps are explicit in MACHINE_READABLE_VALIDATION_REPORT.json.\n",
);
add(
  "GIT_STATE.json",
  JSON.stringify(
    {
      branch,
      commit,
      status: git("status", "--short"),
      changedFiles: git("diff", "--name-only", "18c2cc3"),
      diffStat: git("diff", "--stat", "18c2cc3"),
      remote: git("remote", "get-url", "origin"),
    },
    null,
    2,
  ),
);
// Keep local audit payloads out. Never copy private historical sources.
const forbidden = [
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{30,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /Bearer [A-Za-z0-9._-]{30,}/,
];
for (const [name, bytes] of Object.entries(files)) {
  if (!name.endsWith(".png"))
    for (const re of forbidden)
      if (re.test(bytes.toString()))
        throw new Error("Secret pattern in " + name);
  if (/private.*archive|_local_audit|\.env(?:\.|$)/i.test(name))
    throw new Error("Excluded path in " + name);
}
const manifest = {
  schema: "astro360-source-manifest-1",
  excludedSelf: "SOURCE_MANIFEST.json",
  files: Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, b]) => ({ path, bytes: b.length, sha256: hash(b) })),
};
add("SOURCE_MANIFEST.json", JSON.stringify(manifest, null, 2));
const epoch = Number(
    process.env.SOURCE_DATE_EPOCH ?? git("show", "-s", "--format=%ct", "HEAD"),
  ),
  mtime = new Date(Math.max(epoch, 315532800) * 1000);
const zipEntries = Object.fromEntries(
  Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, b]) => [name, [new Uint8Array(b), { mtime }]]),
);
mkdirSync(output, { recursive: true });
const timestamp = new Date()
  .toISOString()
  .replaceAll(/[-:]/g, "")
  .replace(/\.\d{3}Z$/, "Z");
const path = resolve(
  output,
  `ASTRO360_CODEX_AUDIT_${timestamp}_${commit.slice(0, 8)}.zip`,
);
writeFileSync(path, zipSync(zipEntries, { level: 6 }));
const integrity = verifyZip(path); // reopens finalized file, independent decompressor + CRC
writeFileSync(path + ".verification.json", JSON.stringify(integrity, null, 2));
writeFileSync(
  path + ".sha256",
  integrity.sha256 + "  " + path.split(/[\\/]/).at(-1) + "\n",
);
console.log(JSON.stringify({ file: path, ...integrity }));
if (!success) process.exitCode = 1;

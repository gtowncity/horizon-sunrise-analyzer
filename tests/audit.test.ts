import { test, expect } from "vitest";
import { zipSync } from "fflate";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

test("independent audit reader accepts exact manifest and rejects corrupted CRC and SHA", () => {
  const dir = mkdtempSync(join(tmpdir(), "astro-audit-")),
    file = join(dir, "fixture.zip");
  const files: Record<string, Uint8Array> = {
    "README_FIRST.md": Buffer.from("# Synthetic audit fixture\n"),
    "MACHINE_READABLE_VALIDATION_REPORT.json": Buffer.from(
      JSON.stringify({ classification: "PASS_WITH_KNOWN_GAPS" }),
    ),
    "fixture.csv": Buffer.from("a,b\n1,2\n"),
  };
  const manifest = {
    excludedSelf: "SOURCE_MANIFEST.json",
    files: Object.entries(files).map(([path, b]) => ({
      path,
      bytes: b.length,
      sha256: createHash("sha256").update(b).digest("hex"),
    })),
  };
  files["SOURCE_MANIFEST.json"] = Buffer.from(JSON.stringify(manifest));
  const check = () =>
    spawnSync(process.execPath, ["scripts/verify-astro-360-audit.mjs", file], {
      encoding: "utf8",
    });
  try {
    writeFileSync(file, zipSync(files, { level: 0 }));
    expect(check().status).toBe(0);
    const bytes = readFileSync(file);
    const offset = 30 + bytes.readUInt16LE(26) + bytes.readUInt16LE(28);
    bytes[offset] ^= 1;
    writeFileSync(file, bytes);
    expect(check().status).toBe(1);
    manifest.files[0].sha256 = "0".repeat(64);
    files["SOURCE_MANIFEST.json"] = Buffer.from(JSON.stringify(manifest));
    writeFileSync(file, zipSync(files));
    expect(check().status).toBe(1);
    delete files["fixture.csv"];
    writeFileSync(file, zipSync(files));
    expect(check().status).toBe(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("Pages deployment steps gate main and approved events", () => {
  const text = readFileSync(".github/workflows/pages.yml", "utf8");
  const gates = text.split("\n").filter((l) => l.trim().startsWith("if:"));
  expect(gates).toHaveLength(4);
  gates.forEach((g) => {
    expect(g).toContain("github.ref == 'refs/heads/main'");
    expect(g).toContain("github.event_name == 'push'");
    expect(g).toContain("github.event_name == 'workflow_dispatch'");
  });
  expect(text).not.toContain("github.event_name != 'pull_request'");
});

test("audit CI has baseline history and uploads the actual packaging directory", () => {
  const text = readFileSync(".github/workflows/astro-360-audit.yml", "utf8");
  expect(text).toContain("fetch-depth: 0");
  expect(text).toContain("path: ${{ env.ASTRO_AUDIT_OUTPUT }}/*");
  expect(text).not.toContain("runner.temp");
});

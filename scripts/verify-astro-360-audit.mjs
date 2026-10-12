import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { pathToFileURL } from "node:url";

const sha = (b) => createHash("sha256").update(b).digest("hex");
export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let n = 0; n < 8; n++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
/** Independent ZIP reader: Node zlib and explicit central/local headers, not producer library. */
export function verifyZip(path) {
  const zip = readFileSync(path),
    entries = new Map();
  let end = -1;
  for (let n = zip.length - 22; n >= Math.max(0, zip.length - 65557); n--)
    if (zip.readUInt32LE(n) === 0x06054b50) {
      end = n;
      break;
    }
  if (
    end < 0 ||
    zip.readUInt16LE(end + 4) !== 0 ||
    zip.readUInt16LE(end + 6) !== 0 ||
    end + 22 + zip.readUInt16LE(end + 20) !== zip.length
  )
    throw new Error("Invalid ZIP end/disk");
  const count = zip.readUInt16LE(end + 10),
    centralSize = zip.readUInt32LE(end + 12),
    centralStart = zip.readUInt32LE(end + 16);
  if (
    count === 65535 ||
    zip.readUInt16LE(end + 8) !== count ||
    centralStart + centralSize !== end
  )
    throw new Error("Unsupported or corrupt ZIP directory");
  let cursor = centralStart;
  for (let n = 0; n < count; n++) {
    if (zip.readUInt32LE(cursor) !== 0x02014b50)
      throw new Error("Invalid central header");
    const flags = zip.readUInt16LE(cursor + 8),
      method = zip.readUInt16LE(cursor + 10),
      crc = zip.readUInt32LE(cursor + 16),
      packed = zip.readUInt32LE(cursor + 20),
      size = zip.readUInt32LE(cursor + 24),
      nl = zip.readUInt16LE(cursor + 28),
      el = zip.readUInt16LE(cursor + 30),
      cl = zip.readUInt16LE(cursor + 32),
      local = zip.readUInt32LE(cursor + 42);
    const name = zip.subarray(cursor + 46, cursor + 46 + nl).toString("utf8");
    if (
      name.startsWith("/") ||
      name.includes("\\") ||
      name.split("/").includes("..") ||
      entries.has(name) ||
      flags & 1 ||
      ![0, 8].includes(method) ||
      size > 100 * 1024 * 1024
    )
      throw new Error("Unsafe/unsupported ZIP entry");
    if (
      zip.readUInt32LE(local) !== 0x04034b50 ||
      zip.readUInt16LE(local + 8) !== method
    )
      throw new Error("Invalid local header");
    const ln = zip.readUInt16LE(local + 26),
      le = zip.readUInt16LE(local + 28);
    if (zip.subarray(local + 30, local + 30 + ln).toString("utf8") !== name)
      throw new Error("Local/central filename mismatch");
    const begin = local + 30 + ln + le;
    if (begin + packed > centralStart) throw new Error("Invalid data extent");
    const compressed = zip.subarray(begin, begin + packed),
      bytes =
        method === 0
          ? compressed
          : inflateRawSync(compressed, { maxOutputLength: 100 * 1024 * 1024 });
    if (bytes.length !== size || crc32(bytes) !== crc)
      throw new Error("CRC/size mismatch: " + name);
    entries.set(name, bytes);
    cursor += 46 + nl + el + cl;
  }
  if (cursor !== end) throw new Error("Directory size mismatch");
  const manifest = JSON.parse(
    entries.get("SOURCE_MANIFEST.json")?.toString() ?? "null",
  );
  if (
    !manifest ||
    manifest.excludedSelf !== "SOURCE_MANIFEST.json" ||
    manifest.files.length !== entries.size - 1
  )
    throw new Error("Manifest/self rule mismatch");
  const names = new Set();
  for (const f of manifest.files) {
    const b = entries.get(f.path);
    if (names.has(f.path) || !b || b.length !== f.bytes || sha(b) !== f.sha256)
      throw new Error("Manifest SHA256/size mismatch: " + f.path);
    names.add(f.path);
  }
  for (const [name, b] of entries) {
    if (name.endsWith(".json")) JSON.parse(b.toString());
    if (name.endsWith(".md") && !b.toString().trim())
      throw new Error("Empty documentation: " + name);
    if (name.endsWith(".csv") && !b.toString().includes("\n"))
      throw new Error("Invalid CSV: " + name);
  }
  const validation = JSON.parse(
    entries.get("MACHINE_READABLE_VALIDATION_REPORT.json").toString(),
  );
  if (
    !["PASS", "PASS_WITH_KNOWN_GAPS", "FAIL"].includes(
      validation.classification,
    )
  )
    throw new Error("Invalid validation classification");
  return {
    integrity: "PASS",
    entries: entries.size,
    manifestVerified: manifest.files.length,
    crc: "PASS",
    sha256: sha(zip),
    validation: validation.classification,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const report = verifyZip(process.argv[2]);
    writeFileSync(
      process.argv[2] + ".verification.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } catch (error) {
    console.error("FAIL", error.message);
    process.exitCode = 1;
  }
}

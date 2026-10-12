import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const output = resolve(
  process.env.ASTRO_AUDIT_EVIDENCE ?? "../astro-audit-evidence",
);
mkdirSync(output, { recursive: true });
const npm = process.env.ASTRO_NPM_CLI ?? process.env.npm_execpath;
if (!npm)
  throw new Error(
    "Run via npm run audit:validate or set ASTRO_NPM_CLI to npm-cli.js",
  );
const commands = [
  ...[...(process.argv.includes("--install") ? [["ci"]] : [])],
  ["run", "lint"],
  ["run", "typecheck"],
  ["test"],
  ["run", "build"],
  ["exec", "--", "playwright", "install", "chromium"],
  ["run", "test:e2e"],
  ["audit", "--audit-level=high"],
];
const results = [];
for (const args of commands) {
  const start = new Date(),
    res = spawnSync(process.execPath, [npm, ...args], {
      encoding: "utf8",
      maxBuffer: 50e6,
      env: process.env,
    });
  const name = args.join("-").replaceAll(/[^\w-]/g, "") + ".log";
  const log = ((res.stdout ?? "") + (res.stderr ?? ""))
    .replaceAll(resolve("."), "<CHECKOUT>")
    .replaceAll(resolve(".").replaceAll("\\", "/"), "<CHECKOUT>")
    .replaceAll(/C:[\\/]Users[\\/][^\\/\r\n ]+/gi, "<LOCAL_USER>");
  writeFileSync(resolve(output, name), log);
  results.push({
    command: "npm " + args.join(" "),
    startedAt: start.toISOString(),
    durationMs: Date.now() - start.getTime(),
    exitCode: res.status,
    error: res.error?.message,
    log: name,
  });
  writeFileSync(
    resolve(output, "report.json"),
    JSON.stringify(
      {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        results,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(results.at(-1)));
}
process.exitCode = results.some((r) => r.exitCode !== 0) ? 1 : 0;

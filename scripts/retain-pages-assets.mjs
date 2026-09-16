import { readdir, readFile, writeFile, access } from "node:fs/promises";

// Keep one published generation's immutable chunks for already-open tabs.
// Never copy its HTML: new visits must load the new application.
const base = "https://gtowncity.github.io/horizon-sunrise-analyzer/";
const valid = /^[\w.-]+-[\w-]{8}\.(?:js|css)$/;
const currentAssets = (await readdir("dist/assets")).filter((n) =>
  valid.test(n),
);
const response = await fetch(new URL("asset-generations.json", base), {
  cache: "no-store",
  signal: AbortSignal.timeout(15000),
});
let queue;
let crawl = false;
if (response.ok) {
  queue = (await response.json()).currentAssets;
  if (!Array.isArray(queue) || queue.some((n) => !valid.test(n)))
    throw new Error("Invalid published asset manifest");
} else if (response.status === 404) {
  // Bootstrap the first manifest from the existing Vite-generated graph.
  const index = await fetch(new URL("index.html", base), {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!index.ok)
    throw new Error(`Published index unavailable: ${index.status}`);
  queue = [
    ...(await index.text()).matchAll(/[\w.-]+-[\w-]{8}\.(?:js|css)(?![\w.])/g),
  ].map((m) => m[0]);
  if (!queue.length) throw new Error("No existing application chunks found");
  crawl = true;
} else throw new Error(`Published manifest unavailable: ${response.status}`);
const previous = new Set();
for (let j = 0; j < queue.length; j++) {
  const name = queue[j];
  if (previous.has(name)) continue;
  previous.add(name);
  if (previous.size > 80) throw new Error("Unexpected asset graph size");
  let content;
  try {
    await access(`dist/assets/${name}`);
    content = await readFile(`dist/assets/${name}`);
  } catch {
    const r = await fetch(new URL(`assets/${name}`, base), {
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok)
      throw new Error(`Previous chunk unavailable: ${name}: ${r.status}`);
    content = Buffer.from(await r.arrayBuffer());
    if (content.length > 8 * 1024 * 1024)
      throw new Error("Unexpected chunk size");
    await writeFile(`dist/assets/${name}`, content);
  }
  if (crawl && name.endsWith(".js"))
    for (const m of content
      .toString()
      .matchAll(/[\w.-]+-[\w-]{8}\.(?:js|css)(?![\w.])/g))
      queue.push(m[0]);
}
await writeFile(
  "dist/asset-generations.json",
  JSON.stringify({ currentAssets, previousAssets: [...previous] }, null, 2),
);
console.log(
  `Retained ${previous.size} previously published chunks; ${currentAssets.length} current chunks.`,
);

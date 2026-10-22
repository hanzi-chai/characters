import { mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { downloads, unicodeVersion, pinyinCommit, wanxiangCommit } from "../src/sources";
import { filesIn, sha256, type SourceLock } from "../src/integrity";

// Existing locks are authoritative. --refresh explicitly accepts changed upstream bytes.
const refresh = process.argv.includes("--refresh");
const old: SourceLock | undefined = await Bun.file("sources.lock.json").exists() ? await Bun.file("sources.lock.json").json() : undefined;
for (const source of downloads) {
  await mkdir(dirname(source.path), { recursive: true });
  const expected = old?.files.find(f => f.path === source.path);
  if (!refresh && await Bun.file(source.path).exists()) {
    if (expected && sha256(new Uint8Array(await Bun.file(source.path).arrayBuffer())) !== expected.sha256) throw new Error(`Local checksum mismatch: ${source.path}`);
    console.log(`cached ${source.path}`);
    continue;
  }
  let bytes: Uint8Array | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      bytes = new Uint8Array(await response.arrayBuffer());
      break;
    } catch (error) { if (attempt === 3) throw new Error(`${source.url}: ${error}`); }
  }
  if (!bytes?.length) throw new Error(`Empty download: ${source.url}`);
  if (!refresh && expected && sha256(bytes) !== expected.sha256) throw new Error(`Upstream changed: ${source.path}; inspect before --refresh`);
  await Bun.write(source.path + ".tmp", bytes);
  await rename(source.path + ".tmp", source.path);
  console.log(`downloaded ${source.path}`);
}

async function run(command: string[]) {
  const result = Bun.spawnSync(command, { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
}
await run(["unzip", "-oq", `sources/unicode-${unicodeVersion}/Unihan.zip`, "-d", `sources/unicode-${unicodeVersion}`]);
await run(["tar", "-xzf", "sources/pinyin-data/upstream.tar.gz", "-C", "sources/pinyin-data", "--strip-components=1"]);
await mkdir("sources/cns11643/Properties", { recursive: true });
await mkdir("sources/cns11643/MapingTables", { recursive: true });
await run(["unzip", "-oq", "sources/cns11643/Properties.zip", "CNS_phonetic.txt", "CNS_pinyin_1.txt", "CNS_pinyin_2.txt", "-d", "sources/cns11643/Properties"]);
await run(["unzip", "-oq", "sources/cns11643/MapingTables.zip", "Unicode/*", "-d", "sources/cns11643/MapingTables"]);

const paths = [...await filesIn("sources"), "research/tr38-41.html"].sort();
const files: SourceLock["files"] = [];
for (const path of paths) {
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  const url = downloads.find(f => f.path === path)?.url
    ?? (path.startsWith("sources/pinyin-data/")
      ? `https://github.com/mozillazg/pinyin-data/blob/${pinyinCommit}/${path.slice("sources/pinyin-data/".length)}`
      : path.startsWith("sources/cns11643/")
        ? `https://data.cns11643.gov.tw/opendata/${path.includes("/Properties/") ? "Properties" : "MapingTables"}.zip#${path.split("/").slice(path.includes("/Properties/") ? -1 : -2).join("/")}`
        : `https://www.unicode.org/Public/${unicodeVersion}/ucd/Unihan.zip#${path.split("/").at(-1)}`);
  const entry = { path, bytes: bytes.length, sha256: sha256(bytes), url };
  const previous = old?.files.find(f => f.path === path);
  if (!refresh && previous && previous.sha256 !== entry.sha256) throw new Error(`Extracted file changed: ${path}`);
  files.push(entry);
}
const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(new Date());
await Bun.write("sources.lock.json", JSON.stringify({ schema: 1, unicodeVersion, collectedOn: refresh ? today : old?.collectedOn ?? today, pinyinCommit, wanxiangCommit, files }, null, 2) + "\n");
console.log(`Locked ${files.length} original files.`);

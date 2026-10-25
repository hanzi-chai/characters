import { mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { downloads, unicodeVersion, pinyinCommit, wanxiangCommit, yedictSnapshot, zitoolsSnapshot, webDownload } from "../src/sources";
import { filesIn, sha256, type SourceLock } from "../src/integrity";

// Existing locks are authoritative. --refresh explicitly accepts changed upstream bytes.
const refresh = process.argv.includes("--refresh");
const old: SourceLock | undefined = await Bun.file("sources.lock.json").exists() ? await Bun.file("sources.lock.json").json() : undefined;
const previousFiles = new Map(old?.files.map(file => [file.path, file]));
const configured = new Map(downloads.map(source => [source.path, source]));
for (const file of old?.files ?? []) {
  const match = file.path.match(/^sources\/(yedict|zitools)\/U([0-9A-F]{5})\.json$/);
  if (!match) continue;
  const source = webDownload(match[1] as "yedict" | "zitools", parseInt(match[2], 16));
  if (source.url !== file.url) throw new Error(`Unexpected dictionary URL: ${file.path}`);
  configured.set(source.path, source);
}
let cached = 0;
for (const source of configured.values()) {
  await mkdir(dirname(source.path), { recursive: true });
  const expected = previousFiles.get(source.path);
  if (!refresh && await Bun.file(source.path).exists()) {
    if (expected && sha256(new Uint8Array(await Bun.file(source.path).arrayBuffer())) !== expected.sha256) throw new Error(`Local checksum mismatch: ${source.path}`);
    cached++;
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

// Lock configured downloads and their extracted originals only. Investigatory
// snapshots (including cloned repositories) may coexist under sources/.
const selected = new Set(configured.keys());
for (const directory of ["sources/pinyin-data", "sources/cns11643/Properties", "sources/cns11643/MapingTables"]) {
  for (const path of await filesIn(directory)) selected.add(path);
}
for (const path of await filesIn(`sources/unicode-${unicodeVersion}`)) {
  if (/\/Unihan_[A-Za-z]+\.txt$/.test(path)) selected.add(path);
}
const paths = [...selected].sort();
const files: SourceLock["files"] = [];
for (const path of paths) {
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  const url = configured.get(path)?.url
    ?? (path.startsWith("sources/pinyin-data/")
      ? `https://github.com/mozillazg/pinyin-data/blob/${pinyinCommit}/${path.slice("sources/pinyin-data/".length)}`
      : path.startsWith("sources/cns11643/")
        ? `https://data.cns11643.gov.tw/opendata/${path.includes("/Properties/") ? "Properties" : "MapingTables"}.zip#${path.split("/").slice(path.includes("/Properties/") ? -1 : -2).join("/")}`
        : `https://www.unicode.org/Public/${unicodeVersion}/ucd/Unihan.zip#${path.split("/").at(-1)}`);
  const entry = { path, bytes: bytes.length, sha256: sha256(bytes), url };
  const previous = previousFiles.get(path);
  if (!refresh && previous && previous.sha256 !== entry.sha256) throw new Error(`Extracted file changed: ${path}`);
  files.push(entry);
}
const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(new Date());
await Bun.write("sources.lock.json", JSON.stringify({ schema: 1, unicodeVersion, collectedOn: refresh ? today : old?.collectedOn ?? today, pinyinCommit, wanxiangCommit, yedictSnapshot, zitoolsSnapshot, files }, null, 2) + "\n");
console.log(`Verified ${cached} cached downloads; locked ${files.length} original files.`);

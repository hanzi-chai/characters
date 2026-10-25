import { mkdir } from "node:fs/promises";
import { downloadSource, refreshSelection } from "../src/download";
import { cachedWebSources, downloads, unicodeVersion, zdicDownload, zdicIndex } from "../src/sources";
import { extractZdic, zdicSyllables } from "../src/zdic";

// Reuse cached files unless --refresh requests a new download.
const configured = new Map(downloads.map((source) => [source.path, source]));
const args = process.argv.slice(2);
if (args.length && args[0] !== "--refresh") throw new Error("Usage: bun run download [--refresh [sources/path ...]]");
await downloadSource(zdicIndex, args[0] === "--refresh" && (args.length === 1 || args.includes(zdicIndex.path)));
for (const syllable of zdicSyllables(await Bun.file(zdicIndex.path).text())) {
  const source = zdicDownload(syllable);
  configured.set(source.path, source);
}
for await (const source of cachedWebSources()) configured.set(source.path, source);
const refreshPaths = refreshSelection(args, [...configured.values()]);
for (const source of configured.values()) {
  if (source.path === zdicIndex.path) continue;
  await downloadSource(source, refreshPaths.has(source.path));
  const syllable = source.path.match(/^sources\/zdic\/([a-z]+)\.html$/)?.[1];
  if (syllable && syllable !== "terms") extractZdic(await Bun.file(source.path).text(), syllable);
}

function run(command: string[]) {
  const result = Bun.spawnSync(command, { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
}
run(["unzip", "-oq", `sources/unicode-${unicodeVersion}/Unihan.zip`, "-d", `sources/unicode-${unicodeVersion}`]);
const cedict = "sources/cc-cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz";
await Bun.write("sources/cc-cedict/cedict_ts.u8", Bun.gunzipSync(new Uint8Array(await Bun.file(cedict).arrayBuffer())));
await mkdir("sources/cns11643/Properties", { recursive: true });
await mkdir("sources/cns11643/MapingTables", { recursive: true });
run([
  "unzip",
  "-oq",
  "sources/cns11643/Properties.zip",
  "CNS_phonetic.txt",
  "CNS_pinyin_1.txt",
  "CNS_pinyin_2.txt",
  "-d",
  "sources/cns11643/Properties",
]);
run(["unzip", "-oq", "sources/cns11643/MapingTables.zip", "Unicode/*", "-d", "sources/cns11643/MapingTables"]);

console.log("Downloaded and extracted source originals.");

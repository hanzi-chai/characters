import assert from "node:assert/strict";
import { sha256, verifySources } from "../src/integrity";
import { parseUnicodeData, cnsCodeFromTSource } from "../src/unicode";
import { toNumericReading, toCnsNumeric } from "../src/pinyin";
import { renderCoverage, withCoverage } from "../src/report";
import { extractYedict } from "../src/yedict";
import { extractZitools } from "../src/zitools";

await verifySources();
const manifest = await Bun.file("data/manifest.json").json();
assert.equal(manifest.sourceLockSha256, sha256(await Bun.file("sources.lock.json").text()), "Source lock changed since build");
for (const item of manifest.files) {
  const bytes = new Uint8Array(await Bun.file(item.path).arrayBuffer());
  assert.equal(bytes.length, item.bytes, item.path);
  assert.equal(sha256(bytes), item.sha256, item.path);
}
// Independent oracle: Unihan + zero, then assigned codepoints in the eight
// requested ranges. Do not reuse the build's PropList or block configuration.
const expected = new Set<number>([0x3007]);
for (const name of ["DictionaryIndices", "DictionaryLikeData", "IRGSources", "NumericValues", "OtherMappings", "RadicalStrokeCounts", "Readings", "Variants"]) {
  for (const line of (await Bun.file(`sources/unicode-18.0.0/Unihan_${name}.txt`).text()).split("\n")) {
    const match = line.match(/^U\+([0-9A-F]+)\t/);
    if (match) expected.add(parseInt(match[1], 16));
  }
}
assert.equal(expected.size, 103000, "Unicode18 repertoire oracle changed");
const unicode = parseUnicodeData(await Bun.file("sources/unicode-18.0.0/UnicodeData.txt").text());
const requestedRanges = [
  [0x2e80, 0x2eff, "中日韩部首补充"], [0x2f00, 0x2fdf, "康熙部首"], [0x31c0, 0x31ef, "中日韩笔画"],
  [0xf900, 0xfaff, "中日韩兼容表意文字"], [0x2f800, 0x2fa1f, "中日韩兼容表意文字补充"], [0x3000, 0x303f, "中日韩符号和标点"],
  [0x3200, 0x32ff, "中日韩带圈字母和月份"], [0x1f200, 0x1f2ff, "中日韩带圈文字补充"],
] as const;
for (const cp of unicode.keys()) if (requestedRanges.some(([start, end]) => cp >= start && cp <= end)) expected.add(cp);
assert.equal(expected.size, 103750, "Unicode18 expanded repertoire changed");
const lines = (await Bun.file("data/pinyin.tsv").text()).replace(/\r?\n$/, "").split("\n");
assert.equal(lines.shift(), "codepoint\tchar\tpinyin\tdefault\tstatus\tblock\tsources");
const seen = new Set<number>();
const readingsByChar = new Map<string, string[]>();
const blocksByChar = new Map<string, string>();
let previous = -1, known = 0, missing = 0;
for (const line of lines) {
  const fields = line.split("\t");
  assert.equal(fields.length, 7, line);
  const [hex, char, value, first, status, block] = fields;
  const cp = parseInt(hex.slice(2), 16);
  assert(cp > previous && !seen.has(cp), `Not unique/sorted: ${hex}`);
  previous = cp; seen.add(cp);
  assert(expected.has(cp), `Unexpected character: ${hex}`);
  assert.equal([...char].length, 1, hex);
  assert.equal(char.codePointAt(0), cp, hex);
  assert(unicode.has(cp), `Unassigned: ${hex}`);
  assert(/^[\u4e00-\u9fff]+(?: [A-J])?$/.test(block), `Non-Chinese block name: ${hex}: ${block}`);
  const requestedBlock = requestedRanges.find(([start, end]) => cp >= start && cp <= end);
  if (requestedBlock) assert.equal(block, requestedBlock[2], hex);
  const readings = value.split(",");
  assert.equal(first, readings[0], hex);
  assert.equal(readings.length, new Set(readings).size, hex);
  for (const reading of readings) assert(/^(?:\?|[a-zê]+[1-5](?:-[a-zê]+[1-5])*)$/.test(reading), `${hex}: ${reading}`);
  if (status === "missing") { assert.equal(value, "?"); missing++; }
  else { assert(["direct", "unicode-decomposition"].includes(status)); assert(!readings.includes("?")); known++; }
  readingsByChar.set(char, readings);
  blocksByChar.set(char, block);
}
assert.deepEqual(seen, expected, "Missing Han codepoints");
assert(readingsByChar.get("张")!.includes("zhang1"));
assert(readingsByChar.get("行")!.includes("hang2") && readingsByChar.get("行")!.includes("xing2"));
assert(readingsByChar.get("女")!.includes("nv3") && readingsByChar.get("绿")!.includes("lv4"));
assert(readingsByChar.get("了")!.includes("le5"));
assert(readingsByChar.has(String.fromCodePoint(0x2b81e)));
assert(readingsByChar.has(String.fromCodePoint(0x33479)));
assert(!readingsByChar.has(String.fromCodePoint(0x3347a)), "Reserved extension J tail must not be included");
for (const cp of [0x2e80, 0x2f00, 0x31c0, 0xf900, 0x2f800, 0x3000, 0x3200, 0x1f200]) assert(readingsByChar.has(String.fromCodePoint(cp)), `Missing requested block: ${cp.toString(16)}`);
for (const cp of [0x2e9a, 0x2fd6, 0x321f, 0x1f203]) assert(!readingsByChar.has(String.fromCodePoint(cp)), `Reserved codepoint included: ${cp.toString(16)}`);
assert(readingsByChar.get("⼀")!.includes("yi1"));
assert(readingsByChar.get("㊤")!.includes("shang4"));

// Validate EVERY retained evidence pointer, including the three-way CNS join.
const cache = new Map<string, string[]>();
async function sourceLine(file: string, line: number): Promise<string> {
  if (!cache.has(file)) cache.set(file, (await Bun.file(file).text()).split(/\r?\n/));
  const text = cache.get(file)![line - 1];
  assert(text !== undefined, `Broken evidence pointer: ${file}:${line}`);
  return text;
}
let evidenceRecords = 0, cnsRecords = 0;
const evidenceText = await Bun.file("data/evidence.jsonl").text();
for (const line of evidenceText.trimEnd().split("\n")) {
  const row = JSON.parse(line);
  assert.deepEqual(row.pinyin, readingsByChar.get(row.char));
  assert.equal(row.default, row.pinyin[0]);
  assert.equal(row.block, blocksByChar.get(row.char));
  if (row.status === "unicode-decomposition") {
    const entry = unicode.get(row.char.codePointAt(0))!;
    assert.equal(parseInt(entry.decomposition.replace(/^<[^>]+>\s*/, ""), 16), parseInt(row.evidence[0].via.slice(2), 16));
  }
  for (const e of row.evidence) {
    const text = await sourceLine(e.file, e.line);
    if (e.source === "CNS11643:phonetic") {
      assert.deepEqual(text.trim().split("\t"), [e.cns, e.bopomofo]);
      const mapping = await sourceLine(e.unicodeMapping.file, e.unicodeMapping.line);
      const targetHex = e.via ?? row.codepoint;
      if (e.unicodeMapping.file.endsWith("Unihan_IRGSources.txt")) {
        const [hex, prop, value] = mapping.split("\t");
        assert.equal(hex, targetHex); assert.equal(prop, "kIRG_TSource");
        assert.equal(cnsCodeFromTSource(value), e.cns);
      } else {
        const [cns, hex] = mapping.trim().split("\t");
        assert.equal(cns, e.cns); assert.equal(parseInt(hex, 16), parseInt(targetHex.slice(2), 16));
      }
      const pinyin = (await sourceLine(e.pronunciationMapping.file, e.pronunciationMapping.line)).trim().split("\t");
      assert.equal(pinyin[0], e.bopomofo); assert.equal(pinyin[1], e.raw);
      assert.equal(toCnsNumeric(e.raw), e.pinyin);
      cnsRecords++;
    } else {
      assert.equal(toNumericReading(e.raw), e.pinyin);
      if (/^(yedict|zitools):explicit-pinyin$/.test(e.source)) {
        const entry = JSON.parse(text);
        const target = e.via ?? row.codepoint;
        const cp = parseInt(target.slice(2), 16);
        assert(typeof e.jsonPointer === "string" && e.jsonPointer.startsWith("/"), "Missing dictionary JSON pointer");
        let value = entry;
        for (const part of e.jsonPointer.slice(1).split("/")) value = value?.[part.replaceAll("~1", "/").replaceAll("~0", "~")];
        if (typeof value === "string") assert(value.includes(e.raw), `Reading absent at ${e.file}#${e.jsonPointer}`);
        else {
          assert.equal(`${value?.syl}${value?.ton}`, e.raw);
          assert.equal(value.zi, String.fromCodePoint(cp));
          assert(!value.path && !value.phos?.length, "Inherited reading is not direct evidence");
        }
        const extract = e.source.startsWith("yedict:") ? extractYedict : extractZitools;
        assert(extract(text, cp).readings.some(item => item.raw === e.raw && item.jsonPointer === e.jsonPointer), "Dictionary evidence fails character/language/reading checks");
      } else assert(text.includes(e.raw), `Raw reading not found: ${e.file}:${e.line}`);
    }
    assert(row.pinyin.includes(e.pinyin));
    evidenceRecords++;
  }
}
const coverage = await Bun.file("data/coverage.json").json();
assert.equal(coverage.total, expected.size); assert.equal(coverage.known, known); assert.equal(coverage.missing, missing);
assert.equal(coverage.byBlock.reduce((sum: number, b: any) => sum + b.total, 0), expected.size);
assert.deepEqual(coverage.includedBlocks.map((block: { name: string }) => block.name).sort(), requestedRanges.map(([, , name]) => name).sort());
for (const block of coverage.byBlock) {
  const chars = [...blocksByChar].filter(([, name]) => name === block.block).map(([char]) => char);
  assert(chars.length > 0, `Unknown coverage block: ${block.block}`);
  assert.equal(chars.length, block.total, block.block);
  assert(chars.every(char => {
    const cp = char.codePointAt(0)!;
    return cp >= parseInt(block.start.slice(2), 16) && cp <= parseInt(block.end.slice(2), 16);
  }), `Block range mismatch: ${block.block}`);
}
const readme = await Bun.file("README.md").text();
assert.equal(withCoverage(readme, renderCoverage(coverage)), readme, "README coverage is out of date");
assert(!await Bun.file("data/COVERAGE.md").exists(), "Coverage belongs in README");
assert(!await Bun.file("data/related-han-symbols.tsv").exists(), "Requested symbols belong in the main table");
for (const obsolete of [
  "pinyin.txt", "pinyin-default.txt", "pinyin.json", "missing.tsv",
  "source-disagreements.tsv", "supplement-only.tsv",
]) {
  assert(!await Bun.file(`data/${obsolete}`).exists(), `Obsolete output: ${obsolete}`);
  assert(!manifest.files.some((item: { path: string }) => item.path === `data/${obsolete}`), `Obsolete manifest entry: ${obsolete}`);
}
console.log(`Verified ${expected.size} characters; ${known} known, ${missing} missing (?); ${evidenceRecords} evidence pointers (${cnsRecords} CNS joins); all checksums match.`);

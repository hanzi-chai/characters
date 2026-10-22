import assert from "node:assert/strict";
import { sha256, verifySources } from "../src/integrity";
import { parseUnicodeData, cnsCodeFromTSource } from "../src/unicode";
import { toNumericReading, toCnsNumeric } from "../src/pinyin";

await verifySources();
const manifest = await Bun.file("data/manifest.json").json();
assert.equal(manifest.sourceLockSha256, sha256(await Bun.file("sources.lock.json").text()), "Source lock changed since build");
for (const item of manifest.files) {
  const bytes = new Uint8Array(await Bun.file(item.path).arrayBuffer());
  assert.equal(bytes.length, item.bytes, item.path);
  assert.equal(sha256(bytes), item.sha256, item.path);
}
// Independent coverage oracle: all codepoints actually present anywhere in
// Unihan, plus ideographic zero. Do not reuse the build's PropList enumeration.
const expected = new Set<number>([0x3007]);
for (const name of ["DictionaryIndices", "DictionaryLikeData", "IRGSources", "NumericValues", "OtherMappings", "RadicalStrokeCounts", "Readings", "Variants"]) {
  for (const line of (await Bun.file(`sources/unicode-18.0.0/Unihan_${name}.txt`).text()).split("\n")) {
    const match = line.match(/^U\+([0-9A-F]+)\t/);
    if (match) expected.add(parseInt(match[1], 16));
  }
}
assert.equal(expected.size, 103000, "Unicode18 repertoire oracle changed");
const unicode = parseUnicodeData(await Bun.file("sources/unicode-18.0.0/UnicodeData.txt").text());
const lines = (await Bun.file("data/pinyin.tsv").text()).replace(/\r?\n$/, "").split("\n");
assert.equal(lines.shift(), "codepoint\tchar\tpinyin\tdefault\tstatus\tblock\tsources");
const seen = new Set<number>();
let previous = -1, known = 0, missing = 0;
for (const line of lines) {
  const fields = line.split("\t");
  assert.equal(fields.length, 7, line);
  const [hex, char, value, first, status] = fields;
  const cp = parseInt(hex.slice(2), 16);
  assert(cp > previous && !seen.has(cp), `Not unique/sorted: ${hex}`);
  previous = cp; seen.add(cp);
  assert(expected.has(cp), `Unexpected character: ${hex}`);
  assert.equal([...char].length, 1, hex);
  assert.equal(char.codePointAt(0), cp, hex);
  assert(unicode.has(cp), `Unassigned: ${hex}`);
  const readings = value.split(",");
  assert.equal(first, readings[0], hex);
  assert.equal(readings.length, new Set(readings).size, hex);
  for (const reading of readings) assert(/^(?:xxx|[a-zê]+[1-5](?:-[a-zê]+[1-5])*)$/.test(reading), `${hex}: ${reading}`);
  if (status === "missing") { assert.equal(value, "xxx"); missing++; }
  else { assert(["direct", "unicode-decomposition"].includes(status)); assert(!readings.includes("xxx")); known++; }
}
assert.deepEqual(seen, expected, "Missing Han codepoints");
const json = await Bun.file("data/pinyin.json").json();
assert.equal(Object.keys(json).length, expected.size);
for (const line of lines) {
  const [, char, value] = line.split("\t");
  assert.equal(json[char].join(","), value);
}
assert(json["张"].includes("zhang1"));
assert(json["行"].includes("hang2") && json["行"].includes("xing2"));
assert(json["女"].includes("nv3") && json["绿"].includes("lv4"));
assert(json["了"].includes("le5"));
assert(json[String.fromCodePoint(0x2b81e)]);
assert(json[String.fromCodePoint(0x33479)]);
assert(!json[String.fromCodePoint(0x3347a)], "Reserved extension J tail must not be included");

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
  assert.equal(row.pinyin.join(","), json[row.char].join(","));
  if (row.status === "unicode-decomposition") {
    const entry = unicode.get(row.char.codePointAt(0))!;
    assert.equal(entry.decomposition, row.evidence[0].via.slice(2));
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
      assert(text.includes(e.raw), `Raw reading not found: ${e.file}:${e.line}`);
      assert.equal(toNumericReading(e.raw), e.pinyin);
    }
    assert(row.pinyin.includes(e.pinyin));
    evidenceRecords++;
  }
}
const coverage = await Bun.file("data/coverage.json").json();
assert.equal(coverage.total, expected.size); assert.equal(coverage.known, known); assert.equal(coverage.missing, missing);
assert.equal(coverage.byBlock.reduce((sum: number, b: any) => sum + b.total, 0), expected.size);
console.log(`Verified ${expected.size} characters; ${known} known, ${missing} xxx; ${evidenceRecords} evidence pointers (${cnsRecords} CNS joins); all checksums match.`);

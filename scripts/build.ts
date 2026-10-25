import { mkdir, rm } from "node:fs/promises";
import { codepoint } from "../src/pinyin";
import { parseBlocks, parseUnicodeData, propertySet, hanRepertoire, includedBlocks, blockLabel, singleHanDecomposition } from "../src/unicode";
import { loadReadings, type Evidence } from "../src/readings";
import { sha256, verifySources } from "../src/integrity";
import { unicodeVersion } from "../src/sources";
import { renderCoverage, withCoverage } from "../src/report";

const lock = await verifySources();
const prefix = `sources/unicode-${unicodeVersion}/`;
const unicode = parseUnicodeData(await Bun.file(prefix + "UnicodeData.txt").text());
const unified = propertySet(await Bun.file(prefix + "PropList.txt").text(), "Unified_Ideograph");
const blocks = parseBlocks(await Bun.file(prefix + "Blocks.txt").text());
for (const selected of includedBlocks) if (!blocks.some(block => block.name === selected.name)) throw new Error(`Missing Unicode block: ${selected.name}`);
const repertoire = hanRepertoire(unicode, unified, blocks);
const outputBlocks = blocks.filter(block => repertoire.some(cp => cp >= block.start && cp <= block.end))
  .map(block => ({ ...block, name: blockLabel(block.name) }));
const { evidence, rejected, corrections, mappingConflicts } = await loadReadings();

export interface Row {
  codepoint: string; char: string; pinyin: string[]; default: string;
  status: "direct" | "unicode-decomposition" | "missing"; block: string;
  evidence: Evidence[]; excludedByCorrection: Evidence[];
}
const memo = new Map<number, Row>();
function rowFor(cp: number, visiting = new Set<number>()): Row {
  if (memo.has(cp)) return memo.get(cp)!;
  if (visiting.has(cp)) throw new Error(`Decomposition cycle at ${codepoint(cp)}`);
  visiting.add(cp);
  const allEvidence = evidence.get(cp) ?? [];
  const correction = corrections.get(cp);
  let selected = allEvidence.filter(e => !correction || correction.has(e.pinyin));
  const excludedByCorrection = allEvidence.filter(e => correction && !correction.has(e.pinyin));
  let status: Row["status"] = selected.length ? "direct" : "missing";
  // Accept only an explicit Unicode decomposition into one unified Han
  // character, including radical and enclosure formatting decompositions.
  const entry = unicode.get(cp)!;
  const mappedCp = singleHanDecomposition(entry, unified);
  if (!selected.length && mappedCp !== undefined) {
    if (unicode.has(mappedCp)) {
      const mapped = rowFor(mappedCp, new Set(visiting));
      if (mapped.status !== "missing") {
        selected = mapped.evidence.map(e => ({ ...e, via: codepoint(mappedCp) }));
        status = "unicode-decomposition";
      }
    }
  }
  const pinyin = [...new Set(selected.map(e => e.pinyin))];
  const block = outputBlocks.find(b => cp >= b.start && cp <= b.end);
  if (!block) throw new Error(`Missing Unicode block for ${codepoint(cp)}`);
  const row: Row = {
    codepoint: codepoint(cp), char: String.fromCodePoint(cp), pinyin: pinyin.length ? pinyin : ["?"],
    default: pinyin[0] ?? "?", status,
    block: block.name,
    evidence: selected, excludedByCorrection,
  };
  memo.set(cp, row);
  return row;
}
const rows = repertoire.map(cp => rowFor(cp));
await mkdir("data", { recursive: true });
function tsv(data: Row[]): string {
  return "codepoint\tchar\tpinyin\tdefault\tstatus\tblock\tsources\n" + data.map(row => [
    row.codepoint, row.char, row.pinyin.join(","), row.default, row.status, row.block,
    [...new Set(row.evidence.map(e => e.via ? `UnicodeData:${row.codepoint}->${e.via};${e.source}` : e.source))].join("|"),
  ].join("\t")).join("\n") + "\n";
}
const missing = rows.filter(row => row.status === "missing").length;
const supplementOnly = rows.filter(row => row.evidence.some(e => /^(pinyin-data:(zdic|cc_cedict)|wanxiang:|yedict:|zitools:)/.test(e.source)) && !row.evidence.some(e => e.source === "pinyin-data:pinyin" || e.source.startsWith("Unihan18:") || e.source.startsWith("CNS11643:"))).length;
const sourceDisagreements = rows.filter(row => {
  const sets = new Map<string, Set<string>>();
  for (const e of row.evidence) {
    if (e.source.startsWith("pinyin-data:") && !["pinyin-data:pinyin", "pinyin-data:zdic", "pinyin-data:cc_cedict"].includes(e.source)) continue;
    if (!sets.has(e.source)) sets.set(e.source, new Set());
    sets.get(e.source)!.add(e.pinyin);
  }
  return new Set([...sets.values()].map(s => [...s].sort().join(","))).size > 1;
}).length;
const byBlock = outputBlocks.flatMap(block => {
  const chars = rows.filter(row => row.block === block.name);
  return chars.length ? [{ block: block.name, start: codepoint(block.start), end: codepoint(block.end),
    total: chars.length, known: chars.filter(row => row.status !== "missing").length,
    missing: chars.filter(row => row.status === "missing").length,
    coverage: Number((100 * chars.filter(row => row.status !== "missing").length / chars.length).toFixed(4)) }] : [];
});
const bySource = [...new Set(rows.flatMap(row => row.evidence.map(e => e.source)))].sort().map(source => ({
  source, characters: rows.filter(row => row.evidence.some(e => e.source === source)).length,
  readings: rows.reduce((sum, row) => sum + new Set(row.evidence.filter(e => e.source === source).map(e => e.pinyin)).size, 0),
}));
const outputs: Record<string, string> = {
  "data/pinyin.tsv": tsv(rows),
  "data/evidence.jsonl": rows.map(row => JSON.stringify(row)).join("\n") + "\n",
  "data/rejected-readings.jsonl": rejected.map(row => JSON.stringify(row)).join("\n") + "\n",
  "data/cns-mapping-conflicts.json": JSON.stringify(mappingConflicts, null, 2) + "\n",
};
const summary = {
  schema: 3, unicodeVersion, sourceDate: lock.collectedOn,
  scope: "Unified_Ideograph + U+3007 + assigned characters in the eight included CJK blocks (deduplicated)",
  includedBlocks: includedBlocks.map(({ label }) => ({ name: label })),
  total: rows.length, known: rows.length - missing, missing,
  coveragePercent: Number((100 * (rows.length - missing) / rows.length).toFixed(4)),
  direct: rows.filter(row => row.status === "direct").length,
  inheritedViaUnicodeDecomposition: rows.filter(row => row.status === "unicode-decomposition").length,
  polyphonic: rows.filter(row => row.pinyin.length > 1).length,
  supplementOnly, sourceDisagreements,
  rejectedReadings: rejected.length,
  cnsMappingConflicts: mappingConflicts.length,
  excludedByExplicitCorrection: rows.reduce((sum, row) => sum + row.excludedByCorrection.length, 0),
  unifiedIdeographPropertyCount: unified.size,
  compatibilityIdeographNameCount: [...unicode.values()].filter(e => e.name.startsWith("CJK COMPATIBILITY IDEOGRAPH-")).length,
  byBlock, bySource,
};
outputs["data/coverage.json"] = JSON.stringify(summary, null, 2) + "\n";
for (const [path, text] of Object.entries(outputs)) await Bun.write(path, text);
await Bun.write("README.md", withCoverage(await Bun.file("README.md").text(), renderCoverage(summary)));
for (const obsolete of [
  "data/COVERAGE.md", "data/related-han-symbols.tsv",
  "data/pinyin.txt", "data/pinyin-default.txt", "data/pinyin.json", "data/missing.tsv",
  "data/source-disagreements.tsv", "data/supplement-only.tsv",
]) await rm(obsolete, { force: true });
const checksums = Object.entries(outputs).map(([path, text]) => ({ path, bytes: Buffer.byteLength(text), sha256: sha256(text) }));
await Bun.write("data/manifest.json", JSON.stringify({ schema: 1, unicodeVersion, sourceLockSha256: sha256(await Bun.file("sources.lock.json").text()), files: checksums }, null, 2) + "\n");
console.log(JSON.stringify({ total: summary.total, known: summary.known, missing: summary.missing, coveragePercent: summary.coveragePercent, inherited: summary.inheritedViaUnicodeDecomposition, rejected: summary.rejectedReadings }, null, 2));

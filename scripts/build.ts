import { mkdir } from "node:fs/promises";
import { codepoint } from "../src/pinyin";
import { parseBlocks, parseUnicodeData, propertySet, hanRepertoire } from "../src/unicode";
import { loadReadings, type Evidence } from "../src/readings";
import { sha256, verifySources } from "../src/integrity";
import { unicodeVersion } from "../src/sources";

const lock = await verifySources();
const prefix = `sources/unicode-${unicodeVersion}/`;
const unicode = parseUnicodeData(await Bun.file(prefix + "UnicodeData.txt").text());
const unified = propertySet(await Bun.file(prefix + "PropList.txt").text(), "Unified_Ideograph");
const han = propertySet(await Bun.file(prefix + "Scripts.txt").text(), "Han");
const blocks = parseBlocks(await Bun.file(prefix + "Blocks.txt").text());
const repertoire = hanRepertoire(unicode, unified);
const target = new Set(repertoire);
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
  // Only the explicit, single-character UnicodeData decomposition for CJK
  // compatibility ideographs is used. No semantic, simplified or visual guesses.
  const entry = unicode.get(cp)!;
  if (!selected.length && entry.name.startsWith("CJK COMPATIBILITY IDEOGRAPH-") && /^[0-9A-F]{4,6}$/.test(entry.decomposition)) {
    const mappedCp = parseInt(entry.decomposition, 16);
    if (unicode.has(mappedCp)) {
      const mapped = rowFor(mappedCp, new Set(visiting));
      if (mapped.status !== "missing") {
        selected = mapped.evidence.map(e => ({ ...e, via: codepoint(mappedCp) }));
        status = "unicode-decomposition";
      }
    }
  }
  const pinyin = [...new Set(selected.map(e => e.pinyin))];
  const row: Row = {
    codepoint: codepoint(cp), char: String.fromCodePoint(cp), pinyin: pinyin.length ? pinyin : ["xxx"],
    default: pinyin[0] ?? "xxx", status,
    block: blocks.find(b => cp >= b.start && cp <= b.end)?.name ?? "No_Block",
    evidence: selected, excludedByCorrection,
  };
  memo.set(cp, row);
  return row;
}
const rows = repertoire.map(cp => rowFor(cp));
// Related Han symbols and strokes are listed separately to make the scope explicit.
const strokes = blocks.filter(b => b.name === "CJK Strokes");
const related = [...new Set([...han, ...[...unicode.keys()].filter(cp => strokes.some(b => cp >= b.start && cp <= b.end))])]
  .filter(cp => !target.has(cp) && unicode.has(cp)).sort((a, b) => a - b).map(cp => rowFor(cp));
await mkdir("data", { recursive: true });
function tsv(data: Row[]): string {
  return "codepoint\tchar\tpinyin\tdefault\tstatus\tblock\tsources\n" + data.map(row => [
    row.codepoint, row.char, row.pinyin.join(","), row.default, row.status, row.block,
    [...new Set(row.evidence.map(e => e.via ? `UnicodeData:${row.codepoint}->${e.via};${e.source}` : e.source))].join("|"),
  ].join("\t")).join("\n") + "\n";
}
const unknown = rows.filter(row => row.status === "missing");
const supplemental = rows.filter(row => row.evidence.some(e => /^(pinyin-data:(zdic|cc_cedict)|wanxiang:)/.test(e.source)) && !row.evidence.some(e => e.source === "pinyin-data:pinyin" || e.source.startsWith("Unihan18:") || e.source.startsWith("CNS11643:")));
const disagreements = rows.filter(row => {
  const sets = new Map<string, Set<string>>();
  for (const e of row.evidence) {
    if (e.source.startsWith("pinyin-data:") && !["pinyin-data:pinyin", "pinyin-data:zdic", "pinyin-data:cc_cedict"].includes(e.source)) continue;
    if (!sets.has(e.source)) sets.set(e.source, new Set());
    sets.get(e.source)!.add(e.pinyin);
  }
  return new Set([...sets.values()].map(s => [...s].sort().join(","))).size > 1;
});
const byBlock = blocks.flatMap(block => {
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
  "data/pinyin.txt": rows.map(row => `${row.char}\t${row.pinyin.join(",")}`).join("\n") + "\n",
  "data/pinyin-default.txt": rows.map(row => `${row.char}\t${row.default}`).join("\n") + "\n",
  "data/pinyin.json": JSON.stringify(Object.fromEntries(rows.map(row => [row.char, row.pinyin])), null, 2) + "\n",
  "data/evidence.jsonl": rows.map(row => JSON.stringify(row)).join("\n") + "\n",
  "data/missing.tsv": tsv(unknown),
  "data/related-han-symbols.tsv": tsv(related),
  "data/supplement-only.tsv": tsv(supplemental),
  "data/source-disagreements.tsv": tsv(disagreements),
  "data/rejected-readings.jsonl": rejected.map(row => JSON.stringify(row)).join("\n") + "\n",
  "data/cns-mapping-conflicts.json": JSON.stringify(mappingConflicts, null, 2) + "\n",
};
const summary = {
  schema: 1, unicodeVersion, sourceDate: lock.collectedOn,
  scope: "Unified_Ideograph + assigned CJK COMPATIBILITY IDEOGRAPH-* + U+3007 (deduplicated)",
  total: rows.length, known: rows.length - unknown.length, missing: unknown.length,
  coveragePercent: Number((100 * (rows.length - unknown.length) / rows.length).toFixed(4)),
  direct: rows.filter(row => row.status === "direct").length,
  inheritedViaUnicodeDecomposition: rows.filter(row => row.status === "unicode-decomposition").length,
  polyphonic: rows.filter(row => row.pinyin.length > 1).length,
  relatedHanSymbols: related.length,
  supplementOnly: supplemental.length,
  sourceDisagreements: disagreements.length,
  rejectedReadings: rejected.length,
  cnsMappingConflicts: mappingConflicts.length,
  excludedByExplicitCorrection: rows.reduce((sum, row) => sum + row.excludedByCorrection.length, 0),
  unifiedIdeographPropertyCount: unified.size,
  compatibilityIdeographNameCount: [...unicode.values()].filter(e => e.name.startsWith("CJK COMPATIBILITY IDEOGRAPH-")).length,
  byBlock, bySource,
};
outputs["data/coverage.json"] = JSON.stringify(summary, null, 2) + "\n";
outputs["data/COVERAGE.md"] = `# Unicode ${unicodeVersion} 汉字拼音覆盖率\n\n` +
  `字符总数 **${summary.total}**；有读音 **${summary.known}**（${summary.coveragePercent}%）；未查到 **${summary.missing}**，记作 \`xxx\`。\n\n` +
  `直接来源 ${summary.direct} 字；Unicode 兼容映射补音 ${summary.inheritedViaUnicodeDecomposition} 字；多读音 ${summary.polyphonic} 字；仅补充来源收录 ${summary.supplementOnly} 字。\n\n` +
  "| 区块 | 字数 | 有读音 | xxx | 读音覆盖率 |\n|---|---:|---:|---:|---:|\n" +
  byBlock.map(b => `| ${b.block} | ${b.total} | ${b.known} | ${b.missing} | ${b.coverage}% |`).join("\n") + "\n\n" +
  "## 来源收录量\n\n同一汉字可以被多个来源收录，不能将下列数字相加。统计包含兼容映射后的归属，因此可能高于原始文件行数。\n\n| 来源 | 汉字数 | 不同字音对 |\n|---|---:|---:|\n" +
  bySource.map(s => `| ${s.source} | ${s.characters} | ${s.readings} |`).join("\n") + "\n\n" +
  `未接受的原始读音记录 ${summary.rejectedReadings} 条，见 \`rejected-readings.jsonl\`；包含已由另一官方表成功回退的异常数字拼音。同字不一定缺音。\n\n` +
  `来源间读音集合不同的 ${summary.sourceDisagreements} 字见 \`source-disagreements.tsv\`；集合不同可能只是收录详略、古今或地区差异。全字库与 Unihan 的 ${summary.cnsMappingConflicts} 处既有码点映射差异见 \`cns-mapping-conflicts.json\`；不自动覆盖这些已分配码点的全字库映射。\n`;
for (const [path, text] of Object.entries(outputs)) await Bun.write(path, text);
const checksums = Object.entries(outputs).map(([path, text]) => ({ path, bytes: Buffer.byteLength(text), sha256: sha256(text) }));
await Bun.write("data/manifest.json", JSON.stringify({ schema: 1, unicodeVersion, sourceLockSha256: sha256(await Bun.file("sources.lock.json").text()), files: checksums }, null, 2) + "\n");
console.log(JSON.stringify({ total: summary.total, known: summary.known, missing: summary.missing, coveragePercent: summary.coveragePercent, inherited: summary.inheritedViaUnicodeDecomposition, rejected: summary.rejectedReadings }, null, 2));

import { mkdir } from "node:fs/promises";
import { codepoint } from "../src/pinyin";
import { type Evidence, loadReadings } from "../src/readings";
import { renderCoverage, withCoverage } from "../src/report";
import { unicodeVersion } from "../src/sources";
import {
  blockLabels,
  hanRepertoire,
  includedBlocks,
  parseBlocks,
  parseUnicodeData,
  propertySet,
  singleHanDecomposition,
} from "../src/unicode";

const prefix = `sources/unicode-${unicodeVersion}/`;
const unicode = parseUnicodeData(await Bun.file(`${prefix}UnicodeData.txt`).text());
const unified = propertySet(await Bun.file(`${prefix}PropList.txt`).text(), "Unified_Ideograph");
const blocks = parseBlocks(await Bun.file(`${prefix}Blocks.txt`).text());
const repertoire = hanRepertoire(unicode, blocks);
const outputBlocks = blocks
  .filter((block) => repertoire.some((cp) => cp >= block.start && cp <= block.end))
  .map((block) => {
    const name = blockLabels.get(block.name);
    if (!name) throw new Error(`Missing Chinese block name: ${block.name}`);
    return { ...block, name };
  });
const evidence = await loadReadings();

interface Row {
  codepoint: string;
  char: string;
  pinyin: string[];
  status: "direct" | "unicode-decomposition" | "missing";
  block: string;
  evidence: Evidence[];
}
const memo = new Map<number, Row>();
function rowFor(cp: number, visiting = new Set<number>()): Row {
  if (memo.has(cp)) return memo.get(cp)!;
  if (visiting.has(cp)) throw new Error(`Decomposition cycle at ${codepoint(cp)}`);
  visiting.add(cp);
  let selected = evidence.get(cp) ?? [];
  let status: Row["status"] = selected.length ? "direct" : "missing";
  // Accept only an explicit Unicode decomposition into one unified Han
  // character, including radical and enclosure formatting decompositions.
  const entry = unicode.get(cp)!;
  const mappedCp = singleHanDecomposition(entry, unified);
  if (!selected.length && mappedCp !== undefined && unicode.has(mappedCp)) {
    const mapped = rowFor(mappedCp, new Set(visiting));
    if (mapped.status !== "missing") {
      selected = mapped.evidence.map((e) => ({
        ...e,
        via: codepoint(mappedCp),
      }));
      status = "unicode-decomposition";
    }
  }
  const pinyin = [...new Set(selected.map((e) => e.pinyin))];
  const block = outputBlocks.find((b) => cp >= b.start && cp <= b.end);
  if (!block) throw new Error(`Missing Unicode block for ${codepoint(cp)}`);
  const row: Row = {
    codepoint: codepoint(cp),
    char: String.fromCodePoint(cp),
    pinyin: pinyin.length ? pinyin : ["?"],
    status,
    block: block.name,
    evidence: selected,
  };
  memo.set(cp, row);
  return row;
}
const rows = repertoire.map((cp) => rowFor(cp));
await mkdir("data", { recursive: true });
function tsv(data: Row[]): string {
  return (
    "codepoint\tchar\tpinyin\tstatus\tblock\tsources\n" +
    data
      .map((row) =>
        [
          row.codepoint,
          row.char,
          row.pinyin.join(","),
          row.status,
          row.block,
          [
            ...new Set(
              row.evidence.map((e) => (e.via ? `UnicodeData:${row.codepoint}->${e.via};${e.source}` : e.source)),
            ),
          ].join("|"),
        ].join("\t"),
      )
      .join("\n") +
    "\n"
  );
}
const missing = rows.filter((row) => row.status === "missing").length;
const supplementOnly = rows.filter(
  (row) =>
    row.evidence.some((e) => /^(zdic:|CC-CEDICT:|MOE:|yedict:|zitools:)/.test(e.source)) &&
    !row.evidence.some((e) => e.source.startsWith("Unihan18:") || e.source.startsWith("CNS11643:")),
).length;
const assigned = [...unicode.keys()];
const byBlock = outputBlocks.map((block) => {
  const chars = rows.filter((row) => row.block === block.name);
  const missing = chars.filter((row) => row.status === "missing").length;
  const known = chars.length - missing;
  return {
    block: block.name,
    start: codepoint(block.start),
    end: codepoint(block.end),
    total: assigned.filter((cp) => cp >= block.start && cp <= block.end).length,
    expected: chars.length,
    known,
    missing,
    coverage: Number(((100 * known) / chars.length).toFixed(4)),
  };
});
const bySource = [...new Set(rows.flatMap((row) => row.evidence.map((e) => e.source)))].sort().map((source) => ({
  source,
  characters: rows.filter((row) => row.evidence.some((e) => e.source === source)).length,
  readings: rows.reduce(
    (sum, row) => sum + new Set(row.evidence.filter((e) => e.source === source).map((e) => e.pinyin)).size,
    0,
  ),
}));
const outputs: Record<string, string> = {
  "data/pinyin.tsv": tsv(rows),
  "data/evidence.jsonl": `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`,
};
const summary = {
  schema: 4,
  unicodeVersion,
  sourceDate: new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
  }).format(new Date()),
  scope:
    "Assigned characters in CJK unified ideograph blocks and full included blocks + explicit codepoints in partial included blocks (deduplicated)",
  includedBlocks: includedBlocks.map((block) => ({
    name: block.label,
    mode: block.mode,
    ...(block.mode === "partial" ? { codepoints: block.codepoints.map(codepoint) } : {}),
  })),
  total: rows.length,
  known: rows.length - missing,
  missing,
  coveragePercent: Number(((100 * (rows.length - missing)) / rows.length).toFixed(4)),
  direct: rows.filter((row) => row.status === "direct").length,
  inheritedViaUnicodeDecomposition: rows.filter((row) => row.status === "unicode-decomposition").length,
  polyphonic: rows.filter((row) => row.pinyin.length > 1).length,
  supplementOnly,
  unifiedIdeographPropertyCount: unified.size,
  compatibilityIdeographNameCount: [...unicode.values()].filter((e) =>
    e.name.startsWith("CJK COMPATIBILITY IDEOGRAPH-"),
  ).length,
  byBlock,
  bySource,
};
outputs["data/coverage.json"] = `${JSON.stringify(summary, null, 2)}\n`;
for (const [path, text] of Object.entries(outputs)) await Bun.write(path, text);
await Bun.write("README.md", withCoverage(await Bun.file("README.md").text(), renderCoverage(summary)));
console.log(
  JSON.stringify(
    {
      total: summary.total,
      known: summary.known,
      missing: summary.missing,
      coveragePercent: summary.coveragePercent,
      inherited: summary.inheritedViaUnicodeDecomposition,
    },
    null,
    2,
  ),
);

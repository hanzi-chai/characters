import { parseRange } from "./pinyin";

export interface UnicodeChar { cp: number; name: string; category: string; decomposition: string }
export interface Block { start: number; end: number; name: string }

export const includedBlocks = [
  { name: "CJK Radicals Supplement", label: "中日韩部首补充" },
  { name: "Kangxi Radicals", label: "康熙部首" },
  { name: "CJK Strokes", label: "中日韩笔画" },
  { name: "CJK Compatibility Ideographs", label: "中日韩兼容表意文字" },
  { name: "CJK Compatibility Ideographs Supplement", label: "中日韩兼容表意文字补充" },
  { name: "CJK Symbols and Punctuation", label: "中日韩符号和标点" },
  { name: "Enclosed CJK Letters and Months", label: "中日韩带圈字母和月份" },
  { name: "Enclosed Ideographic Supplement", label: "中日韩带圈文字补充" },
] as const;

export function singleHanDecomposition(entry: UnicodeChar, unified: Set<number>): number | undefined {
  const value = entry.decomposition.replace(/^<[^>]+>\s*/, "");
  if (!/^[0-9A-F]{4,6}$/.test(value)) return undefined;
  const cp = parseInt(value, 16);
  return unified.has(cp) ? cp : undefined;
}

export function cnsCodeFromTSource(value: string): string | undefined {
  const match = value.match(/^T([0-9A-F]+)-([0-9A-F]{4})$/);
  return match ? `${parseInt(match[1], 16)}-${match[2]}` : undefined;
}

export function propertySet(text: string, property: string): Set<number> {
  const result = new Set<number>();
  for (const line of text.split(/\r?\n/)) {
    const [range, prop] = line.split("#")[0].split(";").map(x => x.trim());
    if (prop !== property) continue;
    const [start, end] = parseRange(range);
    for (let cp = start; cp <= end; cp++) result.add(cp);
  }
  return result;
}

export function parseUnicodeData(text: string): Map<number, UnicodeChar> {
  const result = new Map<number, UnicodeChar>();
  let first: UnicodeChar | undefined;
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const [hex, name, category, , , decomposition] = line.split(";");
    const entry = { cp: parseInt(hex, 16), name, category, decomposition };
    if (name.endsWith(", First>")) { first = entry; continue; }
    if (name.endsWith(", Last>")) {
      if (!first) throw new Error(`Range without First: ${name}`);
      for (let cp = first.cp; cp <= entry.cp; cp++) result.set(cp, { ...first, cp, name: first.name.replace(", First>", ">") });
      first = undefined;
    } else result.set(entry.cp, entry);
  }
  if (first) throw new Error("Unclosed UnicodeData range");
  return result;
}

export function parseBlocks(text: string): Block[] {
  return text.split(/\r?\n/).flatMap(line => {
    const [range, name] = line.split("#")[0].split(";").map(x => x.trim());
    if (!name) return [];
    const [start, end] = parseRange(range);
    return [{ start, end, name }];
  });
}

export function hanRepertoire(unicode: Map<number, UnicodeChar>, unified: Set<number>, blocks: Block[] = []): number[] {
  const result = new Set(unified);
  const selected = blocks.filter(block => includedBlocks.some(item => item.name === block.name));
  for (const [cp, entry] of unicode) {
    if (entry.name.startsWith("CJK COMPATIBILITY IDEOGRAPH-") || selected.some(block => cp >= block.start && cp <= block.end)) result.add(cp);
  }
  result.add(0x3007);
  for (const cp of result) if (!unicode.has(cp)) throw new Error(`Unassigned target: ${cp.toString(16)}`);
  return [...result].sort((a, b) => a - b);
}

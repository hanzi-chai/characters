import { parseRange } from "./pinyin";

export interface UnicodeChar {
  cp: number;
  name: string;
  decomposition: string;
}
export interface Block {
  start: number;
  end: number;
  name: string;
}

type IncludedBlock = { name: string; label: string } & (
  | { mode: "all" }
  | { mode: "partial"; codepoints: readonly number[] }
);

export const includedBlocks: readonly IncludedBlock[] = [
  { name: "CJK Radicals Supplement", label: "中日韩部首补充", mode: "all" },
  { name: "Kangxi Radicals", label: "康熙部首", mode: "all" },
  { name: "CJK Strokes", label: "中日韩笔画", mode: "all" },
  { name: "CJK Compatibility Ideographs", label: "中日韩兼容表意文字", mode: "all" },
  { name: "CJK Compatibility Ideographs Supplement", label: "中日韩兼容表意文字补充", mode: "all" },
  {
    name: "CJK Symbols and Punctuation",
    label: "中日韩符号和标点",
    mode: "partial",
    // 〇与苏州码子；标点、声调标记、依上下文读出的重文符号不在目标内。
    codepoints: [
      0x3007, 0x3021, 0x3022, 0x3023, 0x3024, 0x3025, 0x3026, 0x3027, 0x3028, 0x3029, 0x3038, 0x3039, 0x303a,
    ],
  },
  {
    name: "Enclosed CJK Letters and Months",
    label: "中日韩带圈字母和月份",
    mode: "partial",
    codepoints: [
      // 括号及带圈汉字；不包括阿拉伯数字、韩文、假名和拉丁字母符号。
      0x3220, 0x3221, 0x3222, 0x3223, 0x3224, 0x3225, 0x3226, 0x3227, 0x3228, 0x3229, 0x322a, 0x322b, 0x322c, 0x322d,
      0x322e, 0x322f, 0x3230, 0x3231, 0x3232, 0x3233, 0x3234, 0x3235, 0x3236, 0x3237, 0x3238, 0x3239, 0x323a, 0x323b,
      0x323c, 0x323d, 0x323e, 0x323f, 0x3240, 0x3241, 0x3242, 0x3243, 0x3244, 0x3245, 0x3246, 0x3247, 0x3280, 0x3281,
      0x3282, 0x3283, 0x3284, 0x3285, 0x3286, 0x3287, 0x3288, 0x3289, 0x328a, 0x328b, 0x328c, 0x328d, 0x328e, 0x328f,
      0x3290, 0x3291, 0x3292, 0x3293, 0x3294, 0x3295, 0x3296, 0x3297, 0x3298, 0x3299, 0x329a, 0x329b, 0x329c, 0x329d,
      0x329e, 0x329f, 0x32a0, 0x32a1, 0x32a2, 0x32a3, 0x32a4, 0x32a5, 0x32a6, 0x32a7, 0x32a8, 0x32a9, 0x32aa, 0x32ab,
      0x32ac, 0x32ad, 0x32ae, 0x32af, 0x32b0,
      // 一月至十二月及「令和」；多字形式仍需直接读音，不按多字分解补音。
      0x32c0, 0x32c1, 0x32c2, 0x32c3, 0x32c4, 0x32c5, 0x32c6, 0x32c7, 0x32c8, 0x32c9, 0x32ca, 0x32cb, 0x32ff,
    ],
  },
  {
    name: "Enclosed Ideographic Supplement",
    label: "中日韩带圈文字补充",
    mode: "partial",
    codepoints: [
      // 方框、括号及带圈汉字；跳过 U+1F213 假名 DE。
      0x1f210, 0x1f211, 0x1f212, 0x1f214, 0x1f215, 0x1f216, 0x1f217, 0x1f218, 0x1f219, 0x1f21a, 0x1f21b, 0x1f21c,
      0x1f21d, 0x1f21e, 0x1f21f, 0x1f220, 0x1f221, 0x1f222, 0x1f223, 0x1f224, 0x1f225, 0x1f226, 0x1f227, 0x1f228,
      0x1f229, 0x1f22a, 0x1f22b, 0x1f22c, 0x1f22d, 0x1f22e, 0x1f22f, 0x1f230, 0x1f231, 0x1f232, 0x1f233, 0x1f234,
      0x1f235, 0x1f236, 0x1f237, 0x1f238, 0x1f239, 0x1f23a, 0x1f23b, 0x1f240, 0x1f241, 0x1f242, 0x1f243, 0x1f244,
      0x1f245, 0x1f246, 0x1f247, 0x1f248, 0x1f250, 0x1f251,
      // 福、禄、寿、喜、双喜、财。
      0x1f260, 0x1f261, 0x1f262, 0x1f263, 0x1f264, 0x1f265,
    ],
  },
];

export const blockLabels: ReadonlyMap<string, string> = new Map([
  ...includedBlocks.map(({ name, label }) => [name, label] as const),
  ["CJK Unified Ideographs", "中日韩统一表意文字"],
  ["CJK Unified Ideographs Extension A", "中日韩统一表意文字扩展 A"],
  ["CJK Unified Ideographs Extension B", "中日韩统一表意文字扩展 B"],
  ["CJK Unified Ideographs Extension C", "中日韩统一表意文字扩展 C"],
  ["CJK Unified Ideographs Extension D", "中日韩统一表意文字扩展 D"],
  ["CJK Unified Ideographs Extension E", "中日韩统一表意文字扩展 E"],
  ["CJK Unified Ideographs Extension F", "中日韩统一表意文字扩展 F"],
  ["CJK Unified Ideographs Extension G", "中日韩统一表意文字扩展 G"],
  ["CJK Unified Ideographs Extension H", "中日韩统一表意文字扩展 H"],
  ["CJK Unified Ideographs Extension I", "中日韩统一表意文字扩展 I"],
  ["CJK Unified Ideographs Extension J", "中日韩统一表意文字扩展 J"],
]);

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
    const [range, prop] = line
      .split("#")[0]
      .split(";")
      .map((x) => x.trim());
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
    const [hex, name, , , , decomposition] = line.split(";");
    const entry = { cp: parseInt(hex, 16), name, decomposition };
    if (name.endsWith(", First>")) {
      first = entry;
      continue;
    }
    if (name.endsWith(", Last>")) {
      if (!first) throw new Error(`Range without First: ${name}`);
      for (let cp = first.cp; cp <= entry.cp; cp++)
        result.set(cp, { ...first, cp, name: first.name.replace(", First>", ">") });
      first = undefined;
    } else result.set(entry.cp, entry);
  }
  if (first) throw new Error("Unclosed UnicodeData range");
  return result;
}

export function parseBlocks(text: string): Block[] {
  return text.split(/\r?\n/).flatMap((line) => {
    const [range, name] = line
      .split("#")[0]
      .split(";")
      .map((x) => x.trim());
    if (!name) return [];
    const [start, end] = parseRange(range);
    return [{ start, end, name }];
  });
}

export function hanRepertoire(unicode: Map<number, UnicodeChar>, blocks: Block[]): number[] {
  const result = new Set<number>();
  for (const selected of includedBlocks) {
    const block = blocks.find((block) => block.name === selected.name);
    if (!block) throw new Error(`Missing Unicode block: ${selected.name}`);
    if (selected.mode !== "partial") continue;
    for (const cp of selected.codepoints) {
      if (cp < block.start || cp > block.end) throw new Error(`Target outside ${block.name}: ${cp.toString(16)}`);
      result.add(cp);
    }
  }
  const fullBlocks = blocks.filter(
    (block) =>
      /^CJK Unified Ideographs(?: Extension [A-Z])?$/.test(block.name) ||
      includedBlocks.some((selected) => selected.name === block.name && selected.mode === "all"),
  );
  for (const cp of unicode.keys()) if (fullBlocks.some((block) => cp >= block.start && cp <= block.end)) result.add(cp);
  for (const cp of result) if (!unicode.has(cp)) throw new Error(`Unassigned target: ${cp.toString(16)}`);
  return [...result].sort((a, b) => a - b);
}

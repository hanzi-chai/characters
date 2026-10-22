import { toNumericReading, toCnsNumeric, codepoint } from "./pinyin";
import { cnsCodeFromTSource } from "./unicode";

export interface Evidence {
  source: string; file: string; line: number; raw: string; pinyin: string; via?: string;
  cns?: string; bopomofo?: string;
  unicodeMapping?: { file: string; line: number };
  pronunciationMapping?: { file: string; line: number };
}
export interface Rejected { codepoint: string; source: string; file: string; line: number; raw: string; reason: string }
export interface MappingConflict { cns: string; official: string[]; unihan: string; file: string; line: number }
export interface Readings { evidence: Map<number, Evidence[]>; rejected: Rejected[]; corrections: Map<number, Set<string>>; mappingConflicts: MappingConflict[] }

export async function loadReadings(): Promise<Readings> {
  const evidence = new Map<number, Evidence[]>();
  const rejected: Rejected[] = [];
  const corrections = new Map<number, Set<string>>();
  const mappingConflicts: MappingConflict[] = [];
  function add(cp: number, raw: string, source: string, file: string, line: number, extra: Partial<Evidence> = {}, unmarkedFirstTone = false) {
    if (!raw.trim()) return;
    try {
      const pinyin = unmarkedFirstTone ? toCnsNumeric(raw) : toNumericReading(raw);
      const entry = { ...extra, source, file, line, raw, pinyin };
      if (!evidence.has(cp)) evidence.set(cp, []);
      evidence.get(cp)!.push(entry);
      if (source === "pinyin-data:overwrite") {
        if (!corrections.has(cp)) corrections.set(cp, new Set());
        corrections.get(cp)!.add(pinyin);
      }
      return true;
    } catch (error) {
      rejected.push({ codepoint: codepoint(cp), source, file, line, raw, reason: (error as Error).message });
      return false;
    }
  }
  // Priority is the insertion order: curated combined data, current Unihan,
  // independent dictionaries. Every source record remains in evidence.
  for (const name of ["pinyin", "overwrite", "kMandarin_8105", "kMandarin_overwrite", "kMandarin", "kTGHZ2013", "kHanyuPinyin", "kXHC1983", "kHanyuPinlu", "nonCJKUI", "kanji", "zdic", "cc_cedict"]) {
    const file = `sources/pinyin-data/${name}.txt`;
    const lines = (await Bun.file(file).text()).split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].split("#")[0].match(/^U\+([0-9A-Fa-f]+):\s*(.+)$/);
      if (!match) continue;
      for (const raw of match[2].split(/[,\s]+/).filter(Boolean)) add(parseInt(match[1], 16), raw, `pinyin-data:${name}`, file, i + 1);
    }
  }
  const file = "sources/unicode-18.0.0/Unihan_Readings.txt";
  const lines = (await Bun.file(file).text()).split(/\r?\n/);
  const properties = new Set(["kMandarin", "kTGHZ2013", "kHanyuPinyin", "kXHC1983", "kHanyuPinlu", "kSMSZD2003Readings"]);
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("U+")) continue;
    const [hex, property, value] = lines[i].split("\t");
    if (!properties.has(property)) continue;
    const parts = property === "kSMSZD2003Readings"
      ? value.split(/\s+/).map(part => part.split("粵")[0]).join(",")
      : value.replace(/[\d.,*]+:/g, " ").replace(/\(\d+\)/g, "");
    for (const raw of parts.split(/[,\s]+/).filter(Boolean)) add(parseInt(hex.slice(2), 16), raw, `Unihan18:${property}`, file, i + 1);
  }
  const wanxiangFile = "sources/wanxiang/zi.dict.yaml";
  const wanxiang = (await Bun.file(wanxiangFile).text()).split(/\r?\n/);
  for (let i = 0; i < wanxiang.length; i++) {
    const [char, raw] = wanxiang[i].split("\t");
    if (!raw || [...char].length !== 1) continue;
    add(char.codePointAt(0)!, raw.split(";")[0], "wanxiang:zi", wanxiangFile, i + 1);
  }
  // Official CNS join: CNS code → Unicode, CNS code → Bopomofo,
  // Bopomofo → the Han (Hanyu Pinyin) column. No hand-made tone conversion.
  // CNS's numeric table omits the digit only for FIRST tone (not neutral).
  const mappings = new Map<string, { cp: number; file: string; line: number }[]>();
  for (const plane of ["BMP", "2", "3"]) {
    const file = `sources/cns11643/MapingTables/Unicode/CNS2UNICODE_Unicode ${plane}.txt`;
    const lines = (await Bun.file(file).text()).split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const [cns, hex] = lines[i].trim().split("\t");
      if (!hex || !/^[0-9A-F]+$/i.test(hex)) continue;
      if (!mappings.has(cns)) mappings.set(cns, []);
      mappings.get(cns)!.push({ cp: parseInt(hex, 16), file, line: i + 1 });
    }
  }
  // CNS's latest published mapping still uses PUA for many now-encoded Han
  // characters. Unihan18's normative T-source supplies their current mapping.
  // Its plane is HEX; CNS file plane numbers are DECIMAL. TU is not a CNS code.
  const irgFile = "sources/unicode-18.0.0/Unihan_IRGSources.txt";
  const irgLines = (await Bun.file(irgFile).text()).split(/\r?\n/);
  const isPua = (cp: number) => (cp >= 0xe000 && cp <= 0xf8ff) || (cp >= 0xf0000 && cp <= 0xffffd) || (cp >= 0x100000 && cp <= 0x10fffd);
  for (let i = 0; i < irgLines.length; i++) {
    if (!irgLines[i].startsWith("U+")) continue;
    const [hex, prop, value] = irgLines[i].split("\t");
    if (prop !== "kIRG_TSource") continue;
    const cns = cnsCodeFromTSource(value);
    if (!cns) continue;
    const cp = parseInt(hex.slice(2), 16);
    const existing = mappings.get(cns) ?? [];
    if (existing.some(m => m.cp === cp)) continue;
    if (existing.some(m => !isPua(m.cp))) {
      mappingConflicts.push({ cns, official: existing.map(m => codepoint(m.cp)), unihan: codepoint(cp), file: irgFile, line: i + 1 });
      continue;
    }
    mappings.set(cns, [...existing, { cp, file: irgFile, line: i + 1 }]);
  }
  const pronunciationFile = "sources/cns11643/Properties/CNS_pinyin_1.txt";
  const pronunciation = new Map<string, { raw: string; line: number }[]>();
  const pronunciationLines = (await Bun.file(pronunciationFile).text()).split(/\r?\n/);
  for (let i = 0; i < pronunciationLines.length; i++) {
    const [bopomofo, raw] = pronunciationLines[i].trim().split("\t");
    if (!raw) continue;
    if (!pronunciation.has(bopomofo)) pronunciation.set(bopomofo, []);
    pronunciation.get(bopomofo)!.push({ raw, line: i + 1 });
  }
  const pronunciationFile2 = "sources/cns11643/Properties/CNS_pinyin_2.txt";
  const pronunciation2 = new Map<string, { raw: string; line: number }>();
  const pronunciationLines2 = (await Bun.file(pronunciationFile2).text()).split(/\r?\n/);
  for (let i = 0; i < pronunciationLines2.length; i++) {
    const [bopomofo, raw] = pronunciationLines2[i].trim().split("\t");
    if (raw) pronunciation2.set(bopomofo, { raw, line: i + 1 });
  }
  const phoneticFile = "sources/cns11643/Properties/CNS_phonetic.txt";
  const phoneticLines = (await Bun.file(phoneticFile).text()).split(/\r?\n/);
  for (let i = 0; i < phoneticLines.length; i++) {
    const [cns, bopomofo] = phoneticLines[i].trim().split("\t");
    if (!bopomofo) continue;
    const mapped = mappings.get(cns);
    const readings = pronunciation.get(bopomofo);
    if (!mapped) continue; // Includes PUA-only entries: not assigned Han characters.
    if (!readings) {
      for (const m of mapped) rejected.push({ codepoint: codepoint(m.cp), source: "CNS11643:phonetic", file: phoneticFile, line: i + 1, raw: bopomofo, reason: "No exact Bopomofo entry in official CNS_pinyin_1 table" });
      continue;
    }
    for (const m of mapped) for (const reading of readings) {
      const extra = { cns, bopomofo, unicodeMapping: { file: m.file, line: m.line } };
      const accepted = add(m.cp, reading.raw, "CNS11643:phonetic", phoneticFile, i + 1, {
        ...extra, pronunciationMapping: { file: pronunciationFile, line: reading.line },
      }, true);
      // Some numeric Jun rows were damaged by spreadsheet date conversion.
      // Fall back to the matching OFFICIAL accented table; retain the rejection.
      const alternative = pronunciation2.get(bopomofo);
      if (!accepted && alternative) add(m.cp, alternative.raw, "CNS11643:phonetic", phoneticFile, i + 1, {
        ...extra, pronunciationMapping: { file: pronunciationFile2, line: alternative.line },
      }, true);
    }
  }
  const rank = (entry: Evidence): number => {
    if (entry.source === "pinyin-data:pinyin") return 0;
    if (entry.source === "pinyin-data:overwrite") return 1;
    if (entry.source === "Unihan18:kMandarin") return 2;
    if (entry.source.startsWith("Unihan18:")) return 3;
    if (entry.source === "CNS11643:phonetic") return 4;
    if (entry.source === "pinyin-data:zdic") return 5;
    if (entry.source === "pinyin-data:cc_cedict") return 6;
    if (entry.source === "wanxiang:zi") return 7;
    return 4;
  };
  for (const entries of evidence.values()) entries.sort((a, b) => rank(a) - rank(b));
  return { evidence, rejected, corrections, mappingConflicts };
}

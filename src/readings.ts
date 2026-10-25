import { extractCedict } from "./cedict";
import { moeFile, moeReadings } from "./moe";
import { toCnsNumeric, toNumericReading } from "./pinyin";
import { cachedWebSources, unicodeVersion, zdicDownload, zdicIndex } from "./sources";
import { cnsCodeFromTSource } from "./unicode";
import { extractYedict } from "./yedict";
import { extractZdic, zdicSyllables } from "./zdic";
import { extractZitools } from "./zitools";

export interface Evidence {
  source: string;
  file: string;
  line?: number;
  raw: string;
  pinyin: string;
  via?: string;
  cns?: string;
  bopomofo?: string;
  unicodeMapping?: { file: string; line: number };
  pronunciationMapping?: { file: string; line: number };
  jsonPointer?: string;
  page?: number;
  tableRow?: number;
  form?: "traditional" | "simplified";
}
export async function loadReadings(): Promise<Map<number, Evidence[]>> {
  const evidence = new Map<number, Evidence[]>();
  function add(
    cp: number,
    raw: string,
    source: string,
    file: string,
    line: number | undefined,
    extra: Partial<Evidence> = {},
    unmarkedFirstTone = false,
  ) {
    if (!raw.trim()) return;
    try {
      const pinyin = unmarkedFirstTone ? toCnsNumeric(raw) : toNumericReading(raw);
      const entry = { ...extra, source, file, line, raw, pinyin };
      if (!evidence.has(cp)) evidence.set(cp, []);
      evidence.get(cp)!.push(entry);
      return true;
    } catch {
      return false;
    }
  }
  // Every original record remains in evidence; rank sources below.
  const file = `sources/unicode-${unicodeVersion}/Unihan_Readings.txt`;
  const lines = (await Bun.file(file).text()).split(/\r?\n/);
  const properties = new Set(["kTGHZ2013", "kHanyuPinyin", "kXHC1983", "kHanyuPinlu", "kSMSZD2003Readings"]);
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("U+")) continue;
    const [hex, property, value] = lines[i].split("\t");
    if (!properties.has(property)) continue;
    const parts =
      property === "kSMSZD2003Readings"
        ? value
            .split(/\s+/)
            .map((part) => part.split("粵")[0])
            .join(",")
        : value.replace(/[\d.,*]+:/g, " ").replace(/\(\d+\)/g, "");
    for (const raw of parts.split(/[,\s]+/).filter(Boolean))
      add(parseInt(hex.slice(2), 16), raw, `Unihan18:${property}`, file, i + 1);
  }
  const cedictFile = "sources/cc-cedict/cedict_ts.u8";
  const cedictLines = (await Bun.file(cedictFile).text()).split(/\r?\n/);
  for (let i = 0; i < cedictLines.length; i++)
    for (const reading of extractCedict(cedictLines[i]))
      add(reading.cp, reading.raw, "CC-CEDICT:headword", cedictFile, i + 1, {
        form: reading.form,
      });
  for (const syllable of zdicSyllables(await Bun.file(zdicIndex.path).text())) {
    const { path } = zdicDownload(syllable);
    for (const reading of extractZdic(await Bun.file(path).text(), syllable))
      add(reading.cp, reading.raw, "zdic:pinyin-index", path, reading.line);
  }
  // Scanned PDF: page/tableRow locate the original instead of a text line.
  if (!(await Bun.file(moeFile).exists())) throw new Error(`Missing Ministry original: ${moeFile}`);
  for (const reading of moeReadings)
    add(reading.char.codePointAt(0)!, reading.raw, "MOE:ja-hanzi-draft", moeFile, undefined, {
      page: reading.page,
      tableRow: reading.tableRow,
    });
  for await (const { source, cp, path: file } of cachedWebSources()) {
    const text = await Bun.file(file).text();
    try {
      const result = (source === "yedict" ? extractYedict : extractZitools)(text, cp);
      for (const reading of result)
        add(cp, reading.raw, `${source}:explicit-pinyin`, file, 1, {
          jsonPointer: reading.jsonPointer,
        });
    } catch {
      // Ignore entries without usable readings for this character.
    }
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
  const irgFile = `sources/unicode-${unicodeVersion}/Unihan_IRGSources.txt`;
  const irgLines = (await Bun.file(irgFile).text()).split(/\r?\n/);
  const isPua = (cp: number) =>
    (cp >= 0xe000 && cp <= 0xf8ff) || (cp >= 0xf0000 && cp <= 0xffffd) || (cp >= 0x100000 && cp <= 0x10fffd);
  for (let i = 0; i < irgLines.length; i++) {
    if (!irgLines[i].startsWith("U+")) continue;
    const [hex, prop, value] = irgLines[i].split("\t");
    if (prop !== "kIRG_TSource") continue;
    const cns = cnsCodeFromTSource(value);
    if (!cns) continue;
    const cp = parseInt(hex.slice(2), 16);
    const existing = mappings.get(cns) ?? [];
    if (existing.some((m) => m.cp === cp)) continue;
    if (existing.some((m) => !isPua(m.cp))) continue;
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
    if (!readings) continue;
    for (const m of mapped)
      for (const reading of readings) {
        const extra = {
          cns,
          bopomofo,
          unicodeMapping: { file: m.file, line: m.line },
        };
        const accepted = add(
          m.cp,
          reading.raw,
          "CNS11643:phonetic",
          phoneticFile,
          i + 1,
          {
            ...extra,
            pronunciationMapping: {
              file: pronunciationFile,
              line: reading.line,
            },
          },
          true,
        );
        // Some numeric Jun rows were damaged by spreadsheet date conversion.
        // Fall back to the matching official accented table.
        const alternative = pronunciation2.get(bopomofo);
        if (!accepted && alternative)
          add(
            m.cp,
            alternative.raw,
            "CNS11643:phonetic",
            phoneticFile,
            i + 1,
            {
              ...extra,
              pronunciationMapping: {
                file: pronunciationFile2,
                line: alternative.line,
              },
            },
            true,
          );
      }
  }
  const rank = (entry: Evidence): number => {
    if (entry.source.startsWith("Unihan18:")) return 1;
    if (entry.source === "CNS11643:phonetic") return 2;
    if (entry.source === "MOE:ja-hanzi-draft") return 3;
    if (entry.source === "zdic:pinyin-index") return 5;
    if (entry.source === "CC-CEDICT:headword") return 6;
    if (entry.source === "yedict:explicit-pinyin") return 7;
    if (entry.source === "zitools:explicit-pinyin") return 8;
    return 4;
  };
  for (const entries of evidence.values()) entries.sort((a, b) => rank(a) - rank(b));
  return evidence;
}

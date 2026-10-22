import { test, expect } from "bun:test";
import { toNumeric, toNumericReading, toCnsNumeric } from "../src/pinyin";
import { parseUnicodeData, propertySet, hanRepertoire, cnsCodeFromTSource, singleHanDecomposition, type UnicodeChar } from "../src/unicode";
import { withCoverage } from "../src/report";

test("tones, NFC/NFD, ü, ê and syllabic nasals", () => {
  for (const [raw, expected] of [["zhāng", "zhang1"], ["nǚ", "nv3"], ["lǜ", "lv4"], ["lu:4", "lv4"], ["ḿ", "m2"], ["ń", "n2"], ["n̄", "n1"], ["ê̌", "ê3"], ["de", "de5"], ["ma0", "ma5"], ["ZHANG1", "zhang1"]]) {
    expect(toNumeric(raw)).toBe(expected);
    expect(toNumeric(raw.normalize("NFD"))).toBe(expected);
  }
});
test("CNS unmarked tone is first, independent of the neutral-tone convention", () => {
  expect(toCnsNumeric("jun")).toBe("jun1");
  expect(toCnsNumeric("jun3")).toBe("jun3");
  expect(toCnsNumeric("jùn")).toBe("jun4");
  expect(toCnsNumeric("de5")).toBe("de5");
  expect(() => toCnsNumeric("4-Jun")).toThrow();
});
test("one character can have a polysyllabic reading", () => {
  expect(toNumericReading("qiānwǎ")).toBe("qian1-wa3");
  expect(toNumericReading("yīngcùn")).toBe("ying1-cun4");
  expect(toNumericReading("gōngfēn")).toBe("gong1-fen1");
  expect(() => toNumeric("qiānwǎ")).toThrow();
});
test("foreign romanizations, corrupt data and conflicting tones are not accepted", () => {
  for (const raw of ["hol", "kasei", "myeong", "phdeng", "liì", "zǹ", "xxx", "bā4", "q5", "ㄑ"]) expect(() => toNumericReading(raw)).toThrow();
});
test("T-source planes are hexadecimal while CNS planes are decimal", () => {
  expect(cnsCodeFromTSource("TA-2121")).toBe("10-2121");
  expect(cnsCodeFromTSource("T13-4068")).toBe("19-4068");
  expect(cnsCodeFromTSource("TU-33472")).toBeUndefined();
});
test("Unicode First/Last ranges expand and compatibility ideographs deduplicate", () => {
  const data = parseUnicodeData("3400;<CJK Ideograph Extension A, First>;Lo;0;L;;;;;N;;;;;\n3402;<CJK Ideograph Extension A, Last>;Lo;0;L;;;;;N;;;;;\nFA11;CJK COMPATIBILITY IDEOGRAPH-FA11;Lo;0;L;;;;;N;;;;;\n3007;IDEOGRAPHIC NUMBER ZERO;Nl;0;L;;;;;N;;;;;");
  const unified = propertySet("3400..3402; Unified_Ideograph # comment\nFA11; Unified_Ideograph", "Unified_Ideograph");
  expect(hanRepertoire(data, unified)).toEqual([0x3007, 0x3400, 0x3401, 0x3402, 0xfa11]);
  expect(data.has(0x3403)).toBe(false);
});
test("requested blocks include symbols of every script, but exclude unassigned slots", () => {
  const entries: UnicodeChar[] = [
    { cp: 0x3007, name: "IDEOGRAPHIC NUMBER ZERO", category: "Nl", decomposition: "" },
    { cp: 0x4e00, name: "CJK UNIFIED IDEOGRAPH-4E00", category: "Lo", decomposition: "" },
    { cp: 0x3000, name: "IDEOGRAPHIC SPACE", category: "Zs", decomposition: "<wide> 0020" },
    { cp: 0x3200, name: "PARENTHESIZED HANGUL KIYEOK", category: "So", decomposition: "<compat> 0028 1100 0029" },
    { cp: 0x1f200, name: "SQUARE HIRAGANA HOKA", category: "So", decomposition: "<square> 307B 304B" },
    { cp: 0x41, name: "LATIN CAPITAL LETTER A", category: "Lu", decomposition: "" },
  ];
  const blocks = [
    { start: 0x3000, end: 0x303f, name: "CJK Symbols and Punctuation" },
    { start: 0x3200, end: 0x32ff, name: "Enclosed CJK Letters and Months" },
    { start: 0x1f200, end: 0x1f2ff, name: "Enclosed Ideographic Supplement" },
  ];
  expect(hanRepertoire(new Map(entries.map(e => [e.cp, e])), new Set([0x4e00]), blocks)).toEqual([0x3000, 0x3007, 0x3200, 0x4e00, 0x1f200]);
});
test("formatting decomposition supplies one Han reading, not a symbol name or multi-character phrase", () => {
  const entry = (decomposition: string): UnicodeChar => ({ cp: 0x32a4, name: "CIRCLED IDEOGRAPH HIGH", category: "So", decomposition });
  const unified = new Set([0x4e00, 0x4e0a]);
  expect(singleHanDecomposition(entry("<circle> 4E0A"), unified)).toBe(0x4e0a);
  expect(singleHanDecomposition(entry("<compat> 4E00"), unified)).toBe(0x4e00);
  expect(singleHanDecomposition(entry("<wide> 0020"), unified)).toBeUndefined();
  expect(singleHanDecomposition(entry("<compat> 0028 4E00 0029"), unified)).toBeUndefined();
});
test("coverage refresh preserves authored README sections and rejects broken markers", () => {
  expect(withCoverage("intro\n<!-- coverage:start -->\nold\n<!-- coverage:end -->\nsource notes", "new")).toBe("intro\n<!-- coverage:start -->\n\nnew\n\n<!-- coverage:end -->\nsource notes");
  expect(() => withCoverage("no markers", "new")).toThrow();
});

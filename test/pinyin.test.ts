import { test, expect } from "bun:test";
import { toNumeric, toNumericReading, toCnsNumeric } from "../src/pinyin";
import { parseUnicodeData, propertySet, hanRepertoire, cnsCodeFromTSource } from "../src/unicode";

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

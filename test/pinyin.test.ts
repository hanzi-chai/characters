import { test, expect } from "bun:test";
import { toNumeric, toNumericReading, toCnsNumeric } from "../src/pinyin";
import { parseUnicodeData, propertySet, hanRepertoire, cnsCodeFromTSource, singleHanDecomposition, type UnicodeChar } from "../src/unicode";
import { withCoverage } from "../src/report";
import { yedictReadings, extractYedict } from "../src/yedict";
import { extractZitools } from "../src/zitools";

test("Yedict distinguishes explicit Mandarin from dialect, components and variant references", () => {
  const record = (definition: string) => JSON.stringify({
    ziid: "U09FCA", goto_from: null,
    property: { ziid: "U09FCA", zi: "鿊", head_py_display: "cao", tail_py_display: "zhi" },
    meanings: { mean_h: [definition] },
  });
  expect(yedictReadings(record("读音zi2[粤]，拼音zhi3<br>人名用字。"), 0x9fca)).toEqual([{ raw: "zhi3", jsonPointer: "/meanings/mean_h/0" }]);
  for (const text of ["同【止】。", "读音sie44 [乌～]一种很小的蚊虫。", "拼音zhi", "拼音zhi33"]) expect(yedictReadings(record(text), 0x9fca)).toEqual([]);
  expect(() => yedictReadings(record("拼音zhi3"), 0x2b821)).toThrow();
  expect(() => yedictReadings(record("拼音zhi3").replace('"goto_from":null', '"goto_from":"U06B62"'), 0x9fca)).toThrow();
});

test("Yedict accepts written tones in Chinese definitions, without supplying missing tones or inferred readings", () => {
  const record = JSON.stringify({ ziid: "U09FCA", property: { ziid: "U09FCA", zi: "鿊" }, meanings: {
    mean_h: ["拼音lan、lang、dian3", "读音xi2、yu4", "拼音pou3she3", "拟定读音du2", "㈠拟定拼音gao1<br>㈡拼音zhi3"],
    mean_g: ["㈠zhǐ 古代汉语字条", "读音geng2<br>拟音字。"], mean_z: ["拼音bu1"], mean_j: ["读音shi4"], discuss: ["拼音du2"],
  } });
  const result = extractYedict(record, 0x9fca);
  expect(result.readings.map(item => item.raw)).toEqual(["dian3", "xi2", "yu4", "pou3she3", "zhi3", "zhǐ", "geng2"]);
  expect(result.rejected.some(item => item.reason.includes("infers"))).toBe(true);
});

test("Zitools uses the character's own Mandarin rows and Chinese dictionary fields", () => {
  const row = (id: string, char: string, definition: string, reading = "") => [id, "GHZH", "", "", char, char, char, definition, reading];
  const record = JSON.stringify({ __zi: "鿊", _zi: "鿊", yi: {
    yin: { zibokrows: { 鿊: { cn: ["cn:zhi3", "cn:gai4", "cn:wu4", "cn:wrong"] } }, rows: {
      "cn:zhi3": { zi: "鿊", syl: "zhi", ton: "3", path: "", phos: [] },
      "cn:gai4": { zi: "鿊", syl: "gai", ton: "4", path: "丐", phos: [] },
      "cn:wu4": { zi: "鿊", syl: "wu", ton: "4", path: "", phos: ["声旁"] },
      "cn:wrong": { zi: "止", syl: "zhi", ton: "4" },
    } },
    row_node_id_list: ["own/row", "other", "foreign", "dialect", "usage"], nodes: {
      "own/row": row("own/row", "鿊", "zhǐ 人名用字", "cn:zhi3"),
      other: row("other", "止", "读音zhi4"),
      foreign: ["foreign", "VN", "", "", "鿊", "鿊", "鿊", "shi4 越南字"],
      dialect: ["dialect", "GZFY", "", "", "鿊", "鿊", "鿊", "tian1 誰。閩語"],
      usage: ["usage", "TC", "", "", "鿊", "鿊", "鿊", "mou3 內政部戶政用字"],
      unrelated: row("unrelated", "鿊", "拼音zhi4"),
    },
  } });
  const result = extractZitools(record, 0x9fca);
  expect(result.readings.map(item => [item.raw, item.jsonPointer])).toEqual([
    ["zhi3", "/yi/yin/rows/cn:zhi3"], ["zhi3", "/yi/nodes/own~1row/8"], ["zhǐ", "/yi/nodes/own~1row/7"],
  ]);
  expect(result.rejected).toHaveLength(3);
  expect(() => extractZitools(record, 0x6b62)).toThrow();
});

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
  expect(toNumericReading("pou3she3")).toBe("pou3-she3");
  expect(toNumericReading("qian1-wa3")).toBe("qian1-wa3");
  expect(() => toNumericReading("pou3she")).toThrow();
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

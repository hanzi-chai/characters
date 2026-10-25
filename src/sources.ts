export const unicodeVersion = "18.0.0";
export const pinyinCommit = "9e5e9bdfe8add694300e0cc93a27b803b68377f9";
export const wanxiangCommit = "429bca38cec288ca9f6c322333908ce17adb0885";
export const cnsMirrorCommit = "27a0ea7451215a4b4e5bad0fa1640977630e4b00";
export const yedictSnapshot = "2026-10-22";
export const zitoolsSnapshot = "2026-10-22";
export const webEndpoints = {
  yedictSyllables: "http://yedict.com/api/pinyin-syllables",
  yedictSearch: (py: string, page: number) => `http://yedict.com/api/search/pinyin?pinyin=${encodeURIComponent(py)}&page=${page}&page_size=200`,
  zitoolsSearch: (chars: string) => `https://zi.tools/api/yin/search/zi:${encodeURIComponent(chars)}/cn`,
};
// Seed entries remain available when bootstrapping a new source lock.
export const yedictCodepoints = [0x9fca, 0x2b821];
export function yedictId(cp: number): string {
  return `U${cp.toString(16).toUpperCase().padStart(5, "0")}`;
}
export function webDownload(source: "yedict" | "zitools", cp: number) {
  return {
    path: `sources/${source}/${yedictId(cp)}.json`,
    url: source === "yedict" ? `http://yedict.com/api/z/${yedictId(cp)}` : `https://zi.tools/api/zi/${encodeURIComponent(String.fromCodePoint(cp))}`,
  };
}
export const downloads = [
  ...["Unihan.zip", "UnicodeData.txt", "PropList.txt", "Blocks.txt", "Scripts.txt", "ReadMe.txt", "EquivalentUnifiedIdeograph.txt"].map(name => ({
    path: `sources/unicode-${unicodeVersion}/${name}`,
    url: `https://www.unicode.org/Public/${unicodeVersion}/ucd/${name}`,
  })),
  { path: `sources/unicode-${unicodeVersion}/LICENSE.txt`, url: "https://www.unicode.org/license.txt" },
  { path: "sources/pinyin-data/upstream.tar.gz", url: `https://codeload.github.com/mozillazg/pinyin-data/tar.gz/${pinyinCommit}` },
  ...["dicts/zi.dict.yaml", "LICENSE", "README.md"].map(name => ({
    path: `sources/wanxiang/${name.split("/").at(-1)}`,
    url: `https://raw.githubusercontent.com/amzxyz/rime-wanxiang/${wanxiangCommit}/${name}`,
  })),
  { path: "sources/unicode-18.0.0/tr38-41.html", url: "https://www.unicode.org/reports/tr38/tr38-41.html" },
  ...["Properties.zip", "MapingTables.zip", "release.txt"].map(name => ({
    path: `sources/cns11643/${name}`, url: `https://data.cns11643.gov.tw/opendata/${name}`,
  })),
  { path: "sources/cns11643/LICENSE.html", url: "https://www.cns11643.gov.tw/pageView.jsp?ID=59" },
  { path: "sources/cns11643/LICENSE-government.html", url: "https://data.gov.tw/license" },
  ...["Properties/CNS_phonetic.txt", "Properties/CNS_pinyin_1.txt", "Properties/全字庫屬性資料說明文件.txt", "MapingTables/Unicode/CNS2UNICODE_Unicode BMP.txt", "MapingTables/Unicode/CNS2UNICODE_Unicode 2.txt", "MapingTables/Unicode/CNS2UNICODE_Unicode 3.txt"].map(name => ({
    path: `sources/cns11643-mirror/${name}`,
    url: `https://raw.githubusercontent.com/yintzuyuan/CNS11643-OpenData/${cnsMirrorCommit}/Tables/${name.split("/").map(encodeURIComponent).join("/")}`,
  })),
  ...yedictCodepoints.map(cp => ({
    path: `sources/yedict/${yedictId(cp)}.json`,
    url: `http://yedict.com/api/z/${yedictId(cp)}`,
  })),
];

export const unicodeVersion = "18.0.0";
export const zdicIndex = {
  path: "sources/zdic/index.html",
  url: "https://www.zdic.net/zd/py/",
};
export function zdicDownload(syllable: string) {
  if (!/^[a-z]+$/.test(syllable)) throw new Error(`Invalid Zdic syllable: ${syllable}`);
  return {
    path: `sources/zdic/${syllable}.html`,
    url: `https://www.zdic.net/zd/py/py/?py=${syllable}`,
  };
}
export const cnsMirrorCommit = "27a0ea7451215a4b4e5bad0fa1640977630e4b00";
export const webEndpoints = {
  yedictSyllables: "http://yedict.com/api/pinyin-syllables",
  yedictSearch: (py: string, page: number) =>
    `http://yedict.com/api/search/pinyin?pinyin=${encodeURIComponent(py)}&page=${page}&page_size=200`,
  zitoolsSearch: (chars: string) => `https://zi.tools/api/yin/search/zi:${encodeURIComponent(chars)}/cn`,
};
// Initial dictionary entries; collection adds further originals locally.
const yedictCodepoints = [0x9fca, 0x2b821];
export function yedictId(cp: number): string {
  return `U${cp.toString(16).toUpperCase().padStart(5, "0")}`;
}
export function webDownload(source: "yedict" | "zitools", cp: number) {
  return {
    path: `sources/${source}/${yedictId(cp)}.json`,
    url:
      source === "yedict"
        ? `http://yedict.com/api/z/${yedictId(cp)}`
        : `https://zi.tools/api/zi/${encodeURIComponent(String.fromCodePoint(cp))}`,
  };
}
export const downloads = [
  ...["Unihan.zip", "UnicodeData.txt", "PropList.txt", "Blocks.txt", "ReadMe.txt"].map((name) => ({
    path: `sources/unicode-${unicodeVersion}/${name}`,
    url: `https://www.unicode.org/Public/${unicodeVersion}/ucd/${name}`,
  })),
  {
    path: `sources/unicode-${unicodeVersion}/LICENSE.txt`,
    url: "https://www.unicode.org/license.txt",
  },
  {
    path: "sources/cc-cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz",
    url: "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz",
  },
  {
    path: "sources/cc-cedict/download.html",
    url: "https://www.mdbg.net/chinese/dictionary?page=cc-cedict",
  },
  {
    path: "sources/cc-cedict/LICENSE.txt",
    url: "https://creativecommons.org/licenses/by-sa/4.0/legalcode.txt",
  },
  {
    path: "sources/moe/japanese-kanji.pdf",
    url: "https://www.moe.gov.cn/ewebeditor/uploadfile/2015/01/13/20150113090951346.pdf",
  },
  zdicIndex,
  { path: "sources/zdic/terms.html", url: "https://www.zdic.net/terms/" },
  ...["Properties.zip", "MapingTables.zip", "release.txt"].map((name) => ({
    path: `sources/cns11643/${name}`,
    url: `https://data.cns11643.gov.tw/opendata/${name}`,
  })),
  {
    path: "sources/cns11643/LICENSE.html",
    url: "https://www.cns11643.gov.tw/pageView.jsp?ID=59",
  },
  {
    path: "sources/cns11643/LICENSE-government.html",
    url: "https://data.gov.tw/license",
  },
  ...[
    "Properties/CNS_phonetic.txt",
    "Properties/CNS_pinyin_1.txt",
    "Properties/全字庫屬性資料說明文件.txt",
    "MapingTables/Unicode/CNS2UNICODE_Unicode BMP.txt",
    "MapingTables/Unicode/CNS2UNICODE_Unicode 2.txt",
    "MapingTables/Unicode/CNS2UNICODE_Unicode 3.txt",
  ].map((name) => ({
    path: `sources/cns11643-mirror/${name}`,
    url: `https://raw.githubusercontent.com/yintzuyuan/CNS11643-OpenData/${cnsMirrorCommit}/Tables/${name.split("/").map(encodeURIComponent).join("/")}`,
  })),
  ...yedictCodepoints.map((cp) => webDownload("yedict", cp)),
];

export async function* cachedWebSources() {
  for (const source of ["yedict", "zitools"] as const) {
    for await (const path of new Bun.Glob(`sources/${source}/U?????.json`).scan(".")) {
      const cp = parseInt(path.match(/U([0-9A-F]{5})\.json$/)![1], 16);
      yield { source, cp, ...webDownload(source, cp) };
    }
  }
}

/** Syllable links exposed by the official dictionary's index, including rare spellings. */
export function zdicSyllables(html: string): string[] {
  const syllables = [...new Set([...html.matchAll(/data-py="([a-z]+)"/g)].map((match) => match[1]))].sort();
  if (!syllables.length) throw new Error("No syllables in the official Zdic index");
  return syllables;
}

interface ZdicReading {
  cp: number;
  raw: string;
  line: number;
}

/** Each h3 is an explicit pronunciation; only its own character links belong to it. */
export function extractZdic(html: string, syllable: string): ZdicReading[] {
  if (!html.includes(`拼音为 ${syllable} 的汉字`)) throw new Error(`Unexpected Zdic index: ${syllable}`);
  const readings: ZdicReading[] = [];
  const groups = [...html.matchAll(/<h3>([^<>]+)<\/h3>([\s\S]*?)(?=<h3>|$)/g)];
  if (!groups.length) throw new Error(`No pronunciation groups: ${syllable}`);
  for (const group of groups) {
    for (const link of group[2].matchAll(/<a\s+href="\/hans\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
      const char = decodeURIComponent(link[1]);
      const label = link[2].match(/^<img\b[^>]*\balt="([^"]+)"[^>]*>$/)?.[1] ?? link[2];
      if ([...char].length !== 1 || label !== char) throw new Error(`Mismatched Zdic character: ${link[0]}`);
      const offset = group.index! + group[0].indexOf(group[2]) + link.index!;
      readings.push({
        cp: char.codePointAt(0)!,
        raw: group[1].trim(),
        line: html.slice(0, offset).split("\n").length,
      });
    }
  }
  return readings;
}

interface CedictReading {
  cp: number;
  raw: string;
  form: "traditional" | "simplified";
}

/** Accept single-character headwords only; never distribute a word's syllables. */
export function extractCedict(line: string): CedictReading[] {
  if (line.startsWith("#")) return [];
  const match = line.match(/^(\S+) (\S+) \[([^[\]]+)\] \/.*\/$/);
  if (!match || [...match[1]].length !== 1 || [...match[2]].length !== 1) return [];
  return [
    {
      cp: match[1].codePointAt(0)!,
      raw: match[3].trim().replace(/\s+/g, "-"),
      form: "traditional",
    },
    ...(match[2] === match[1]
      ? []
      : [
          {
            cp: match[2].codePointAt(0)!,
            raw: match[3].trim().replace(/\s+/g, "-"),
            form: "simplified" as const,
          },
        ]),
  ];
}

import { toNumericReading } from "./pinyin";

export interface WebReading {
  raw: string;
  jsonPointer: string;
}
export const escapePointer = (value: string) => value.replaceAll("~", "~0").replaceAll("/", "~1");
export const hasWrittenTone = (raw: string) =>
  /[0-5]/.test(raw) || /[\u0300\u0301\u0304\u030c]/.test(raw.normalize("NFD"));

/** Read only labelled lists or a dictionary head's own opening transcription. */
export function labelledPinyin(text: string, jsonPointer: string, leading = false): WebReading[] {
  const result: WebReading[] = [];
  const senses = text.split(/(?=[㈠㈡㈢㈣㈤㈥㈦㈧㈨㈩])/);
  if (senses.length > 1) {
    for (const sense of senses) {
      result.push(...labelledPinyin(sense, jsonPointer, leading));
    }
    return [...new Map(result.map((reading) => [reading.raw, reading])).values()];
  }
  if (
    /[拟擬](?:定|作)?(?:读音|讀音|拼音|音(?!字|词|詞))|推[测測断斷定](?:读音|讀音|拼音)|[按據据].{0,6}[声聲]旁.{0,8}(?:读|讀|音)/.test(
      text,
    )
  ) {
    return result;
  }
  const starts: number[] = [];
  for (const label of text.matchAll(/(?:汉语|漢語)?拼音|读音|讀音/g)) {
    const before = text.slice(Math.max(0, label.index! - 12), label.index);
    if (/(?:方言|粤语|粵語|粤|粵|闽语|閩語|日语|日語|韩语|韓語|壮语|壯語|越南语|越南語)\s*$/.test(before)) continue;
    starts.push(label.index! + label[0].length);
  }
  if (leading)
    for (const start of text.matchAll(/(?:^[㈠㈡㈢㈣㈤㈥㈦㈧㈨㈩]?|<br\s*\/?>|[\r\n]|[㈠㈡㈢㈣㈤㈥㈦㈧㈨㈩])/g))
      starts.push(start.index! + start[0].length);
  for (const start of starts) {
    let rest = text.slice(start).replace(/^[\s:：]+/, "");
    for (let count = 0; count < 16; count++) {
      const token = rest.match(
        // biome-ignore lint/suspicious/noMisleadingCharacterClass: NFD tone marks are intentionally accepted as individual code points after a letter.
        /^([a-zA-Z\u00C0-\u024F\u0251\u0261][a-zA-Z\u00C0-\u024F\u0300-\u036F\u0251\u0261:0-9'-]*)/,
      )?.[1];
      if (!token) break;
      if (/^\s*[[【（(](?:粤|粵|闽|閩|壮|壯|日|韩|韓)/.test(rest.slice(token.length))) break;
      if (hasWrittenTone(token)) {
        try {
          toNumericReading(token);
          result.push({ raw: token, jsonPointer });
        } catch {
          // Ignore tokens that are not Mandarin readings.
        }
      }
      rest = rest.slice(token.length);
      const separator = rest.match(/^(?:\s*(?:、|，|,|\/|或|和|及|<br\s*\/?>)\s*|\s+)/)?.[0];
      if (!separator) break;
      rest = rest.slice(separator.length);
    }
  }
  return [...new Map(result.map((reading) => [reading.raw, reading])).values()];
}

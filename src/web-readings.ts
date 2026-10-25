import { toNumericReading } from "./pinyin";

export interface WebReading { raw: string; jsonPointer: string; kind: "label" | "leading" | "cn-field" | "cn-row" }
export interface WebRejection { raw: string; jsonPointer: string; reason: string }
export interface WebReadings { readings: WebReading[]; rejected: WebRejection[] }
export const escapePointer = (value: string) => value.replaceAll("~", "~0").replaceAll("/", "~1");
export const hasWrittenTone = (raw: string) => /[0-5]/.test(raw) || /[\u0300\u0301\u0304\u030c]/.test(raw.normalize("NFD"));

/** Read only labelled lists or a dictionary head's own opening transcription. */
export function labelledPinyin(text: string, jsonPointer: string, leading = false): WebReadings {
  const result: WebReadings = { readings: [], rejected: [] };
  const senses = text.split(/(?=[㈠㈡㈢㈣㈤㈥㈦㈧㈨㈩])/);
  if (senses.length > 1) {
    for (const sense of senses) {
      const found = labelledPinyin(sense, jsonPointer, leading);
      result.readings.push(...found.readings); result.rejected.push(...found.rejected);
    }
    result.readings = [...new Map(result.readings.map(reading => [reading.raw, reading])).values()];
    return result;
  }
  if (/[拟擬](?:定|作)?(?:读音|讀音|拼音|音(?!字|词|詞))|推[测測断斷定](?:读音|讀音|拼音)|[按據据].{0,6}[声聲]旁.{0,8}(?:读|讀|音)/.test(text)) {
    result.rejected.push({ raw: text, jsonPointer, reason: "Source explicitly proposes or infers the reading" });
    return result;
  }
  const starts: { offset: number; kind: WebReading["kind"] }[] = [];
  for (const label of text.matchAll(/(?:汉语|漢語)?拼音|读音|讀音/g)) {
    const before = text.slice(Math.max(0, label.index! - 12), label.index);
    if (/(?:方言|粤语|粵語|粤|粵|闽语|閩語|日语|日語|韩语|韓語|壮语|壯語|越南语|越南語)\s*$/.test(before)) continue;
    starts.push({ offset: label.index! + label[0].length, kind: "label" });
  }
  if (leading) for (const start of text.matchAll(/(?:^[㈠㈡㈢㈣㈤㈥㈦㈧㈨㈩]?|<br\s*\/?>|[\r\n]|[㈠㈡㈢㈣㈤㈥㈦㈧㈨㈩])/g)) starts.push({ offset: start.index! + start[0].length, kind: "leading" });
  for (const start of starts) {
    let rest = text.slice(start.offset).replace(/^[\s:：]+/, "");
    for (let count = 0; count < 16; count++) {
      const token = rest.match(/^([a-zA-Z\u00C0-\u024F\u0251\u0261][a-zA-Z\u00C0-\u024F\u0300-\u036F\u0251\u0261:0-9'-]*)/)?.[1];
      if (!token) break;
      if (/^\s*[[【（(](?:粤|粵|闽|閩|壮|壯|日|韩|韓)/.test(rest.slice(token.length))) break;
      if (hasWrittenTone(token)) {
        try { toNumericReading(token); result.readings.push({ raw: token, jsonPointer, kind: start.kind }); }
        catch (error) { result.rejected.push({ raw: token, jsonPointer, reason: String(error) }); }
      }
      rest = rest.slice(token.length);
      const separator = rest.match(/^(?:\s*(?:、|，|,|\/|或|和|及|<br\s*\/?>)\s*|\s+)/)?.[0];
      if (!separator) break;
      rest = rest.slice(separator.length);
    }
  }
  result.readings = [...new Map(result.readings.map(reading => [reading.raw, reading])).values()];
  return result;
}

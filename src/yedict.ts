import { yedictId } from "./sources";
import { labelledPinyin, type WebReadings } from "./web-readings";

/** Chinese-language definitions only; component and foreign-language fields are excluded. */
export function extractYedict(text: string, cp: number): WebReadings {
  const record = JSON.parse(text);
  const id = yedictId(cp);
  if (record.ziid !== id || record.property?.ziid !== id || record.property?.zi !== String.fromCodePoint(cp) || record.goto_from) {
    throw new Error(`Yedict character mismatch or redirect: ${id}`);
  }
  const result: WebReadings = { readings: [], rejected: [] };
  for (const field of ["mean_h", "mean_g"]) {
    const definitions = record.meanings?.[field] ?? [];
    if (!Array.isArray(definitions) || definitions.some(value => typeof value !== "string")) throw new Error(`Invalid Yedict definitions: ${id}`);
    for (let i = 0; i < definitions.length; i++) {
      const found = labelledPinyin(definitions[i], `/meanings/${field}/${i}`, true);
      result.readings.push(...found.readings); result.rejected.push(...found.rejected);
    }
  }
  return result;
}
export const yedictReadings = (text: string, cp: number) => extractYedict(text, cp).readings.map(({ raw, jsonPointer }) => ({ raw, jsonPointer }));

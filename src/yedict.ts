import { yedictId } from "./sources";
import { labelledPinyin, type WebReading } from "./web-readings";

/** Chinese-language definitions only; component and foreign-language fields are excluded. */
export function extractYedict(text: string, cp: number): WebReading[] {
  const record = JSON.parse(text);
  const id = yedictId(cp);
  if (
    record.ziid !== id ||
    record.property?.ziid !== id ||
    record.property?.zi !== String.fromCodePoint(cp) ||
    record.goto_from
  ) {
    throw new Error(`Yedict character mismatch or redirect: ${id}`);
  }
  const result: WebReading[] = [];
  for (const field of ["mean_h", "mean_g"]) {
    const definitions = record.meanings?.[field] ?? [];
    if (!Array.isArray(definitions) || definitions.some((value) => typeof value !== "string"))
      throw new Error(`Invalid Yedict definitions: ${id}`);
    for (let i = 0; i < definitions.length; i++) {
      result.push(...labelledPinyin(definitions[i], `/meanings/${field}/${i}`, true));
    }
  }
  return result;
}

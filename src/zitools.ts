import { escapePointer, hasWrittenTone, labelledPinyin, type WebReadings } from "./web-readings";

/** Never follow the site's variant graph or its inherited phonetic paths. */
export function extractZitools(text: string, cp: number): WebReadings {
  const record = JSON.parse(text), char = String.fromCodePoint(cp);
  if (record.__zi !== char || record._zi !== char || !record.yi) throw new Error(`Zitools character mismatch: U+${cp.toString(16)}`);
  const result: WebReadings = { readings: [], rejected: [] };
  const yi = record.yi;
  for (const id of yi.yin?.zibokrows?.[char]?.cn ?? []) {
    const row = yi.yin.rows[id];
    if (!id.startsWith("cn:") || row?.zi !== char || !/^[1-5]$/.test(row.ton)) continue;
    const jsonPointer = `/yi/yin/rows/${escapePointer(id)}`;
    const raw = `${row.syl}${row.ton}`;
    if (row.path || row.phos?.length) { result.rejected.push({ raw, jsonPointer, reason: "Zitools reading follows a variant or phonetic path" }); continue; }
    result.readings.push({ raw, jsonPointer, kind: "cn-row" });
  }
  for (const id of yi.row_node_id_list ?? []) {
    const row = yi.nodes?.[id];
    if (!Array.isArray(row) || row[0] !== id || row[5] !== char || row[6] !== char) continue;
    const prefix = `/yi/nodes/${escapePointer(id)}`;
    if (typeof row[8] === "string" && row[8].startsWith("cn:")) {
      for (const raw of row[8].slice(3).split(/[,，、\s]+/).filter(Boolean)) if (hasWrittenTone(raw)) result.readings.push({ raw, jsonPointer: `${prefix}/8`, kind: "cn-field" });
    }
    // Unlabelled dictionary heads need a known Chinese dictionary, rather than
    // a blacklist of foreign databases whose names may change.
    if (!/^(?:T[0-9A-F]+|GHZH|GHZR|GKX|SWJZ|HYDZD|ZITOOLS)$/.test(row[1])) continue;
    if (/^T[0-9A-F]+$/.test(row[1]) && /^mou3\s+.*用字\s*$/.test(row[7] ?? "")) {
      result.rejected.push({ raw: "mou3", jsonPointer: `${prefix}/7`, reason: "Unverified mou3 in a legacy CNS usage-only note" });
      continue;
    }
    if (typeof row[7] === "string") {
      const found = labelledPinyin(row[7], `${prefix}/7`, true);
      result.readings.push(...found.readings); result.rejected.push(...found.rejected);
    }
  }
  return result;
}

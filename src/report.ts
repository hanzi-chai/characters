export interface Coverage {
  unicodeVersion: string; sourceDate: string; total: number; known: number; missing: number; coveragePercent: number;
  includedBlocks: { name: string }[];
  direct: number; inheritedViaUnicodeDecomposition: number; polyphonic: number; supplementOnly: number;
  rejectedReadings: number; sourceDisagreements: number; cnsMappingConflicts: number;
  byBlock: { block: string; start: string; end: string; total: number; known: number; missing: number; coverage: number }[];
  bySource: { source: string; characters: number; readings: number }[];
}

export const coverageStart = "<!-- coverage:start -->";
export const coverageEnd = "<!-- coverage:end -->";

export function renderCoverage(summary: Coverage): string {
  const included = new Set(summary.includedBlocks.map(block => block.name));
  return `字符总数 **${summary.total.toLocaleString("en-US")}**；有读音 **${summary.known.toLocaleString("en-US")}**（${summary.coveragePercent}%）；缺失 **${summary.missing.toLocaleString("en-US")}**，记作 \`?\`。来源快照日期：${summary.sourceDate}。\n\n` +
    `直接来源 ${summary.direct} 字符；Unicode 分解补音 ${summary.inheritedViaUnicodeDecomposition} 字符；多读音 ${summary.polyphonic} 字符；仅补充来源收录 ${summary.supplementOnly} 字符。\n\n` +
    "| 区块 | 码点范围 | 整块收录 | 已分配字符 | 有读音 | 缺失 | 读音覆盖率 |\n|---|---|---|---:|---:|---:|---:|\n" +
    summary.byBlock.map(b => `| ${b.block} | ${b.start}–${b.end} | ${included.has(b.block) ? "是" : "—"} | ${b.total} | ${b.known} | ${b.missing} | ${b.coverage}% |`).join("\n") + "\n\n" +
    "同一字符可以被多个来源收录，以下数字不能相加。统计包含分解补音后的归属，可能高于原始文件行数。\n\n" +
    "| 来源 | 字符数 | 不同字音对 |\n|---|---:|---:|\n" +
    summary.bySource.map(s => `| ${s.source} | ${s.characters} | ${s.readings} |`).join("\n") + "\n\n" +
    `未接受的原始读音记录 ${summary.rejectedReadings} 条，含已由另一官方表成功回退的异常数字拼音，不代表同字最终缺音。${summary.sourceDisagreements} 个字符的来源读音集合不同，可能出于收录详略、古今或地区差异。CNS / Unihan 的 ${summary.cnsMappingConflicts} 处既有码点映射差异保留在审计文件中。`;
}

export function withCoverage(readme: string, section: string): string {
  const start = readme.indexOf(coverageStart), end = readme.indexOf(coverageEnd);
  if (start < 0 || end < start || readme.indexOf(coverageStart, start + 1) >= 0 || readme.indexOf(coverageEnd, end + 1) >= 0) throw new Error("README must contain exactly one coverage marker pair");
  return readme.slice(0, start + coverageStart.length) + "\n\n" + section + "\n\n" + readme.slice(end);
}

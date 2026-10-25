interface Coverage {
  unicodeVersion: string;
  sourceDate: string;
  total: number;
  known: number;
  missing: number;
  coveragePercent: number;
  direct: number;
  inheritedViaUnicodeDecomposition: number;
  polyphonic: number;
  supplementOnly: number;
  byBlock: {
    block: string;
    start: string;
    end: string;
    total: number;
    expected: number;
    known: number;
    missing: number;
    coverage: number;
  }[];
  bySource: { source: string; characters: number; readings: number }[];
}

export function renderCoverage(summary: Coverage): string {
  return (
    "统计仅反映本地已取得的资料，网页采集未必覆盖全部字符。\n\n" +
    `应收录字符总数 **${summary.total.toLocaleString("en-US")}**；有读音 **${summary.known.toLocaleString("en-US")}**（${summary.coveragePercent.toFixed(2)}%）；缺失 **${summary.missing.toLocaleString("en-US")}**，记作 \`?\`。构建日期：${summary.sourceDate}。\n\n` +
    `直接来源 ${summary.direct} 字符；Unicode 分解补音 ${summary.inheritedViaUnicodeDecomposition} 字符；多读音 ${summary.polyphonic} 字符；仅补充来源收录 ${summary.supplementOnly} 字符。\n\n` +
    "| 区块 | 码点范围 | 已分配字符 | 应收录字符 | 有读音 | 缺失 | 读音覆盖率 |\n|---|---|---:|---:|---:|---:|---:|\n" +
    summary.byBlock
      .map(
        (b) =>
          `| ${b.block} | ${b.start}–${b.end} | ${b.total} | ${b.expected} | ${b.known} | ${b.missing} | ${b.coverage.toFixed(2)}% |`,
      )
      .join("\n") +
    "\n\n" +
    "同一字符可以被多个来源收录，以下数字不能相加。统计包含分解补音后的归属，可能高于原始文件行数。\n\n" +
    "| 来源 | 字符数 | 不同字音对 |\n|---|---:|---:|\n" +
    summary.bySource.map((s) => `| ${s.source} | ${s.characters} | ${s.readings} |`).join("\n") +
    "\n"
  );
}

export function withCoverage(readme: string, section: string): string {
  return readme.replace(
    /<!-- coverage:start -->[\s\S]*?<!-- coverage:end -->/,
    `<!-- coverage:start -->\n\n${section}\n\n<!-- coverage:end -->`,
  );
}

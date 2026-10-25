import { createHash } from "node:crypto";
import { mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { webDownload, webEndpoints } from "../src/sources";

const option = (name: string, fallback: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const phase = option("source", "yedict-index");
if (!["yedict-index", "zitools-index", "yedict", "zitools"].includes(phase))
  throw new Error("Use --source=yedict-index|zitools-index|yedict|zitools");
const concurrency = Number(option("concurrency", "4"));
const interval = Number(option("interval-ms", "75"));
const limit = Number(option("limit", "Infinity"));
const cachedOnly = process.argv.includes("--cached-only");
if (
  !Number.isInteger(concurrency) ||
  concurrency < 1 ||
  concurrency > 8 ||
  !Number.isFinite(interval) ||
  interval < 25 ||
  !(limit === Infinity || (Number.isInteger(limit) && limit >= 0))
)
  throw new Error("Use 1–8 workers, at least 25 ms between requests, and a nonnegative integer limit");
const current = (await Bun.file("data/pinyin.tsv").text())
  .trimEnd()
  .split("\n")
  .slice(1)
  .map((line) => line.split("\t"));
const missing = new Set(current.filter((row) => row[3] === "missing").map((row) => parseInt(row[0].slice(2), 16)));
await mkdir("data/web-collection", { recursive: true });
let nextStart = 0,
  blockedUntil = 0,
  requests = 0,
  cached = 0,
  unavailable = 0,
  errors = 0,
  completed = 0;
let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
  console.error("Finishing in-flight requests…");
});
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function throttle() {
  const start = Math.max(Date.now(), nextStart, blockedUntil);
  nextStart = start + interval;
  await wait(Math.max(0, start - Date.now()));
}
async function getJson(path: string, url: string) {
  if (await Bun.file(path).exists()) {
    const data = await Bun.file(path).json();
    cached++;
    return data;
  }
  for (const status of [400, 404]) {
    const archive = path.replace(/\.json$/, `.http-${status}.json`);
    if (await Bun.file(archive).exists()) {
      unavailable++;
      return;
    }
  }
  if (cachedOnly) return;
  for (let attempt = 1; attempt <= 3; attempt++) {
    await throttle();
    try {
      requests++;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(25_000),
        headers: { "User-Agent": "hanzi-chai-characters/1.0 (public dictionary reading research)" },
      });
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (response.status === 404 || response.status === 400) {
        const archive = path.replace(/\.json$/, `.http-${response.status}.json`);
        await mkdir(dirname(archive), { recursive: true });
        await Bun.write(archive, bytes);
        unavailable++;
        return;
      }
      if (response.status === 429 || response.status === 503) {
        const retry = Number(response.headers.get("retry-after"));
        blockedUntil = Date.now() + Math.max(5_000 * attempt, Number.isFinite(retry) ? retry * 1000 : 0);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = JSON.parse(new TextDecoder().decode(bytes));
      await mkdir(dirname(path), { recursive: true });
      await Bun.write(`${path}.tmp`, bytes);
      await rename(`${path}.tmp`, path);
      return data;
    } catch (error) {
      if (attempt === 3 || stopping) {
        errors++;
        console.error(`failed ${path}: ${error}`);
        return;
      }
      await wait(500 * attempt);
    }
  }
}
async function workers<T>(items: T[], visit: (item: T) => Promise<void>) {
  let index = 0;
  const started = Date.now();
  const timer = setInterval(
    () =>
      console.log(
        JSON.stringify({
          phase,
          completed,
          total: items.length,
          requests,
          cached,
          unavailable,
          errors,
          seconds: Math.round((Date.now() - started) / 1000),
        }),
      ),
    10_000,
  );
  try {
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (index < items.length && !stopping) {
          const item = items[index++];
          await visit(item);
          completed++;
        }
      }),
    );
  } finally {
    clearInterval(timer);
  }
}
if (phase === "zitools-index") {
  const points = [...missing].sort((a, b) => a - b);
  const batches: number[][] = [];
  for (let i = 0; i < points.length; i += 100) batches.push(points.slice(i, i + 100));
  const candidates = new Set<number>();
  let inherited = 0,
    direct = 0;
  await workers(batches.slice(0, limit), async (batch) => {
    const chars = batch.map((cp) => String.fromCodePoint(cp)).join("");
    // Hashing only names the query cache; downloaded bytes are never compared.
    const name = createHash("sha256").update(chars).digest("hex").slice(0, 16);
    const path = `sources/zitools-index/${name}.json`;
    const data = await getJson(path, webEndpoints.zitoolsSearch(chars));
    if (data === undefined) return;
    if (!data.rows || !data.zibokrows) throw new Error(`Unexpected grouped reading response: ${path}`);
    for (const [id, row] of Object.entries(data.rows) as [
      string,
      { zi: string; path?: string; phos?: unknown[]; ton: string },
    ][]) {
      const cp = [...String(row.zi)].length === 1 ? row.zi.codePointAt(0) : undefined;
      if (!id.startsWith("cn:") || cp === undefined || !batch.includes(cp)) continue;
      if (row.path || row.phos?.length) {
        inherited++;
        continue;
      }
      if (!/^[1-5]$/.test(row.ton)) continue;
      direct++;
      candidates.add(cp);
    }
  });
  await Bun.write(
    "data/web-collection/zitools-candidates.json",
    `${JSON.stringify([...candidates].sort((a, b) => a - b))}\n`,
  );
  console.log(JSON.stringify({ phase, candidates: candidates.size, direct, inherited, errors }));
} else if (phase === "yedict-index") {
  const index = await getJson("sources/yedict-index/syllables.json", webEndpoints.yedictSyllables);
  if (index === undefined) throw new Error("Missing syllable index");
  const syllables = index.syllables;
  const candidates = new Set<number>();
  let pages = 0;
  await workers(syllables.slice(0, limit), async ({ py }: { py: string }) => {
    for (let page = 1, total = Infinity; (page - 1) * 200 < total; page++) {
      const path = `sources/yedict-index/${encodeURIComponent(py)}-${page}.json`;
      const data = await getJson(path, webEndpoints.yedictSearch(py, page));
      if (data === undefined) break;
      if (!Array.isArray(data.items) || !Number.isInteger(data.total) || data.page_size !== 200 || data.page !== page)
        throw new Error(`Unexpected search response: ${path}`);
      total = data.total;
      pages++;
      for (const item of data.items) {
        if (!/^U[0-9A-F]{5}$/.test(item.ziid)) continue;
        const cp = parseInt(item.ziid.slice(1), 16);
        if (
          missing.has(cp) &&
          item.zi === String.fromCodePoint(cp) &&
          item.pinyins?.some(
            (reading: { py: unknown; tone: number }) =>
              typeof reading.py === "string" && [1, 2, 3, 4, 5].includes(reading.tone),
          )
        )
          candidates.add(cp);
      }
    }
  });
  await Bun.write(
    "data/web-collection/yedict-candidates.json",
    `${JSON.stringify([...candidates].sort((a, b) => a - b))}\n`,
  );
  console.log(JSON.stringify({ phase, syllables: syllables.length, pages, candidates: candidates.size, errors }));
} else {
  const source = phase as "yedict" | "zitools";
  let targets: number[] = [...missing];
  const targetFile = option("targets", source === "yedict" ? "data/web-collection/yedict-candidates.json" : "");
  if (targetFile) targets = (await Bun.file(targetFile).json()).filter((cp: number) => missing.has(cp));
  // Scan Han ideographs before the extra symbol blocks: dictionary APIs often
  // do not serve symbols at all, and some such requests time out.
  const han = (cp: number) => (cp >= 0x3400 && cp <= 0x9fff) || (cp >= 0x20000 && cp <= 0x33479);
  targets = targets.sort((a, b) => Number(han(b)) - Number(han(a)) || a - b).slice(0, limit);
  await workers(targets, async (cp) => {
    const { path, url } = webDownload(source, cp);
    const data = await getJson(path, url);
    if (data === undefined) return;
    const valid = source === "yedict" ? data.ziid && data.property : data.yi && data.__zi;
    if (!valid) {
      errors++;
      return;
    }
  });

  const summary = {
    phase,
    completed,
    total: targets.length,
    requests,
    cached,
    unavailable,
    errors,
    stopped: stopping,
    cachedOnly,
  };
  console.log(JSON.stringify(summary));
}
if (errors) process.exitCode = 1;

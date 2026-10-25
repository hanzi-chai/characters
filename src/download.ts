import { mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";

interface DownloadSource {
  path: string;
  url: string;
}

export function refreshSelection(args: string[], sources: DownloadSource[]): Set<string> {
  if (args.length === 0) return new Set();
  if (args[0] !== "--refresh") throw new Error("Usage: bun run download [--refresh [sources/path ...]]");
  const paths = args.slice(1);
  for (const path of paths) {
    if (!sources.some((source) => source.path === path)) throw new Error(`Unknown refresh source: ${path}`);
  }
  return new Set(paths.length ? paths : sources.map((source) => source.path));
}

export async function downloadSource(source: DownloadSource, refresh: boolean): Promise<void> {
  await mkdir(dirname(source.path), { recursive: true });
  if (!refresh && (await Bun.file(source.path).exists())) {
    console.log(`cached ${source.path}`);
    return;
  }
  let bytes: Uint8Array | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      bytes = new Uint8Array(await response.arrayBuffer());
      break;
    } catch (error) {
      if (attempt === 3) throw new Error(`${source.url}: ${error}`);
    }
  }
  if (!bytes?.length) throw new Error(`Empty download: ${source.url}`);
  await Bun.write(`${source.path}.tmp`, bytes);
  await rename(`${source.path}.tmp`, source.path);
  console.log(`downloaded ${source.path}`);
}

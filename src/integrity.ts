import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
export async function filesIn(dir: string): Promise<string[]> {
  const result: string[] = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) result.push(...await filesIn(path));
    else if (item.isFile()) result.push(path);
  }
  return result.sort();
}
export interface SourceLock { schema: 1; unicodeVersion: string; collectedOn: string; files: { path: string; bytes: number; sha256: string; url: string }[] }
export async function verifySources(): Promise<SourceLock> {
  const lock: SourceLock = await Bun.file("sources.lock.json").json();
  for (const f of lock.files) {
    const bytes = new Uint8Array(await Bun.file(f.path).arrayBuffer());
    if (bytes.length !== f.bytes || sha256(bytes) !== f.sha256) throw new Error(`Source checksum mismatch: ${f.path}`);
  }
  return lock;
}

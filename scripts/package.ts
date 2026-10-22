import { mkdir } from "node:fs/promises";
import { sha256 } from "../src/integrity";
await mkdir("dist", { recursive: true });
const archive = "dist/unicode-18.0.0-hanzi-pinyin.tar.gz";
const result = Bun.spawn(["tar", "-czf", archive, "README.md", "AGENTS.md", "package.json", ".gitignore", "sources.lock.json", "src", "scripts", "test", "sources", "data"], {
  env: { ...process.env, COPYFILE_DISABLE: "1" }, stdout: "inherit", stderr: "inherit",
});
if (await result.exited !== 0) throw new Error("Packaging failed");
const bytes = new Uint8Array(await Bun.file(archive).arrayBuffer());
await Bun.write(archive + ".sha256", `${sha256(bytes)}  ${archive.split("/").at(-1)}\n`);
console.log(`${archive} (${(bytes.length / 1024 / 1024).toFixed(2)} MiB)`);

import { codepoint } from "../src/pinyin";
const args = process.argv.slice(2);
if (!args.length) {
  console.log("Usage: bun run lookup 张行绿 U+33472 [--evidence]");
  process.exit(0);
}
const requested = new Set(args.filter(arg => !arg.startsWith("--")).flatMap(arg => /^U\+[0-9A-F]{4,6}$/i.test(arg) ? [String.fromCodePoint(parseInt(arg.slice(2), 16))] : [...arg]));
const data = await Bun.file("data/pinyin.json").json();
for (const char of requested) console.log(`${codepoint(char.codePointAt(0)!)}\t${char}\t${data[char]?.join(",") ?? "(outside repertoire)"}`);
if (args.includes("--evidence")) {
  for (const line of (await Bun.file("data/evidence.jsonl").text()).split("\n")) {
    if (!line) continue;
    const row = JSON.parse(line);
    if (requested.has(row.char)) console.log(JSON.stringify(row, null, 2));
  }
}

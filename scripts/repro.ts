import assert from "node:assert/strict";
const before = await Bun.file("data/manifest.json").text();
const process = Bun.spawn(["bun", "scripts/build.ts"], { stdout: "inherit", stderr: "inherit" });
assert.equal(await process.exited, 0);
assert.equal(await Bun.file("data/manifest.json").text(), before, "Output changed on identical source snapshot");
console.log("Rebuild is byte-for-byte identical for every generated data file.");

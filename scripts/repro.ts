import assert from "node:assert/strict";
const before = await Bun.file("data/manifest.json").text();
const readme = await Bun.file("README.md").text();
const child = Bun.spawn(["bun", "scripts/build.ts"], { stdout: "inherit", stderr: "inherit" });
assert.equal(await child.exited, 0);
assert.equal(await Bun.file("data/manifest.json").text(), before, "Output changed on identical source snapshot");
assert.equal(await Bun.file("README.md").text(), readme, "README coverage changed on identical source snapshot");
console.log("Rebuild is byte-for-byte identical for every generated data file and README coverage.");

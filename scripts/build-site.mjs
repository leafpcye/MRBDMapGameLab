import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateBuildInfo } from "./generate-build-info.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
const files = [
  "index.html",
  "geo-parity.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "sw.js"
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of files) {
  await cp(path.join(root, file), path.join(output, file));
}
await cp(path.join(root, "modules"), path.join(output, "modules"), { recursive: true });
await writeFile(path.join(output, ".nojekyll"), "", "utf8");

const { buildInfo } = await generateBuildInfo(path.join(output, "build-info.js"));

async function summarize(directory) {
  let fileCount = 0;
  let totalBytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const child = await summarize(entryPath);
      fileCount += child.fileCount;
      totalBytes += child.totalBytes;
    } else if (entry.isFile()) {
      fileCount += 1;
      totalBytes += (await stat(entryPath)).size;
    }
  }
  return { fileCount, totalBytes };
}

const summary = await summarize(output);
console.log(`Site build complete: ${summary.fileCount} files, ${summary.totalBytes} bytes`);
console.log(`Build: v${buildInfo.version} (${buildInfo.gitCommit})`);
console.log(`Output: ${output}`);

import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const valueAfter = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index === -1 ? fallback : args[index + 1];
};
const root = path.resolve(projectRoot, valueAfter("--root", "."));
if (root !== projectRoot && !root.startsWith(`${projectRoot}${path.sep}`)) {
  throw new Error(`--root must stay inside ${projectRoot}`);
}
const mountValue = valueAfter("--mount", "/");
const mount = `/${mountValue.replace(/^\/+|\/+$/g, "")}${mountValue === "/" ? "" : "/"}`;
const host = "127.0.0.1";
const port = Number(process.env.PORT || 4173);
const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json; charset=utf-8"]
]);

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${host}:${port}`);
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Bad Request");
      return;
    }
    let servedPath = pathname;
    if (mount !== "/" && pathname.startsWith(mount)) servedPath = pathname.slice(mount.length - 1);
    const relative = servedPath === "/" ? "index.html" : servedPath.replace(/^\/+/, "");
    const filePath = path.resolve(root, relative);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }
    const info = await stat(filePath);
    if (!info.isFile()) throw Object.assign(new Error("Not a file"), { code: "ENOENT" });
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes.get(path.extname(filePath)) || "application/octet-stream",
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff"
    });
    if (request.method === "HEAD") response.end();
    else response.end(body);
  } catch (error) {
    const status = error?.code === "ENOENT" || error?.code === "ENOTDIR" ? 404 : 500;
    response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    response.end(status === 404 ? "Not Found" : "Internal Server Error");
  }
});

server.listen(port, host, () => {
  console.log(`MRBD Phase 1A probe running at http://localhost:${port}`);
  console.log(`Serving: ${root}`);
  if (mount !== "/") console.log(`Project path: http://localhost:${port}${mount}`);
  console.log("Press Ctrl+C to stop.");
});

function shutdown() {
  console.log("\nStopping server…");
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

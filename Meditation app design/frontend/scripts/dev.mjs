import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodeBin = process.execPath;
const viteEntry = path.join(root, "node_modules", "vite", "bin", "vite.js");
const serverEntry = path.join(root, "server", "index.mjs");

const children = [
  spawn(nodeBin, [serverEntry], { cwd: root, stdio: "inherit" }),
  spawn(nodeBin, [viteEntry], { cwd: root, stdio: "inherit" }),
];

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

for (const child of children) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      shutdown(code);
    }
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

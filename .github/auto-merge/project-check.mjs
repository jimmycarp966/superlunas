// Runs only in the unprivileged pull_request job: no production secrets and no
// write token. Expensive application checks are unnecessary for policy/docs.
import { readFileSync, existsSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { matchesPath } from "./policy.mjs";

const config = JSON.parse(readFileSync(new URL("./config.json", import.meta.url), "utf8"));
const project = existsSync("package.json") ? JSON.parse(readFileSync("package.json", "utf8")) : {};
const dependencies = { ...project.dependencies, ...project.devDependencies };
// Node cannot parse JSX in .js files. Framework projects use their configured
// compiler; plain JavaScript projects still receive a syntax check.
const usesJsx = ["react", "react-dom", "react-native", "next", "preact", "solid-js"].some(name => name in dependencies);
const files = execFileSync("git", ["diff", "--name-only", "-z", "HEAD^1", "HEAD"], { encoding: "utf8" }).split("\0").filter(Boolean);
execFileSync("git", ["diff", "--check", "HEAD^1", "HEAD"], { stdio: "inherit" });
function run(command) {
  const result = spawnSync(command[0], command.slice(1), { stdio: "inherit", env: { ...process.env, CI: "true" } });
  if (result.error || result.status !== 0) throw new Error(`Falló el control ${command.join(" ")}.`);
}
for (const file of files.filter(file => existsSync(file))) {
  if (/\.(mjs|cjs)$/.test(file) || (!usesJsx && /\.js$/.test(file))) run([process.execPath, "--check", file]);
  if (/\.py$/.test(file)) run(["python3", "-c", "import ast, pathlib, sys; ast.parse(pathlib.Path(sys.argv[1]).read_bytes(), filename=sys.argv[1])", file]);
  if (["package.json", "package-lock.json", ".github/auto-merge/config.json"].includes(file)) JSON.parse(readFileSync(file, "utf8"));
}
for (const test of config.releaseTests ?? []) run([process.execPath, "--test", test]);
const infrastructure = [".github/**", "docs/**", "**/*.md", "**/*.txt", ...(config.releaseFiles ?? [])];
if (files.every(file => infrastructure.some(pattern => matchesPath(file, pattern)))) {
  console.log("Cambio de automatización/documentación: reglas, sintaxis y pruebas de release verificadas; no cambia la aplicación.");
  process.exit(0);
}
const check = config.projectCheck;
const commands = check?.commands ?? (check?.command?.length ? [check.command] : []);
if (!commands.length) {
  console.log("Este proyecto no define un compilador o test automático adicional. Se verificaron sintaxis, diff y controles externos configurados.");
  process.exit(0);
}
if (check.install?.length) run(check.install);
for (const command of commands) run(command);

import { spawn } from "node:child_process";
import { build } from "esbuild";
import { writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CompileReport } from "../../src/build-script/compile";
import { hash } from "./part-reference";
export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export type Compilation = {
  script?: unknown;
  report?: CompileReport;
  ldraw?: string;
  failure?: string;
};

export async function bundleCompiler(out: string) {
  const result = await build({
    entryPoints: [join(ROOT, "scripts/spatial-benchmark/compile-worker.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    metafile: true,
    target: "node22",
  });
  const forbidden = Object.keys(result.metafile!.inputs).filter((p) =>
    /(?:^|\/)(?:render|gallery|evaluator|fixtures|samples)(?:\/|\.)/.test(p),
  );
  if (forbidden.length)
    throw new Error(
      `Compiler imports forbidden observation dependencies: ${forbidden.join(", ")}`,
    );
  await writeFile(
    out + ".inputs.json",
    JSON.stringify(result.metafile!.inputs, null, 2) + "\n",
  );
  const code = result.outputFiles[0].contents;
  await writeFile(out, code);
  return hash(code);
}
/** Failure to establish isolation is fatal. Never fall back to a host VM. */
function isolationArgs(worker: string) {
  const runtime = dirname(process.execPath);
  return [
    "--unshare-all",
    "--die-with-parent",
    "--new-session",
    "--clearenv",
    "--setenv",
    "PATH",
    "/runtime",
    "--ro-bind",
    runtime,
    "/runtime",
    "--ro-bind",
    "/usr/lib",
    "/usr/lib",
    "--ro-bind",
    "/lib",
    "/lib",
    // x86 Linux uses /lib64 for the ELF loader; ARM may not have it.
    "--ro-bind-try",
    "/lib64",
    "/lib64",
    "--proc",
    "/proc",
    "--dev",
    "/dev",
    "--tmpfs",
    "/tmp",
    "--dir",
    "/scripts",
    "--ro-bind",
    worker,
    "/scripts/worker.mjs",
    "--ro-bind",
    join(ROOT, "public/libraries"),
    "/public/libraries",
    "--chdir",
    "/tmp",
  ];
}
export async function isolatedCompile(
  worker: string,
  input: {
    code: string;
    seed: number;
    target?: number;
    aliases?: Record<string, string> | null;
  },
  timeoutMs: number,
  maxBytes: number,
): Promise<Compilation> {
  const args = [
    ...isolationArgs(worker),
    "/runtime/node",
    "--max-old-space-size=384",
    "/scripts/worker.mjs",
  ];
  return new Promise((resolve, reject) => {
    const child = spawn("bwrap", args, {
      env: { PATH: "/usr/bin:/bin" },
      stdio: ["pipe", "pipe", "pipe"],
      detached: true,
    });
    let output = "",
      error = "",
      size = 0,
      stopped = "";
    const stop = (reason: string) => {
      stopped = reason;
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    };
    const timer = setTimeout(
      () => stop("Compiler compute budget exceeded"),
      timeoutMs,
    );
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.stdout.on("data", (b: Buffer) => {
      size += b.length;
      if (size > maxBytes) stop("Compiler output budget exceeded");
      else output += b.toString();
    });
    child.stderr.on("data", (b: Buffer) => {
      if (error.length < 4000)
        error += b.toString().slice(0, 4000 - error.length);
    });
    child.stdin.on("error", () => {});
    child.stdin.end(
      JSON.stringify({ ...input, codeTimeoutMs: Math.min(10000, timeoutMs) }),
    );
    child.on("close", (code) => {
      clearTimeout(timer);
      if (stopped) return resolve({ failure: stopped });
      if (code !== 0)
        return reject(
          new Error(`Compiler isolation/process failure (${code}): ${error}`),
        );
      try {
        resolve(JSON.parse(output));
      } catch {
        reject(new Error("Compiler returned invalid host protocol"));
      }
    });
  });
}
export async function verifyFile(file: string, expected: string) {
  if (hash(await readFile(file)) !== expected)
    throw new Error(`Frozen artifact changed: ${file}`);
}

/** Trusted host probe of the identical filesystem/network/environment namespace. */
export async function isolationProbe(
  worker: string,
): Promise<{ root: string[]; env: string[]; route: string; denied: string[] }> {
  const code = `const fs=require("node:fs");const paths=["/home/ubuntu/brick-editor","/home/ubuntu/.codex","/evaluator","/credentials","/docs","/fixtures"];process.stdout.write(JSON.stringify({root:fs.readdirSync("/"),env:Object.keys(process.env),route:fs.readFileSync("/proc/net/route","utf8"),denied:paths.filter(p=>!fs.existsSync(p))}));`;
  return new Promise((resolve, reject) => {
    const child = spawn(
      "bwrap",
      [...isolationArgs(worker), "/runtime/node", "-e", code],
      { env: { PATH: "/usr/bin:/bin" }, stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "",
      err = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 10000);
    child.stdout.on("data", (b) => (out += b));
    child.stderr.on("data", (b) => (err += b));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (n) => {
      clearTimeout(timer);
      if (n !== 0) reject(new Error(`Isolation probe failed: ${err}`));
      else
        try {
          resolve(JSON.parse(out));
        } catch {
          reject(new Error("Invalid isolation probe"));
        }
    });
  });
}

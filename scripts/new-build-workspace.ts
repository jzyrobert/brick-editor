#!/usr/bin/env node
// Sets up a clean directory for a build agent: the build-agent prompt with the
// brief and part budget filled in (AGENTS.md, and CLAUDE.md pointing at it), a
// ./brick-cli wrapper that holds every build to the budget, and views/.
// docs/AGENT-BUILDING.md#agent-workspaces
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const REPO = fileURLToPath(new URL("../", import.meta.url)).replace(
  /[\\/]$/,
  "",
);

const HELP = `npm run workspace -- --max-parts N[,N…] (--brief "…" | --brief-file brief.txt|-)
    [--name lighthouse] [--root ~/brick-builds] [--dir path]
  --max-parts  part budget; several (1000,4000,12000) make one workspace each
  --brief      what to build (--brief-file reads it from a file, - for stdin)
  --name       folder name (default: from the brief); workspaces are <root>/<name>-<parts>
  --root       where workspaces go (default ~/brick-builds; must be outside this repo)
  --dir        exact folder, for a single budget`;

/** Text below the first "---" line of a prompt file. */
function below(file: string) {
  const text = readFileSync(join(REPO, "prompts", file), "utf8");
  const at = text.indexOf("\n---\n");
  if (at < 0) throw new Error(`prompts/${file} has no --- line`);
  return text.slice(at + 5).trim();
}

const OUTPUT_LINE =
  "Return ONLY one JSON object (no markdown, no commentary). If the interface supports files, return it as `build.json`.";

/** The build-agent prompt for a workspace, with brief and budget filled in. */
export function workspacePrompt(brief: string, maxParts: number) {
  const agent = below("build-agent.md");
  const workspace = below("build-workspace.md");
  const firstSection = agent.indexOf("\n## ");
  if (!agent.includes(OUTPUT_LINE) || firstSection < 0)
    throw new Error(
      "prompts/build-agent.md changed: update new-build-workspace.ts",
    );
  const text =
    agent.slice(0, firstSection).trimEnd() +
    "\n\n" +
    workspace +
    "\n" +
    agent
      .slice(firstSection)
      .replace(
        OUTPUT_LINE,
        "Write the script to `build.json` (see Workspace): one JSON object in this shape.",
      )
      .replaceAll("`brick-cli ", "`./brick-cli ");
  // Functions as replacements: a brief may contain "$&" and the like.
  return (
    text
      .replaceAll("{{MAX_PARTS}}", () => maxParts.toLocaleString("en-US"))
      .replaceAll("{{BRIEF}}", () => brief.trim()) + "\n"
  );
}

const shellQuote = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;

/** ./brick-cli: the repository's CLI, with `build` held to the budget. */
export function wrapperScript(
  maxParts: number,
  repo = REPO,
  node = process.execPath,
) {
  return `#!/usr/bin/env bash
# Brick Editor CLI for this workspace. Every build is held to ${maxParts} parts
# (a duplicate --max-parts is refused).
set -euo pipefail
REPO=${shellQuote(repo)}
NODE=${shellQuote(node)}
if [[ \${1-} == build ]]; then set -- "$@" --max-parts ${maxParts}; fi
exec "$NODE" "$REPO/node_modules/tsx/dist/cli.mjs" "$REPO/scripts/brick-cli.ts" "$@"
`;
}

export function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(" ")
      .filter((w, i) => i > 0 || !["a", "an", "the"].includes(w))
      .slice(0, 4)
      .join("-") || "build"
  );
}

function commit() {
  try {
    return execFileSync("git", ["-C", REPO, "rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return undefined;
  }
}

/** Creates one workspace; the folder must be new or empty and outside the repo. */
export async function createWorkspace(
  dir: string,
  brief: string,
  maxParts: number,
  name: string,
) {
  dir = resolve(dir);
  if (dir === REPO || dir.startsWith(REPO + sep))
    throw new Error(
      `${dir} is inside the repository: the agent would read its coding instructions. Choose a folder outside ${REPO}.`,
    );
  if (existsSync(dir) && readdirSync(dir).length)
    throw new Error(`${dir} is not empty: choose another --name or --dir`);
  await mkdir(join(dir, "views"), { recursive: true });
  await writeFile(join(dir, "AGENTS.md"), workspacePrompt(brief, maxParts));
  await writeFile(join(dir, "CLAUDE.md"), "@AGENTS.md\n");
  await writeFile(join(dir, "brick-cli"), wrapperScript(maxParts));
  await chmod(join(dir, "brick-cli"), 0o755);
  await writeFile(
    join(dir, "workspace.json"),
    JSON.stringify(
      {
        name,
        maxParts,
        brief: brief.trim(),
        created: new Date().toISOString(),
        repo: REPO,
        commit: commit(),
      },
      null,
      2,
    ) + "\n",
  );
  return dir;
}

async function main(argv: string[]) {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, "");
    if (key === "help" || !argv[i].startsWith("--")) {
      console.log(HELP);
      return key === "help" ? 0 : 1;
    }
    if (
      !["max-parts", "brief", "brief-file", "name", "root", "dir"].includes(key)
    )
      throw new Error(`Unknown flag ${argv[i]}\n${HELP}`);
    if (argv[i + 1] === undefined)
      throw new Error(`Missing value for ${argv[i]}`);
    flags.set(key, argv[++i]);
  }
  const budgets = (flags.get("max-parts") ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number);
  if (!budgets.length || budgets.some((n) => !Number.isInteger(n) || n <= 0))
    throw new Error(`--max-parts needs positive whole numbers\n${HELP}`);
  const file = flags.get("brief-file");
  const brief =
    flags.get("brief") ??
    (file ? readFileSync(file === "-" ? 0 : file, "utf8") : "");
  if (!brief.trim()) throw new Error(`Give --brief or --brief-file\n${HELP}`);
  if (flags.has("dir") && budgets.length > 1)
    throw new Error("--dir takes a single budget; use --root for several");
  const name = slug(flags.get("name") ?? brief);
  const root = resolve(
    (flags.get("root") ?? "~/brick-builds").replace(/^~(?=$|\/)/, homedir()),
  );
  const dirs: string[] = [];
  for (const n of budgets)
    dirs.push(
      await createWorkspace(
        flags.get("dir")?.replace(/^~(?=$|\/)/, homedir()) ??
          join(root, `${name}-${n}`),
        brief,
        n,
        name,
      ),
    );
  for (const [i, d] of dirs.entries())
    console.log(`${d}  (${budgets[i]} parts)`);
  console.log(
    `\nStart an agent in a workspace, e.g.\n  cd ${shellQuote(dirs[0])} && claude`,
  );
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main(process.argv.slice(2)).then(
    (code) => (process.exitCode = code),
    (e: Error) => {
      console.error(e.message);
      process.exitCode = 1;
    },
  );

# Build workspace section

`npm run workspace` adds everything below the line to [build-agent.md](build-agent.md) (after its opening paragraph) in a new workspace's `AGENTS.md`, and points the Output section at `build.json`. `{{TARGET_PARTS}}` is the workspace's part target.

---

## Workspace

You are working in a directory of your own, with the compiler as a command.

- Write the script to `build.json` here and keep it up to date: that file is your answer.
- Run the compiler as `./brick-cli` (wherever this prompt says `brick-cli`). Every build's summary has a `size:` line: its part count against the target of {{TARGET_PARTS}} (e.g. `+137, +6.9%`), the sections by size and the costliest ops. Use it to land on the target; a build of any size is still written.
  - `./brick-cli build --script build.json --output build.mpd --render views/build.png --views iso,front,iso-back`
  - `./brick-cli build --reference` prints every op with its fields; `./brick-cli build --schema` prints the JSON Schema.
  - `./brick-cli parts search "words" [--size 1x2] [--colour red --available]` finds parts.
- Open the rendered views (PNG files) and look at them before you decide the build is finished.

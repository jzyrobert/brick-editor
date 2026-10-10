# Gallery and interactive models

Gallery and Play are the primary modes. The cream workshop shell gives model
images most of the browsing space; Build, Instructions, Photo and Project are
available through **Tools** for the same open document.

## Browsing responses

Gallery opens on the whole collection, with responses grouped by their prompt.
Search matches prompt names, full briefs, build titles, AI model names and
reasoning efforts; it ignores case and accents and matches every entered word.
Combine **Prompt** and **AI model** to compare one brief or follow one model
across briefs. **View prompt** narrows directly to a group's prompt. Result
counts describe the matching collection, and **Clear filters** returns to all
builds. Empty results keep the controls and offer the same reset.

**More filters** reveals reasoning effort and sorting (newest builds or prompt
A–Z). The shared viewing angles are always visible on desktop. Phones keep one
compact search row with **Filters**, which unfolds prompt, model, effort,
sorting and viewing angles together. Active choices stay visible in a short
summary with **Clear filters** while folded; the Filters button counts active
prompt/model/effort choices. Desktop keeps a direct removal control for a folded
effort filter.
Prompts show six groups at a time, with **Show more prompts** for the rest;
filtering or sorting starts from the first six again. Phones stack responses
vertically, including prompts with more than two builds. **Read the prompt**
reveals the full brief; its target part count is visible in the disclosure.

Every response is a build published to the
[agent gallery](GALLERY-PLAN.md), read from `index.json` on
`https://gallery.bricks.robertj.in` (`src/catalog/gallery-index.ts`, mapped for
the page by `galleryPrompts` in `src/catalog/gallery.ts`). Prompt names come
from `gallery:publish --prompt-name` (migration `0002_prompt_names.sql`) or,
without a name, the brief. Newest sorts groups by their newest matching build;
prompt A–Z retains the original model/effort ordering within each group.
Titles are the build scripts' own. Pictures are the published renders
(Realistic look, 1,280 × 960 WebP, corner, front and back). Look closer opens
the existing detail page with its live preview and model tools.

Search, filters, sort, viewing angle, expanded controls, loaded prompt groups
and scroll are kept for the current visit when returning from a detail page,
Play or a model tool. They reset on a fresh page load.

### E comparison collection

The reviewed E collection contains six prompts and three high-effort responses
per prompt. Sol and Astra reuse the existing text-only E builds; Opus revises
the same original Sol sources with matching E input. Generation receives no
images or render feedback. These are source-conditioned revisions rather than
fresh generations from the briefs alone.

| Prompt (target parts)           | GPT-6.1-Sol, high | GPT-6-Astra, high | Claude Opus 5.5, high |
| ------------------------------- | ----------------: | ----------------: | --------------------: |
| Pelican on a bicycle (800)      |               918 |               884 |                   871 |
| Imperial Star Destroyer (5,000) |             5,334 |             5,272 |                 5,434 |
| Dragon (1,000)                  |             1,146 |             1,072 |                 1,108 |
| Piplup (1,000)                  |             1,007 |             1,037 |                 1,028 |
| Japanese temple (2,000)         |             2,200 |             2,297 |                 2,190 |
| Ewok Classic Space (3,000)      |             3,517 |             3,181 |                 3,347 |

[The study](samples/lego-style-study/README.md#e-with-opus-55-high-and-gallery-replacement)
retains all inputs, sources, warnings and comparison previews. All omit
baseplate parts, while allowing local plate-built supports. Compiler
acceptance does not certify physical buildability.

The [publication manifest](samples/lego-style-study/gallery-publication/manifest.json)
records the 18 replacement IDs, the 12 previous creative-prompt IDs and all
108 immutable files. The main-only **Publish reviewed E gallery builds**
workflow requires successful validation of that main commit, verifies the
bundle and live roster, uploads assets, hides those exact older entries and
rebuilds the index. The 7 October creative runs remain in
[the previous comparison](samples/creative-prompt-comparison/README.md), and
are retained as hidden history by the replacement SQL. The collection is live,
and all 108 public files and cache headers are verified. The first gallery
workflow run stopped at its initial D1 read; publication used the authenticated
owner connection after successful main validation/deployment. Gallery CI
access remains an open TODO. Two gallery-only Cache Response Rules preserve
immutable files and the one-minute index lifetime independently of the upload
client. See [the publication receipt](reports/e-gallery-publication.json).

Earlier builds were hidden with `gallery:publish -- --hide <id> --remote`
(`hidden = 1`), not deleted: their files stay in the bucket, and
`wrangler d1 execute brick-gallery --remote --command "UPDATE builds SET hidden = 0 WHERE id = '<id>'"`
followed by `gallery:publish -- --reindex --remote` shows one again. Their
sources are in this repository:

| Build ids                                                                      | Source run                                                                                                      |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `958cde77dd13`, `dde67769d031`, `d7785d3317b1`, `92acccf2e77f`, `76bb0a378a18` | Temple, Opus 5.5 low to max: [run 4's rules](samples/japanese-temple-one-shot-claude-target/README.md)          |
| `f73a80655c20`, `d31573564fba`, `76b6aa339c11`, `fa0ab5bc241d`, `31238c829501` | Temple, GPT-6.1-Sol low to max: [run 4](samples/japanese-temple-one-shot-target/README.md)                      |
| `3b95f8e1f971`, `1570abb271a7`                                                 | Ewok Classic Space, Opus 5.5 high, 1,000 and 3,000 parts: [ewok samples](samples/ewok-space-one-shot/README.md) |

## The detail page and its live view

Look closer shows the build's facts (parts, model time, cost, replies,
warnings), its source run and the tools. Its stage is a live, spinnable 3D view
in the Realistic look (`src/ui/GalleryPreview.tsx`): a second, small scene
without the grid that fetches the build's MPD, checks it against the index and
fades in over the still picture. The angle tabs swing its camera to the same
framing as the pictures, lifted clear of the tabs, and turning stops above the
ground. It loads when the page opens on every device; only a browser asking to
save data (`navigator.connection.saveData`) shows the picture with **Spin in
3D** first. A failed view keeps the pictures and offers **Try again**. The scene
is freed when the page closes, so at most one preview and the workspace exist
together. `?gallery=<id>` opens a build's page.

Browser Back (and a phone's back gesture) steps from Play or a tool to the
detail page and then the list instead of leaving the site; Escape closes the
detail page, which opens at its top while the list keeps its scroll (also
across a trip through Play). A detail page's address carries `?gallery=<id>`, so
reloading or sharing it opens the same build. The list marks the build that is
open now (**Open now**, **Continue**).

## Opening and editing

Explore fetches the build's MPD, checks its size, SHA-256 and library release
against the index, imports it as a new local project and opens Play; the build
already open resumes instead. Choose a tool from a detail page to open the same
build in that tool. Play is the first row of **Tools**, so every tool can return
to it, and the current view is marked. The header's Play walks the build on a
detail page, or the first build when nothing is open. Enter Play says
**Opening…** and then **Loading N%** until every part is in place; Exit Play
stays on the model with the entry dock. On a phone held upright Play suggests
turning sideways with a dismissible hint (**Keep portrait**).
The existing editor, instruction viewer, photo controls, project library,
import/export, autosave and automation services remain in use.

Opening a different response uses the existing save/discard/cancel protection
for changed projects. Browsing Gallery does not replace the current document or
enable editing shortcuts on the hidden workspace. Returning to Play resumes the
current document; active walking ends when returning to Gallery. Play begins
from a compact entry dock, with mechanisms, world layers and key settings behind
Play settings. Once walking starts, the model title steps aside for the existing
Pause control. Tools remain accessible.

Open your model imports local LDraw files, backups or build scripts. Phone users
can use Open your model in the gallery footer or Open file through Project in
the model tool menu. Share-preview links
still open Project. `?automation=1` starts in Build for the existing API clients
and browser tools; Gallery remains reachable from the main switch.

## Sources, availability and offline behavior

Builds come from one-shot runs published with `npm run gallery:publish`
([GALLERY-PLAN](GALLERY-PLAN.md)); each detail page names its source run. The
app reads the published index only on https pages: local and test servers need
`?galleryIndex=1`, and browser tests mock the bucket
(`tests/browser/helpers/gallery.ts`).

Gallery needs a connection. Offline, or when the index can't load, it says so
with **Try again** and **Open your model**; builds opened before stay in Cache
Storage and open again offline. A failed or damaged build keeps the current
document and says so where the person is looking (beside Explore on a detail
page), naming the build, with **Try again** and the technical reason in small
print.

The font is local Bricolage Grotesque; retain `public/notices/BRICOLAGE.txt`.
Existing LDraw notices remain required. No accounts, uploads, analytics or
generation service was added.

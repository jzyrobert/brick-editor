# Gallery and interactive models

Gallery and Play are the primary modes. The cream workshop shell gives model
images most of the browsing space; Build, Instructions, Photo and Project are
available through **Tools** for the same open document.

## Browsing responses

Gallery opens by default. Each prompt is a head-to-head: the same brief answered
once by each model (today Claude Opus 5.5 and GPT-6.1-Sol, both at high effort,
with the [creative prompt](samples/creative-prompt-comparison/README.md)). Pick
a prompt by its short name, change the shared viewing angle, and compare the
pair side by side; phones use a native prompt chooser and stack the pair. Look
closer opens a larger preview with generation notes and direct access to each
model tool.

Every response is a build published to the
[agent gallery](GALLERY-PLAN.md), read from `index.json` on
`https://gallery.bricks.robertj.in` (`src/catalog/gallery-index.ts`, mapped for
the page by `galleryPrompts` in `src/catalog/gallery.ts`). A prompt's tab shows
its `name` (set with `gallery:publish --prompt-name`, migration
`0002_prompt_names.sql`) or, without one, its brief. Builds are ordered by
model, then reasoning effort; the heading counts the models ("One brief. Two
models.") or, when one model answered more than once, the takes, and a line
under the controls says which models answered at what effort. Titles are the
build scripts' own. Pictures are the published renders (Realistic look,
1,280 × 960 WebP, corner, front and back).

### What is published

| Prompt (target parts)           | Claude Opus 5.5, high | GPT-6.1-Sol, high |
| ------------------------------- | --------------------- | ----------------- |
| Pelican on a bicycle (800)      | 760                   | 852               |
| Imperial Star Destroyer (5,000) | 4,813                 | 4,844             |
| Dragon (1,000)                  | 1,064                 | 1,138             |
| Piplup (1,000)                  | 936                   | 1,056             |
| Japanese temple (2,000)         | 1,819                 | 2,195             |
| Ewok Classic Space (3,000)      | 2,680                 | 3,294             |

All twelve are one-shot runs of 7 October 2026 with the creative prompt; their
sources, renders and the current-prompt runs they were compared with are in
[docs/samples/creative-prompt-comparison](samples/creative-prompt-comparison/README.md).

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

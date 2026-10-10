# Gallery and interactive models

Gallery and Play are the primary modes. The cream workshop shell gives model
images most of the browsing space; Build, Instructions, Photo and Project are
available through **Tools** for the same open document.

## Browsing responses

Gallery opens on the latest fresh **E** generation, with responses grouped by their prompt. Earlier text-only generations remain available through **Prompt generation**; **All generations** includes the full published history. Fresh E is selected explicitly, even when an F experiment ran later.
Search matches prompt names, full briefs, build titles, AI model names and
reasoning efforts; it ignores case and accents and matches every entered word.
Combine **Prompt** and **AI model** to compare one brief or follow one model
across briefs. Combine **Prompt generation** with either filter to compare versions. **View prompt** narrows directly to a group's prompt. Result
counts describe the matching collection, and **Clear filters** returns to the latest E builds. Empty results keep the controls and offer the same reset.

**More filters** reveals reasoning effort and sorting (newest builds or prompt
A–Z). The shared viewing angles are always visible on desktop. Phones keep one
compact search row with **Filters**, which unfolds prompt, model, generation, effort,
sorting and viewing angles together. Active choices stay visible in a short
summary with **Clear filters** while folded; the Filters button counts active
prompt/model/effort choices and a non-default generation. Desktop keeps a direct removal control for a folded
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

### Prompt generations

The default **E · fresh builds** collection contains six briefs with Sol 6.1,
Astra 6 and Opus 5.5, all at high effort. Each build starts in its own empty
directory/session with the same E input for that brief, no prior model source,
and no images or visual feedback. The [fresh comparison](samples/lego-style-study/fresh-e/README.md)
retains the exact inputs, sources and provenance. Sources are unchanged; the
published images use the shared Realistic settings.

The generation filter separates prompt version from starting conditions:

| Generation                 | Builds | Starting conditions                                |
| -------------------------- | -----: | -------------------------------------------------- |
| E · fresh builds (default) |     18 | Brief only; three models                           |
| F · fresh builds           |      6 | Brief only; Sol                                    |
| E · source revisions       |     18 | Original Sol creative build supplied; three models |
| F · source revisions       |      6 | Original Sol creative build supplied; Sol          |
| C · fresh builds           |      4 | Brief only; Sol; excludes image-assisted bird runs |
| B · fresh builds           |      2 | Brief only; Sol                                    |
| A · fresh builds           |      2 | Brief only; Sol                                    |
| Original · creative prompt |     12 | Previous gallery collection; Sol and Opus          |
| Earlier · original rules   |     12 | Earlier temple/effort and Ewok/target experiments  |

All **80** published entries are text-only runs. Historical image-input and
visual-feedback studies remain in the repository but are excluded from the
site. **All generations** has seven prompt groups because the earlier Ewok
1,000-part brief differs from the current 3,000-part target. Older experiments
use different rules or conditions and are labelled accordingly; a single run
per model/brief does not separate prompt effects from variation between runs.

Cards and detail facts identify the generation. Generation notes explain the
starting conditions. The selection survives detail and Play round trips for
the current visit, and resets to latest E on a fresh page load. The header's
Play shortcut chooses a featured E build when the workspace is empty.

The [reviewed publication bundle](samples/lego-style-study/generation-publication/README.md)
contains the complete index, content-addressed files, exact input hashes,
generation metadata and allowlisted SQL. Migration `0003_prompt_generations.sql`
stores the generation independently of the agent ID. Index additions are
optional for compatibility with older data; an index without a featured
generation displays its existing collection. Publishing checks the reviewed
live roster before changing visibility. Older sources and files are retained,
and new builds do not overwrite an edited local copy.

The previous [source-revision publication receipt](reports/e-gallery-publication.json)
remains an historical record. Its first workflow stopped at the initial D1
read; gallery CI credential access remains an open TODO. The authenticated
owner connection can publish a reviewed bundle after main validation. Existing
gallery-only cache rules retain immutable asset lifetimes and the one-minute
index lifetime.

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

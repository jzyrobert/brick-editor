# Gallery and interactive models

Gallery and Play are the primary modes. The cream workshop shell gives model
images most of the browsing space; Build, Instructions, Photo and Project are
available through **Tools** for the same open document.

## Browsing responses

Gallery opens by default. Pick a prompt, change the shared viewing angle, or use
Compare to choose two responses. Agent settings filter the reasoning levels.
Phones use a native prompt chooser and a horizontally scrolling response strip;
comparison places the two selected responses vertically. Look closer opens a
larger preview with generation notes and direct access to each model tool.

The initial dataset contains five GPT-6.1-Sol reasoning efforts for the same
Japanese Buddhist temple prompt, not five different agents. Other agents and
prompts are explicitly labeled placeholders. Descriptive model names are
editorial labels, separate from the generator metadata.

## Opening and editing

Explore compiles the selected source build script into a new local project and
opens Play. Choose a tool from a detail page to open the same sample in that tool.
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

## Published builds

When the [agent gallery](GALLERY-PLAN.md) has been published, Gallery reads its
`index.json` from `https://gallery.bricks.robertj.in`, the bucket that
`npm run gallery:publish` writes to. It then shows every published brief, model
and reasoning level, not the built-in samples. Cards come from the same
`GalleryEntry` shape (`src/catalog/gallery.ts`) as the samples:

- Titles are the build scripts' own.
- Renders are WebP files made with fixed settings: Realistic look on white,
  1,280 × 960, corner, front and back.
- The agent filter has one group per model.
- The "another agent" placeholder card shows only while a brief has a single
  model.

**Opening a published build.** Explore fetches its MPD, then checks the size,
the SHA-256 and the library release against the index before importing it.
Opened builds stay in Cache Storage (`brick-editor-gallery-v1`), so they open
again offline. `?gallery=<id>` opens a published build's page.

**When the index is used.** The index is read only on https pages, so local
and test servers never reach the bucket unless the URL has `?galleryIndex=1`.
If the index can't load (offline, or nothing published yet), Gallery keeps the
built-in samples without an error.

## Sources, assets and offline behavior

The original source run is
[geometry-rules temple samples](samples/japanese-temple-one-shot-geometry/README.md).
Generated on 2 October 2026; every effort was accepted after a second reply and
warning diagnostics still apply. Parts: Low 2,057; Medium 2,098; High 1,965;
Xhigh 1,997; Max 2,061.

`public/gallery/japanese-temple/` contains unchanged source-script copies and
three provenance-bearing preview images per response. The runtime compiles
scripts through the existing build-script service. Editing a local copy never
changes the gallery assets. Gallery uses static images for comparisons and only
one interactive scene is kept in the workspace, within the existing budgets.

The font is local Bricolage Grotesque; retain `public/notices/BRICOLAGE.txt`.
Existing LDraw notices remain required. All runtime assets are same-origin,
sub-path aware and included in the opt-in offline snapshot. No backend,
accounts, uploads, analytics or generation service was added. A failed load
keeps the current document and displays a retry message.

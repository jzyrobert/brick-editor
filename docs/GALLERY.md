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

Every response is a build published to the
[agent gallery](GALLERY-PLAN.md), read from `index.json` on
`https://gallery.bricks.robertj.in` (`src/catalog/gallery-index.ts`, mapped for
the page by `galleryPrompts` in `src/catalog/gallery.ts`). Responses are grouped
by model and ordered by reasoning effort; titles are the build scripts' own.
Agent settings has one box per model and effort (repeat runs at one effort share
it). Pictures are the published renders (Realistic look, 1,280 × 960 WebP,
corner, front and back).

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

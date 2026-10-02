# Measured pictorial PDF instruction layout

> Generated evaluation outputs referenced below are retained locally, outside
> this PR. See the [artifact policy](README.md#local-artifacts).

The deterministic v13 programmes are unchanged. This increment improves printed
instructions by measuring the actual blocks on each page, keeping ordinary
receiver/action/part/marker content together and preserving accepted picture and
font sizes. It follows the [source-interface review](interface-procedures.md);
it is separate from the completed [three-round manual agent experiment](agent-workflow.md).
Hobbyist desk review only; physical fit, support, handling and assembly remain
unverified.

## Demonstrated defect and repair

The accepted Truck/Crane/Pizzeria PDFs contain 329 pages for 238 operations. A complete
text triage finds 32 mostly-empty notes-continuation pages:8 Truck,10 Crane and 14 Pizzeria.
Actual selected pages show short target explanations and final “fit unverified”
qualifiers separated from useful receiving pictures. Fixed vertical positions
reserve absent supporting rows; a later 160-point cap wastes most of some
continuation sheets. The independent critic reopens 12 baseline main pages and
2 sparse continuations before judging the proposed repair.

`src/instructions/pdf-layout.ts` measures main image aspect, actual CAD header and
operation lines, supporting captions, full lot names/colours/refs and action
prose. Main pictures retain their accepted scale and move upward into otherwise
unused space. Supporting pictures remain 120×90 points, trays 48×48, action/legend
text 11 points and operation/lot names 10 points. Actual parts can occupy the space
beside one/two supporting pictures only when the complete ordinary action still
fits below. Three-picture joins retain all three views and “No new parts”.
Supporting captions wrap within their own 120-point regions.

Complete ordinary actions take priority. Page-sized marker descriptions remain
atomic rather than spilling a final qualifier onto another sheet. Truly long
prose and oversized file-local part names continue explicitly, preserving full
identity and the footer margin. Complete lot labels replace earlier 48-character
name truncation. The 160-point cap is removed. This is measured publishing, not
changed assembly order or new part batching. PDF text retains existing dimension
substitutions and Latin-font fallback; the unchanged attachment preserves original
Unicode labels.

The first measured-layout pilot already eliminates the 32 sparse continuations.
The full geometry audit nevertheless finds inherited text widths up to 4.7 points
past the nominal right margin: Helvetica's whole-string metric includes kerning,
while `drawText` emits unkerned advances. Final wrapping sums actual glyph
advances. A separate legacy header allowance preserves the accepted main image
size when actual header wrapping adds a line; actual printed lines still control
vertical placement. Final text/image margin and separation gates pass without
loosening their bounds. The [critic](print-layout-critic.md) distinguishes this
pilot from the final exact files.

## Complete publications and scope

| Model                    | Operations | Source occurrences | Accepted PDF pages | Final PDF pages | Exact image draws |
| ------------------------ | ---------: | -----------------: | -----------------: | --------------: | ----------------: |
| OMR 6450 Police Truck    |         57 |                 86 |                 77 |              60 |               180 |
| OMR 6361 Mobile Crane    |         85 |                170 |                115 |              89 |               292 |
| OMR 6350 Pizzeria        |         96 |                166 |                137 |             100 |               315 |
| Total official selection |        238 |                422 |                329 |             249 |               787 |
| Roadster sample          |         33 |                 58 |                  — |              35 |                97 |
| House sample             |        132 |                281 |                  — |             135 |               472 |

All 403 operations retain complete printed core actions, captions, lot identities
and marker explanations. The three official files and Roadster have no instruction continuations.
House also retains all 132 complete operations on their main pages after the
critic catches and repairs one remaining fourth-marker orphan. Covers and complete
inventory pages account for the other extra sheets.
The official comparison audits all 238 operations, exact attached prepared plans,
all 787 decoded RGB/alpha image draws and their drawn sizes against accepted v13
PDFs. Whole-body ordered text and per-token font sizes are independently equal.
Actual margins and text/image separation pass. Official page reduction is 80,
not a change in the 238-step assembly programme or a buildability score.

For both samples, all 165 operations and 569 image draws bind their exact source
captures and complete ZIP/native/prepared metadata. Roadster uses a fresh full
CLI HTML export with terminal exit 0. House's first process exits 143 but leaves a
complete ZIP/report; a later retry also exits 143 and leaves no output. Neither
House capture attempt is counted as a successful command. Its recovered artifact
passes complete 132-step native/source/plan/camera/PNG-presence/dimension/tray and
metadata checks, then successful production PDF composition. This supports the
layout assessment, not a successful fresh House CLI performance claim. There is
no accepted pre-layout v13 sample-PDF baseline comparison. A final independent
comparison against the retained measured-layout legend pilot also verifies all
165 ordered bodies/fonts and 569 pixels/alpha/drawn sizes unchanged.

All five full PDFs are composed by actual `publishInstructions`, using checked
byte-identical HTML captures and tray PNGs. Capture fixtures supply images only;
source/native hashes, complete reports, step cameras and every PNG are verified.
No GPU work is credited for this composition. Each production composition test
terminates successfully. Full exports remain local; the bounded archive (local artifact)
contains exact-file hashes, full geometry/content audits, selected raw pages,
pilot records and private reproduction fixtures.

The independent critic inspects 42 final official main pages, including all 32
formerly sparse operations, controls, accessories and zero-new joins. This
selected visual scope is distinct from the complete text/pixel audit. Six Roadster
and eleven House pages bring the final independently inspected scope to 59 actual
physical pages. The critic accepts the bounded layout increment; exact selections
and final delivery judgement are recorded in the
[critic report](print-layout-critic.md). Model scores remain Truck 3/5, Crane 2/5,
Pizzeria 2/5 and samples 3/5. Better pagination does not establish physical assembly
feasibility or satisfy broader automatic-generation acceptance.

## Rejected sample legend and final repair

The first complete sample audit preserves every House word but initially
mislabels its operation 10 continuation as parts overflow. The critic opens the
actual pages 11–12: all three lot rows and full action are already on the main
page, while only the fourth short target legend is orphaned. This is a remaining
usability defect and an incorrect interpretation of the audit, not justified
overflow. The actual rejected pages and complete composition binding remain in
`print-layout/pilot/`.

Sidebar selection now reserves the complete explanation block as well as the
action. When that cannot fit, a measured full-width row for two/three lots is
adopted only if the entire action, part row and legends fit at accepted fonts,
48-point trays and actual wrapped cell widths. Oversized labels still fall back
to explicit continuation. House operation 10 then fits all four legends with its actual
receiver and three lots;135 pages preserve all 132 complete operations. All five
full PDFs are recomposed and re-audited after this repair. The three official
counts and Roadster remain unchanged; no source programme or pixels are altered.

## Verification and remaining work

147 instruction unit tests across 21 files pass, followed by production
schemas/type-check/build. New regressions cover complete accessory instructions,
atomic marker qualifiers, arbitrary long part titles, actual unkerned widths,
unchanged main scale after header rewrap, wide/portrait pictures and one/two/three
supporting views. Two existing browser publication/cancellation checks pass.
The new actual pictorial PDF workbench check initially assumes four join images;
its origin-only fixture defines only main/incoming views. Correcting that fixture
assertion yields a successful focused browser run. Both the failed expectation
and the successful retry are recorded, without changing product behavior. A final
run of all three relevant browser checks passes after the mixed-lot repair, along
with formatting and pinned-library validation.

All 17 accepted native files retain exact byte hashes and 7,017 source introductions.
The generator stays `connected-bottom-up-v13`. Three oversized samples, Galaxy's
strict colour refusal and London/Hut 200-operation full-publication refusal remain
explicit. Chapter publication, loose-foundation support, separate mechanism and
container programmes, vehicle accessory clips, articulation, compact supplied
figures, transparent-part contrast, embedded model credits and physical builder
trials remain feasible directions. Fan-authored OMR steps stay separate from
primary LEGO booklets; no new primary-manual or physical comparison is claimed.

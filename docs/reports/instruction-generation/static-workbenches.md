# Static source workbenches and panel decorations, v14

> Generated evaluation outputs referenced below are retained locally, outside
> this PR. See the [artifact policy](README.md#local-artifacts).

This deterministic increment separates the Mobile Crane container and Train
sample coach from the surrounding scene while building them. It continues the
[v13 source procedures](interface-procedures.md), independently of the completed
three-round manual agent experiment. These are editable hobbyist drafts. Source
geometry, inventory and source position remain intact; detached support, handling,
adhesive attachment and wheel/rail fit remain unverified.

## Source geometry and eligibility

Four pinned source hashes in `src/instructions/decoration-procedures.ts` bind
`195075b.dat`, `2362a.dat`, `4215a.dat` and the sticker's `box5-12.dat` backside
primitive. The actual sticker back is a 56 × 38 LDU rectangle at local Y = 0;
its printed face points toward −Y. The panels' actual outer quads are at local
Z = 10, with widths 40/80 and height 72 LDU, facing +Z. Matching requires the
current curated/full-library locks, official namespace, proper near-rigid
transforms and the same immediate expanded source parent.

The finite sticker footprint must be fully covered by one to four coplanar,
axis-aligned reviewed panel faces. Clipped patches may meet at seams, but may
not overlap. Incomplete coverage, duplicate panels, competing overlapping
stickers, wrong normals, tilt, distorted poses and foreign parents are rejected.
The numerical display tolerances are 0.001 for rigidity, 0.05 LDU for the plane,
0.999999 for signed normal/absolute planar-axis agreement, and 0.01 LDU² for
area comparisons. These are display tolerances, not physical clearance or
adhesion allowances. A separate 200,000-work bound covers matching and ambiguity
checks; any exhaustion discards all matches, including earlier candidates.

Each accepted sticker has a singleton operation after every contributing panel.
The bare receiving detail shows those already-present panels and excludes the
sticker. Notes identify the seam and arrow orientation and preserve an already
applied sticker. The centre landmark is projected onto its actual containing
panel face; that panel is the first named receiver. These source associations
do not add verified connector coverage or prescribe a checked translation.

Static workbenches require complete direct source membership, 4–300 planning
units, at most 300 leaves, known rigid ordinary-part bounds, and a 500 LDU X/Z
or 650 LDU Y envelope. Existing children, broad foundations, generated owners,
missing geometry and disconnected props are excluded. One undirected component
is required across the existing contact/support/host/access relationships.
This includes estimated support and reviewed display associations: it is not
an all-verified physical attachment component. Whole-root static fallback is
not allowed; the existing reviewed wheel-parent policy remains distinct.

Any known contact or prerequisite crossing the source boundary in either
direction rejects the candidate. Preflight checks each operation's start against
the actual active bench, preserving all dependencies and leaf introduction
order. Unavailable same-batch predecessors and ownership conflicts retain the
flat programme. Loose initial pieces get explicit relative-position/support
guidance before later connecting pieces are fitted.

A completed static candidate stays aside until remaining in-place main
construction is complete. This moves only its zero-new-part scene join and adds
a set-aside note when needed. It does not invent a new receiving relationship.
Scene main/incoming views use upper viewpoints to explain the arrangement;
saved cameras do not instruct a physical turn. The live viewer now offers the
completed candidate under its existing **Placement views** disclosure and can
return to the actual placement state.

## Corpus and actual sequence

The baseline is the accepted v13 plans at `4b3055b`. All 17 supported cases keep
their source models, root, assets, library, raw LDraw export and expanded
reference/colour/pose identity. All **7,017 source leaves** are introduced once.
Fifteen complete programme/presentation objects are identical after removing
generation reports. Every prior edge in all 133 recorded source sections is
retained; only four sticker-to-panel access edges are added.

| Model             | v13 operations | v14 operations | New bench leaves |
| ----------------- | -------------: | -------------: | ---------------: |
| 6361 Mobile Crane |             85 |             88 |               23 |
| Train sample      |            178 |            179 |               80 |

Crane builds its loose feet at 65/66, floor 67, rear base 68 and panels 69.
Each sticker at 70/71 follows both of its panels. Frame 72 precedes the separate
shutters 73/74; rear brick 75, roof 76, jumpers 77 and bar 78 retain their former
non-sticker introduction order. Scene placement 79 adds no inventory; the
unchanged figure programme follows at 80–88. The container's 16/23 verified
connector coverage is unchanged.

Both actual stickers span two panel faces. The world footprint is
Y = [−69,−31], Z = [−268,−212]; the right seam is Z = −260 and the left seam
Z = −220. Patch widths are 8 + 48 and 48 + 8 LDU. The centre lies on the
4215a face, not the 2362a face.

Train coach builds 84–112 retain all 80 leaf introductions in order. The last
build says to keep it supported/set aside. Track construction 113–178 excludes
the unplaced coach; the completed source-position scene placement is 179.
This corrects the initial pilot's scene placement before the track without
claiming rail support, alignment, rolling compatibility or a verified route.

## Verification and complete publications

All **162 instruction unit tests across 22 files** pass. The initial production
build transforms 617 modules; pinned library validation passes. Five focused
production browser checks pass: actual static bench/seam receiver/incoming
candidate masks, existing figure and wheel receiving views, and
generation/preview/undo at 1440 px and 360 px. Final native UI evidence contains
100 actual screenshots with exact source/plan bindings at all required phone
and desktop sizes; 32 selected portrait/landscape views are archived. Notes
remain reachable by scrolling, with viewport and note-box heights recorded
separately.

Both complete final native CLI HTML exports succeed with exit 0. Actual
production PDF composition also succeeds for both, using byte-identical final
HTML main/context/receiver/incoming/tray PNGs after complete prepared metadata,
native/source/plan and dimension equality gates. This exercises the publisher's
layout and wrapping without claiming a fresh PDF GPU capture.

| Model        | Operations | Source inventory | PDF pages | Exact RGB/alpha image draws |
| ------------ | ---------: | ---------------: | --------: | --------------------------: |
| Mobile Crane |         88 |              170 |        92 |                         289 |
| Train sample |        179 |              415 |       183 |                         630 |

Independent document checks bind every PDF attachment to its full successful
HTML report, retain every native action, CAD summary, operation label, lot and
marker caption, and compare decoded image RGB/alpha and drawn aspect ratios.
All pages satisfy text/image separation and margin checks. Selected actual
printed pages and phone HTML views receive the critic's separate direct review;
full metadata/pixel checks do not imply every page was visually reviewed.
The bounded archive (local artifact) includes final natives,
plans, gallery sheets, independent audits, selected actual pictures and hashes.

Two foreground Train export attempts ended with signal 143 and produced no
final Train ZIP. Neither is credited as a successful publication. The separately
recorded final session completed in 649.6 seconds with exit 0 and the complete
33,111,581-byte ZIP. The v13 Train comparison gallery was recovered after an
interrupted command; its complete 31 states are auditable, while terminal
success is not claimed. These execution scopes stay distinct from the final
successful captures and composition.

The feature was subsequently rebased onto current main `2832b8c`, retaining
upstream build-budget, API and headless-cache work. Every tracked instruction,
render, catalogue and UI source remains byte-identical to the frozen feature.
Actual regeneration of all 17 cases equals their complete persisted v14 plans,
without rewriting native or capture bytes. All 162 instruction units pass again;
the post-rebase production build transforms 618 modules. This preserves the
critic's frozen artifact scope rather than claiming a new visual or physical
study after the rebase. The initial private equivalence assertion distinguished
in-memory signed zero/undefined fields from persisted JSON; its corrected full
JSON-serialised equality gate is recorded separately, without stripping fields.
All five focused production browser checks also pass on the post-rebase build.

## Review and limits

The [independent critic](static-workbenches-critic.md) distinguishes the bounded
organisational improvements from whole-model quality. Crane's hinge/pin
procedures and broader Train handling remain open. No physical build was tested.
Crane's OMR file has no STEP/ROTSTEP records; its source enumeration is not an
official manual. No primary LEGO 6361 booklet was available. Train is a repository
sample. Previously reviewed source/LEGO comparisons retain their original scope.

Initial real pictures exposed a wrong singular sticker-marker owner: P named
2362a while lying on 4215a. That pilot was rejected, the actual containing panel
was named, and the receiving pictures were recaptured. The first Train scene
placement at 113 was superseded by the supported/set-aside programme. A browser
test additionally exposed the missing completed-candidate control in the live
viewer; the shared view control was added and checked with real masks.

Three oversized inputs retain their generation refusal. Galaxy retains its
strict unresolved-colour rendering refusal; London/Hut retain the 200-operation
full-publication refusal. The new organisation does not waive any limit or
establish detached stability. Next substantive work includes source-reviewed
crane hinge/pin receivers and explicit wheel/rail readiness; neither follows
from source grouping or the absence of known cross-boundary contacts.

# Source-reviewed steering, shutter and road-sign procedures

> Generated evaluation outputs referenced below are retained locally, outside
> this PR. See the [artifact policy](README.md#local-artifacts).

Automatic v12 repairs three concrete failures in the Police Truck draft: hidden
steering, grouped hidden shutters and loose signs constructed beside the vehicle.
This increment is separate from the completed [three-round manual agent
experiment](agent-workflow.md). The independent critic rates the final automatic
Truck **3/5**, up from 2/5; the Crane remains **2/5**, with improved shutter steps.
These are hobbyist desk reviews, without physical assembly or fit validation.

## Source associations and ordering

Sixteen pinned, unmodified LDraw source hashes bind the narrowly enumerated
families in `src/instructions/display-procedures.ts`. Current curated/full-library
locks, official namespace, proper near-rigid transforms (0.001 tolerance) and
immediate expanded source ownership are required. Source STEP order is not used.
Ambiguous receivers, duplicate candidate leaves, foreign parents and distorted
poses are refused. Display associations do not upgrade connector verification.

The complete `3829c01.dat` steering shortcut remains intact. Its two underside
seat points must uniquely match the actual raised studs of `4211.dat`. Both
points are traced through that car base's `stug2.dat` → `stug-2x2.dat` source
geometry. A nearby flat floor alone would incorrectly suggest an eight-LDU gap.
Labels use the actual base studs, including when the incoming seats are rounded
within the association tolerance. Steering precedes reviewed nearby windscreen
and roof closures; the before detail shows only the already-present actual base.

Each `3856.dat` shutter must uniquely associate both end regions with its own
`3853.dat` frame, with signed axis agreement and a maximum 2.5-LDU source offset.
The preserved offsets are two LDU in the Truck and zero in the Crane. These are
source landmark associations, not a certified coaxial hinge or snapping route.
Each shutter gets its own operation after the frame and before a matching
covering cap. Conditional cap wording and First/Second end labels support cases
without a cap and rotated frames. P1/P2 points have offset labels and thin leaders
without arrowheads; the actual incoming shutter is absent from the receiver view.

Road signs require exactly two immediate source members: a reviewed 1×2 plate
and a reviewed printed warning/arrow tile, matching origins and signed axes.
Plate then tile build on a separate bench when known boundary relationships
permit it. Scene placement introduces zero new parts and retains the source
pose. Both completed incoming and destination views face the actual printed
front. Holding, detached stability and the final stance remain unverified.

Generic source-procedure helpers preserve original support/host/access edges.
All proposed edges for a candidate are accepted atomically or rejected on a
cycle. Association scans and precedence traversal each have their own bounded
200,000-work budget; incomplete cap/closure scans reject the current candidate.
Every known relationship crossing a sign boundary in either direction rejects
a separate workbench. Missing/broad/generated geometry is also refused. No known
crossing is not proof of physical independence. Every new fitting operation
retains UNKNOWN, with no generated insertion arrow or manufactured fit claim.

## Exact programme and source scope

Freshly regenerated v11 `9304f40` baselines match the actual prior native plans.
All seventeen supported models retain the same models, references, colours,
poses, records, assets, root, library locks, raw MPD export and expanded source
occurrences. All **7,017 unique source leaves** are introduced once. Fifteen
programme/presentation objects remain exactly identical after excluding the
generation report. Only these two programmes change:

| Model             | v11 operations | v12 operations | Source occurrences | Changed procedures                         |
| ----------------- | -------------: | -------------: | -----------------: | ------------------------------------------ |
| 6450 Police Truck |             52 |             55 |                 86 | Steering, two shutters, two separate signs |
| 6361 Mobile Crane |             80 |             82 |                170 | Two separate shutters                      |

Truck frame 11 precedes shutters 12/13 and cap 14. Steering 20 precedes
windscreen 22 and roof 23. Sign operations are 41–43 and 44–46, ending in
zero-new-part scene placements. Crane frame 67 precedes shutters 68/69, covering
body 70 and roof 71. Persisted validation checks prior receiver membership and
actual replay, rather than accepting a metadata-only sequence. Fresh generation
with the final source-point rounding repair exactly equals both captured native
plans. Its initial private audit registered the catalogue before the library,
leaving numeric fallback titles; that audit was corrected and passed. This was
not a change to the final captured plans.

## Actual pictures, phones and publications

The pilot Truck gallery contains all 55 operations and 100 actual rasters. The
critic found back-facing sign scene joins; source-front main/incoming cameras
were repaired. The final Truck gallery freshly captures all **55 states / 102
rasters / seven sheets**. The final Crane gallery freshly captures **30 selected
states / 58 rasters / four sheets**, including both new shutter procedures and
surrounding closure steps. Both real CLI gallery calls return zero. The final
visual scope is **85 states, 160 rasters and eleven sheets**, not a complete Crane
or seventeen-model visual rereview. Native/source/plan hashes bind each manifest.

Fifty fresh native phone captures cover nine changed fitting/scene operations at
360×600 and 686×411, with main, receiving and notes views where present. True
prior-member detail masks exclude incoming parts and restore the full placement
scene. The critic additionally captures eighteen actual exported HTML operation
sections across those sizes. All images load and no page overflow is measured.
Long captions require scrolling; the evidence does not claim every paragraph is
visible simultaneously or establish real-device performance.

All four full production CLI exports are fresh browser captures and return zero,
using 600×450 principal images and 240×180 supporting views:

| Model | Operations | Source inventory | PDF pages | HTML diagram PNGs |
| ----- | ---------: | ---------------: | --------: | ----------------: |
| Truck |         55 |               86 |        76 |               102 |
| Crane |         82 |              170 |       112 |               163 |

The PDF attachments deeply equal their corresponding HTML ZIP instruction JSON.
Source inventory, unique introductions, views, target points, prior-member detail
masks and CAD metadata match the native plan. Notes retain the native procedure
text with the publisher's CAD summary. Selected actual PDF pages retain the
critical action paragraphs and correct receiver/printed views. Complete text
and persistence checks supplement selected page inspection; every booklet page
has not been visually reviewed. All publications retain `assemblyValidated:false`.

The bounded archive (local artifact) preserves final editable
natives, all seventeen plans, two actual baselines, final galleries, selected
pilot evidence, phone screenshots, selected real PDF pages, complete published
JSON, source bindings and file hashes. Full exported PDF/ZIP files remain local.
OMR authors/licences are retained; these are fan-authored models of official sets,
not primary LEGO manuals. Primary 6450/6361 booklets remain unavailable, and no
primary-booklet comparison is claimed for this increment.

## Acceptance and remaining work

The 129 instruction unit tests across nineteen files pass, as do production
schema generation, type checking, build, formatting and pinned-library validation.
Eight relevant browser checks pass in the initial batch. Its two stale v11
algorithm expectations were updated to v12; both focused generation/preview/undo
reruns then pass with exit zero. The initial outer batch returned 143 and is not
credited as an exit-zero complete run. Archived semantic plan hashes match all
seventeen persisted audited plans after formatting.

The [independent critic](display-procedures-critic.md) accepts this bounded
increment. Truck still requires judgement for early held chassis support, generic
clips/prop grips and an electrical CAD crossing. Crane still needs useful
container, mechanism and control procedures. Small P labels touch some completed
sign print, long source captions and sparse PDF legend pages reduce efficiency,
and automatically embedded source credits remain open. Physical fit, handling,
stability and support are unverified. Broader corpus acceptance remains open.

The original three oversized-generation refusals, Galaxy's strict unresolved
colour render refusal and London/Hut's 200-operation full-publication refusal
remain. Feasible next work includes actual prop/control receivers, articulated
mechanisms, compact supplied-figure alternatives, loose-foundation handling and
chapter/publication compaction. The source/programme checks do not prove these
tasks solved or certify physical assembly.

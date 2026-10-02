# Source-reviewed figure procedures

> Generated evaluation outputs referenced below are retained locally, outside
> this PR. See the [artifact policy](README.md#local-artifacts).

Automatic v11 addresses a specific failure left by v10: minifigure hands could be
introduced before their arms, obsolete leg drawings were split into apparent
assembly operations, and full-scene diagrams concealed the small receiving parts.
This is separate from the completed [three-round manual agent experiment](agent-workflow.md).

## Reviewed source associations

Profiles bind to the current curated and complete-library locks. Tests hash-check
27 unmodified official part texts, including the shoulder/wrist subpart. The
accepted torso, side-specific arm, hand, obsolete lower-body, head, headgear and
prop references are explicitly enumerated in `src/instructions/figures.ts`.
Complete immediate source ownership, origin/axis checks and reciprocal unique
hand-to-arm pairing are required. Local shadows, mixed ownership, ambiguous hands,
missing members and materially distorted poses are refused. The 0.02 near-rigid
**display** tolerance accommodates rounded OMR poses; it does not upgrade strict
connector eligibility or certify manufactured fit.

The shoulder origin is torso-local ±15.552, 9, 0. The reviewed wrist opening is
arm-local ±5, 18.9, -9.9; its outward direction is arm-local 0, 1, -1. The hand
post is hand-local +Z. Signed opposition and proximity associate each hand with
its own arm. Head and headgear use their reviewed neck/stud landmarks and source
face orientation. These source points improve illustration and ordering only.
Every such fitting operation remains UNKNOWN, with no rigid approach arrow.
Cup/radio grip procedures remain unresolved.

Torso precedes arms, each arm precedes its hand, and head precedes headgear. All
proposed edges for a figure are accepted atomically only when existing support,
host and access constraints cannot form a cycle. Traversal has a shared 200,000
visit budget; exhaustion preserves existing constraints. Known relationships
crossing the figure boundary, missing bounds, broad geometry and generated
ownership refuse a separate figure workbench. Absence of a known crossing does
not establish physical independence.

The three obsolete hips/leg source drawings form one conditional lower-body
illustration, retaining all raw inventory rows and references. Notes tell builders
to keep supplied torso/arm/hand and lower-body assemblies intact, rather than
dismantling them to follow the source drawings. This is not a certified shopping
identity or a new interchangeable modern-leg profile. The primary
[31025 booklet](https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6073974.pdf),
page 3, uses intact legs and a torso already containing arms/hands in a compact
figure diagram. The generated eight-operation conditional procedure remains more
verbose; a supplied-assembly compact alternative is still useful future work.
Page 69 of that booklet builds a lamp, not the figure.

## Programme and presentation scope

The fresh 17-case comparison uses frozen `c1243ba` v10 generation with current
shared replay/library helpers. All source models, references, colours, transforms,
raw MPD exports and unique introduction inventories remain exact (7,017 leaves).
Thirteen programme/presentation objects remain exact after removing generation
reports. Four official-set source models change:

| OMR model          | v10 operations | v11 operations | Separate figures | Figure operations |
| ------------------ | -------------: | -------------: | ---------------: | ----------------: |
| 6350 Pizzeria      |             85 |             96 |                3 |                26 |
| 6361 Mobile Crane  |             77 |             80 |                1 |                 8 |
| 6450 Police Truck  |             50 |             52 |                1 |                 8 |
| 31025 Mountain Hut |            257 |            259 |                0 |                 8 |

Eligible complete figures build on their own bench, followed by one zero-new-part
scene placement in the original source pose. Scene placement does not infer a
mating connection or stable stance. The Hut retains its known crossing constraints
and stays in the scene. Its receiver detail contains only already present source
figure members, omits surrounding scenery, and explicitly states that access is
unverified. Main diagrams retain the actual scene locator. This illustration mask
changes no programme membership, CAD obstacle state or physical action. Validation
rejects future, foreign, repeated or empty detail masks and requires a before-state
camera; structural edits discard the mask with other derived illustration data.

The first complete v11 packet received 98 selected-state captures: Truck all 52,
Pizzeria 29 figure states, Crane 9 and Hut 8, totalling 192 rasters on 12 sheets.
The [independent critic](figure-procedures-critic.md) found a concealed Hut wrist
at 237 and duplicated/general warnings preceding useful instructions. The final
caption repair removes those duplicates while retaining figure-specific supplied
assembly, roll, seating, fit and access uncertainty. The final detail repair
exposes the prior Hut host without relaxing workbench eligibility. A separate
pilot/final audit proves exact steps, modules, cameras, source targets and actual
CAD outcomes; only captions and the Hut detail masks differ.

## Acceptance remains bounded

These are local figure repairs, not a whole-model score lift. Broader official
ratings remain Pizzeria, Crane and Police Truck 2/5 and Hut 3/5. Truck steering,
shutter interfaces and separate signs, other models' articulated mechanisms,
prop grip profiles and compact supplied-figure instructions remain feasible
work. The original three oversized-generation refusals, strict Galaxy colour
refusal, and London/Hut default 200-operation publication refusal remain
applicable. Primary booklets for 6350/6361/6450 remain unavailable; their authored
OMR steps are fan evidence, not primary physical instructions.

## Actual final evidence and validation

After the marker review, non-axis source point P labels use a no-arrowhead leader
beside their receiving feature in both main and before pictures. The corpus scan
finds exactly 42 such figure operations in these four models; wheel-axis markers
and all other generated targets retain their prior compositing behavior. Printed
faces and wrist mouths remain visible without an overlay circle covering them.
The final 55 figure states have 120 real compositor rasters on eight sheets.
Pizzeria's 29 states are three independently completed chunks (68–77, 78–86,
87–96); all manifests bind to the same actual native plan and source. Truck's
unchanged first 43 operations reuse its earlier complete 52-state review with
programme/view equivalence. This is not a fresh whole-corpus visual review.

Forty actual native phone captures cover Pizzeria 71/75, Truck 47/50/52 and Hut
234/237 at 360×600 and 686×411. Destination, before and scrolled notes are captured
where available; detail IDs match the real prior receiving subset and exclude
new parts. All-UNKNOWN guide badges now say there is no checked route. Contact
allowance wording is retained for evaluated clear/blocked CAD checks. These are
software Chromium results, not physical-device or assembly trials.

Complete Truck and Pizzeria publications retain 52/96 operations and 86/166 raw
source occurrences, respectively. Their PDFs have 70/135 pages and ZIPs contain
91/170 diagram PNGs. HTML contains 162/313 image elements, including diagrams and
trays. Independent extraction proves each final PDF attachment equals its own
ZIP's instructions JSON. Source introductions, source target locations/IDs,
cameras and actual CAD outcomes match the native plan; notes retain its complete
action paragraph plus the normal published CAD summary. Non-receiving destination
legends also add packaged part colour names. `assemblyValidated` remains false.

The first full CLI exports are preserved locally. Truck PDF and Pizzeria HTML
returned success; one enclosing private wrapper ended with signal 143 after the
complete Truck ZIP files were written, so its child exit status is not claimed.
The complete ZIP and companion metadata were independently validated. Final
marker-corrected PDF and HTML use the actual production publisher with 28 changed
publication states freshly captured at the original 600×450/240×180 dimensions
(56 rasters), plus byte-identical prior unchanged diagrams and trays. Four
composition checks bind source/native, current compositor/publisher hashes,
full prepared metadata, all image hashes and dimensions. Reused diagrams are not
claimed as newly rendered. A partial terminated gallery batch without a manifest
is excluded; the accepted Pizzeria chunks completed independently.

The bounded archive (local artifact) retains all 17 plans, comparison
and mask/marker audits, four natives, initial failure sheets, all final gallery
rasters, phones, selected real publication pages and source credits. Full original
LEGO booklets and private complete exports stay local. The critic independently verifies all 56 fresh PNG hashes and all 205 remaining
diagram PNGs against the preserved previous ZIPs, plus PDF draw totals 162/313.
Sixteen selected final HTML sections (four per model at both phone sizes) load
all document images without horizontal overflow. Wrist holes, printed eyes and
smiles are visible after the marker repair. Long notes still require scrolling,
and the 70/135-page layouts remain inefficient. The bounded figure increment
passes [independent desk review](figure-procedures-critic.md); broader acceptance
and whole-model scores stay open.

Production schemas/type-check/build, 122 instruction unit tests in 18 files and
the final actual-Hut editor/viewer phone regression pass. Nine existing relevant
production browser checks also pass; the initial new test used the wrong restore
button name and was corrected before accepted runs. Formatting and pinned-library
checks are recorded with the final change. Earlier c1243ba passed every CI check;
that result is not credited to this increment. The current head's CI status is
reported on the PR. No physical build trial has been performed.

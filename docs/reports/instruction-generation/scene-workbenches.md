# Automatic vehicle workbenches, v10

> Generated evaluation outputs referenced below are retained locally, outside
> this PR. See the [artifact policy](README.md#local-artifacts).

The generator now builds eligible vehicle candidates separately, constructs and
fits their wheels on their own benches, places each completed wheel into the
actual receiving vehicle bench, then places the completed candidate in the scene.
Tyre fitting shows the preceding bare rim. Source records, references, colours,
poses and inventory are preserved. This transfers a bounded part of the completed
[three-round agent experiment](agent-workflow.md); it does not credit its manual
figure, hinge or enclosure improvements to automatic generation.

For6450, the72-leaf vehicle is built separately through38, with its four wheel
triples27–38. A zero-new-part scene placement39 precedes the remaining signs and
officer40–50. The previous flat draft mixed completed wheel placement into the
root scene. The new programme distinguishes these benches while keeping the
original introduction order. It still needs the critic's specific figure and
small-interface corrections; its whole-model score remains2/5.

## Eligibility and fallback

`src/instructions/scene-workbenches.ts` admits compact wheel-bearing direct source
sections containing at least two source-reviewed wheel modules with internal
receiving hosts. Candidates have at most300 source leaves,500 LDU X/Z extent and
650 LDU Y extent. Broad foundations, generated owners, raw drawing geometry,
missing bounds, non-wheel children, unresolved wheel hosts and transforms outside
a0.001 near-rigidity tolerance are excluded.

Any known verified-contact, support, host or access edge crossing the boundary in
either direction rejects the candidate. Preflight walks the existing programme:
prerequisites must be assembled on the active bench or wheel's actual destination
parent, including completed child joins. Introducing a receiver on an unjoined
sibling bench is insufficient. Mixed ordinary batches are split without changing
leaf order or admitting foreign props. A parent scene join follows its last build
or child join. Failed candidates keep the flat programme; no dependency is dropped.

Roadster spans chassis/body/wheel source sections. Its whole-root fallback requires
one contact/support/reviewed-wheel-host component. A rejected source vehicle cannot
be rescued by absorbing the rest of its scene. Jeep's unresolved spare and
Technic's generated/uncertain ownership retain their flat fallback.

Source hierarchy and incomplete connector coverage do not prove physical
independence. These are organisational candidates with unknown detached support,
handling and fit. Scene placement infers no mating connection or prescribed
installation route. Generation recomputes checks against replayed display states;
programme fingerprints include nesting. Tyre deformation and wheel fastening stay
UNKNOWN. All publications retain `assemblyValidated:false`.

## Corpus and independent review

The offline investigation reuses cached sources and the pinned complete library.
All twelve nonempty samples and eight official sets were attempted; the three
oversized samples retain their explicit5,000-occurrence generation refusal.
All17 supported plans preserve7017 unique source occurrences and all source
fields. A frozen v9 generator from `3f6f2ed` and v10 were run against the same
production replay and loaded packs.

| Model              | Parent leaves | v9 operations | v10 operations | Reviewed score |
| ------------------ | ------------: | ------------: | -------------: | -------------: |
| Roadster           |            58 |            32 |             33 |            3/5 |
| 6350 Pizzeria car  |            47 |            84 |             85 |            2/5 |
| 6361 crane vehicle |           137 |            76 |             77 |            2/5 |
| 6450 Police Truck  |            72 |            49 |             50 |            2/5 |
| 31025 Hut quad     |            33 |           256 |            257 |            3/5 |

All17 original leaf-step arrays remain exact after removing only the five new
scene joins. Ten plans retain identical programme/presentation; Jeep and8832 differ
only in tyre receiving-view flags. Current CAD fingerprints are checked for every
plan. Galaxy retains its strict unresolved-colour render refusal and no score.
London/Hut retain the200-operation full-publication refusal.

The [independent critic](scene-workbenches-critic.md) inspected all five initial
parent packets:205 view instances and377 rasters. That review identified the
completed-wheel inset defect. A separately frozen supplement repairs all31 tyre
operations across seven models and all five reviewed families:31 fresh view
instances and62 rasters. A strict comparison proves these are flag-only changes;
no other module, camera, marker, CAD or plan field changed. Initial galleries keep
their original plan hashes and pictured captions; repaired insets are in the final
supplement. Do not treat them as a new manual-agent experiment round.

Fresh windmill evidence adds28 states and49 rasters, including actual blocker
labels94/99/105/112. Its v9/v10 plans are equal in this run. Some marker ordering
differs from older v9 report snapshots after the previously committed nested
replay implementation; those older rasters are not claimed as current windmill
presentation. In total the increment captures264 view instances and488 rasters,
with35 bounded sheets. View instances across phases are not unique operations.

Each capture subprocess completed its manifest/artifact gates. The two long outer
batch sessions reported143 after their individual completion lines; they are not
reported as successful outer process exits. No unfinished or rejected capture is
credited. Source and picture ownership hashes accompany the bounded
evidence archive (local artifact).

## Native, browser and publication checks

All100 instruction unit tests in16 files pass. Six new tests cover automatic
nested Roadster persistence/inventory, official-scene isolation, mixed batch
splitting, crossing dependencies in both directions, unjoined sibling receivers,
and unresolved/unknown geometry fallback. Production schema generation/typecheck
and build pass. Nine relevant production browser checks pass for generated and
authored plans; after the tyre repair, three focused checks pass for desktop/phone
worker generation and exact visible bare-rim identity in live viewer/publication.

Twenty actual native phone captures cover Roadster wheel23/scene33 and truck
wheel29/scene39 at360×600 and686×411, including four bare-pin views and eight
scrolled note views. The selected plan/captions are checked, no horizontal overflow
is present, and notes remain noncollapsed. These are software-browser captures,
not physical device or builder trials.

Four complete real CLI exports return0, using600×450 main diagrams:

| Model    | Operations / source inventory | PDF pages | ZIP PNG files |
| -------- | ----------------------------- | --------: | ------------: |
| Roadster | 33 /58                        |        41 |            51 |
| 6450     | 50 /86                        |        64 |            84 |

Both PDF attachments exactly match their own HTML ZIP's prepared metadata, with
unique source introductions and `assemblyValidated:false`. All93/155 HTML images
load and33/50 sections remain within the two tested viewport widths. The critic
independently inspected eight selected actual PDF pages, all20 native captures
and eight exported HTML operation/viewport windows. Full PDF/ZIP files stay local;
execution records, hashes and selected actual-page screenshots are archived.

The pushed workbench baseline `3f6f2ed` passed every exact-head CI job. New v10
exact-head CI is tracked in the PR; that older result is not credited to v10.

## Remaining feasible work

Scores remain unchanged: the nested transition is coherent and the bare-rim defect
is repaired, but concrete figure, hinge, concealed-control and receiving-interface
problems remain. Live notes still reference R/P letters that are present in
published diagrams but absent from live geometry. Source-owned signs/figures need
separate preparation with conditional supplied-assembly guidance; some6350 final
wheel views need an outward feature-facing camera. Long programmes need bounded
chapters, more compact printing and complete source credits inside the booklet.
The PDF's retained separate torso-tray continuation illustrates that print limit.

Primary LEGO booklet comparisons remain distinct from community OMR order. The
pinned31025 building PDF has a five-stage bird inset and placement on page71, but
no quad sequence; this increment claims no primary quad-order match. No primary
6350/6361/6450 booklet is available in the pinned material. Source authors and
licences are retained in the archive notices and native source records.

The broad automatic-instruction goal remains open. These results demonstrate a
reviewable draft transfer, not physical fit/stability validation or exhaustion.

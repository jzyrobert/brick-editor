# Independent critic: refinement round 2

> Generated evaluation outputs referenced below are retained locally, outside
> this PR. See the [artifact policy](README.md#local-artifacts).

Reviewer: the independent critic agent, separate from implementation. Date: 2026-10-01. Target: hobbyist builders. This is a desk review of actual diagrams and the frozen `connected-bottom-up-v3` planner. No physical assembly, stability/force measurement, insertion-path validation or human builder study was performed.

## Evidence and changes

I reviewed all sixteen round-2 models in `.local/instruction-round2/renders`: nine samples and seven official-set representations, first through 116 selected views and then through the final expanded 183-view selection. The final evidence adds consecutive midpoint and late triples plus baseline failing occurrence IDs after renumbering. I re-read the expanded sheets or their newly added original PNGs. Final sheets contain 9–19 views each. This is still sampled evidence rather than an audit of every instruction. The round-2 metrics (local artifact) and linked sheets record the implementation under review. The [round-1 review](round-1-critic.md) and [original review](../instruction-critic.md) retain the LEGO booklet and research evidence.

The rubric remains part identification, placement/orientation, small coherent batches, task/view continuity, connected construction and separate assemblies, and honest uncertainty. Scores: **1 major reconstruction; 2 substantial editing; 3 useful editable draft; 4 plausible independent hobbyist guide after limited review; 5 polished guide supported by builder testing**. Sampling and desk review cannot justify 5.

Round 2 uses the built state at the beginning of a step for support/host prerequisites, separates functional regions within batches, gives the active region a persistent preference, prioritises downstream support chains, and expedites glazing through explicitly uncertain window-containment hints. Pictorial trays now decode full-pack images and supply full-catalogue names. The code's inferred support and window hints remain distinct from verified connections.

## Verified gains and regressions

House construction now starts with its structural body rather than yard details. Garden work appears much later. Its former final clear panes are installed at steps 30, 31 and 63 while the relevant enclosure is open. The estimated-fit note is honest. However, the two clear panes at step 30 remain hard to distinguish in the actual picture. Earlier placement is useful but needs destination cues as well.

Castle's tree no longer shares a wall batch. Windmill's tower and later grounds/pen work are separated. Train's tracked coach additions at steps 87, 89 and 99 remain legible and local. Shark now keeps more of its body work together, then its crab additions: the former body/claw interleaving is substantially reduced. These are observable task-order improvements.

Code inspection confirms that selected additions do not enter the built set until their entire batch is selected. Car step 2 no longer depends on a newly added lower support within the same picture. This closes a specific planner defect. It does **not** validate every apparent order for lateral, unknown or nonvertical fastening: final contacts are still not insertion precedence, and the picture can still show detached final-pose pieces requiring an unspecified construction operation.

Region persistence has a cost. Cafe step 117 adds an interior stair plate after the surrounding walls are present; the selected view shows no identifiable new placement. Its visibility-review steps rise from 11 to 34. The late enclosure/interior ordering needs an access exception. Lighthouse's final step 105 adds a black round plate concealed within the completed lamp. Enlarging a concealed part's region does not explain its placement.

Supplemental windmill evidence also shows that an expedience hint is not an enforced closure constraint: the barn frames appear at step 11 and their glass at step 33, when the roof is already present. The note still asks the builder to fit the glass “before closing this section.” That text does not establish that the intended access is available at this point. In contrast, house steps 63–65 place the upper pane immediately before roof plates close the enclosure, a useful ordering result.

The consecutive supplementary evidence preserves the cafe regression: steps 117–118 add stair plates and step 119 adds interior bricks, while all three views show only opaque exterior walls. Train steps 89–91, jeep steps 24–26 and playground's paving/barrel sequences remain local and readable. London steps 179–181 build a statue and tile in midair before adding its column, without a detached workbench/join action. Technic steps 40–41 continue growing a hose through separate helper links, and Shark step 44's red underside addition is mostly concealed behind the completed upper jaw. These additional observations do not change the scores below.

Fragmentation also increases. Castle grows from 107 to 149 steps and from 49 to 113 singleton steps; cafe from 124 to 155 steps and from 17 to 52 singletons. Strict prerequisite checks are useful, but these totals cannot be presented as a usability improvement. Prefer coherent independently attachable repeated batches where possible; do not recover compactness by reintroducing unchecked dependencies.

Full-pack trays are a real improvement: 6350's pizzas and minifigure components, 8832's pins and axles, and windmill's pig have useful pictures and names. The final jeep sheet also correctly pictures and names its windscreen, rim and tyre; an earlier inspection caught a file during regeneration, and that provisional missing-picture finding is corrected here. Alias `3023.dat` still displays “Moved to 3023b” without a picture in several official models. Canonical alias coverage needs follow-up.

## All sample judgments

| Model                       | Round 1 → round 2 / 5 | Actual finding                                                                                                                                                                                   |
| --------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| House (local artifact)      | 3 → 3                 | Better structural-first ordering and earlier glass fitting. Clear panes still need visible destination guidance; the plan grows to 124 steps.                                                    |
| Castle (local artifact)     | 3 → 3                 | Tree/wall batches are separated and wall courses are readable. 113 singleton steps introduce excessive tedium.                                                                                   |
| Car (local artifact)        | 3 → 3                 | Step-start support checking is repaired. Detached chassis pieces and rim/tyre fitting still lack action order; transparent lights remain indistinct.                                             |
| Jeep (local artifact)       | 3 → 3                 | Local body views remain readable and windscreen/rim/tyre trays are now complete. Early wheel-holder units are shown in their final separated positions; the last wheel detail is flagged hidden. |
| Windmill (local artifact)   | 3 → 3                 | Tower and pen tasks are better separated; pig identification is repaired. Final white grille placement still blends with the pale reference; glass guidance needs an actual visible target.      |
| Lighthouse (local artifact) | 3 → 3                 | Local course growth remains clear; the formerly mixed batch splits across separate steps. The final black plate is concealed inside the lamp and needs a changed order/view.                     |
| Cafe (local artifact)       | 3 → 2                 | Interior stair work follows enclosure and is concealed. Increased visibility flags and singletons support substantial sequence editing before independent use.                                   |
| Playground (local artifact) | 3 → 3                 | Small barrel and crate details remain clear. The 67-step, 110-occurrence plan has 52 singleton steps; task grouping is still tedious.                                                            |
| Train (local artifact)      | 3 → 3                 | Coach views remain readable and functional tasks are clearer. Track, station and vehicle work are still final-scene placements rather than explicit separate assembly actions.                   |

## Official-set judgments and booklet comparison

| Representation                            | Round 1 → round 2 / 5 | Finding                                                                                                                                                                                                                            |
| ----------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6350 Pizza To Go (local artifact)         | 2 → 2                 | Pizzas and minifigure identification improve. Legs are still built floating in the final scene, and actual subassembly/fastening operations remain implicit.                                                                       |
| 6361 Mobile Crane (local artifact)        | 2 → 2                 | Tyres and crane details are identifiable. The first picture groups several wheel operations, the boom joint lacks operation guidance, and moved aliases have no tray picture.                                                      |
| 6450 Mobile Police Truck (local artifact) | 2 → 2                 | Vehicle construction precedes signs/figure work, and wheel trays improve. Rim/tyre/holder operations remain grouped without an internal action sequence; signs and figures remain final-pose objects.                              |
| 8832 Technic Roadster (local artifact)    | 1 → 1                 | Axle names and pictures help identification. Steps 35–39 still count `~Hose Flexible Segment Link Section` 754 as installable yellow parts. Mechanism insertion, access and physical flexible-element ownership remain unresolved. |
| 21034 London (local artifact)             | 1 → 1                 | Ordinary base work is readable. The tracked local tube drawing segments reappear at 253–254 and 268; renumbering does not remove the physical-inventory failure. The plan grows to 357 steps.                                      |
| 31025 Mountain Hut (local artifact)       | 3 → 3                 | Building and roof work remain useful architectural drafts. Mixed tiny hidden additions and detached bird/quad work still need real workbench operations. The 225-step plan exceeds publication limits.                             |
| 31088 Deep Sea Creatures (local artifact) | 1 → 1                 | Body/crab task continuity improves. Underside additions in steps 33 and 36 remain concealed; the pictured shark lacks physical flip and jaw/module join operations. Unknown source transforms remain unknown.                      |

LEGO's London p36 illustrates a consistent pictorial base sequence; the generator meets more of that presentation requirement. Mountain Hut p71 builds a detached bird in five inset operations before an explicit join. Deep Sea Creatures p26 supplies inset operations and a physical flip, p36 builds a separate jaw, and p63 shows a tail join/rotation. Round 2's changed ordering still does not represent those operations. Camera rotation does not replace a physical flip.

OMR pairwise agreement changes in opposite directions: Shark improves approximately 32.7% → 63.3%; Hut falls 77.5% → 55.2%; Technic falls 72.8% → 66.7%. These measure agreement with fan-authored source steps, not usability or LEGO PDF equivalence. They neither cancel the observed visual gains nor excuse the operation failures.

Galaxy Commander remains unscored because strict rendering refuses unresolved body colours. Large town/cathedral/harbour samples remain unscored because generation rejects their budgets. No unavailable diagram receives a score.

## Concrete next priorities

1. Represent physical ownership of flexible elements while retaining their expanded drawing geometry. London's local tube segments and Technic's named hose helper sections are the clearest round-3 cases. Do not silently discard original geometry or claim every helper occurrence is a physical part.
2. Make region persistence yield to interior access/closure requirements. Cafe stairs and lighthouse's hidden lamp plate are concrete adverse examples. Source-file hierarchy is a task hint, not evidence that a module can safely be built separately or installed afterward.
3. Preserve unique physical inventory through genuine workbench build/join actions. A completed module's join can introduce zero new parts and still needs its own explicit action and destination. Keep feasibility UNKNOWN unless access/connection is actually checked.
4. Add visible destination markers or alternate views for glass, concealed additions and white-on-pale pieces. Continue tracking baseline occurrences after renumbering; include consecutive runs to evaluate continuity rather than only isolated successful pages.

Round 2 repairs a real batch-state defect and improves several functional task sequences. It also demonstrates why deterministic refinement must be judged on rendered placements and physical operations: stricter support rules and stronger locality can increase tedium or hide interior work. The feature remains an editable heuristic draft with explicit limitations.

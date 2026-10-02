# Deterministic draft followed by agent refinement

> Generated evaluation outputs referenced below are retained locally, outside
> this PR. See the [artifact policy](README.md#local-artifacts).

The third mode is a local workflow: generate and pin the latest deterministic
draft, let an agent make focused edits, validate the result against that baseline,
then have an independent critic compare actual pictures. Two builders tried it on
Roadster, House, Police Truck6450 and Shark31088. Local procedures improved; the
paired overall scores did not increase.

| Model            | Latest deterministic | Hybrid | Operations |
| ---------------- | -------------------- | ------ | ---------- |
| Roadster         | 3/5                  | 3/5    | 33→40      |
| House            | 3/5                  | 3/5    | 132→140    |
| Police Truck6450 | 3/5                  | 3/5    | 57→57      |
| Shark31088       | 2/5                  | 2/5    | 139→137    |

These are hobbyist desk-review scores. Roadster's paired programmes were viewed
completely. House, Truck and refined Shark use explicitly selected windows,
with source/replay audits covering the complete programmes. The latest Shark
baseline was viewed completely before refinement. This is one hybrid trial with
necessary repairs, separate from the historical three-round manual experiment
against v9. Those older manual scores are not a comparator for this trial.

## Tools and evidence boundary

`instructions:hybrid prepare` retains the source native, inspection, source
aliases and complete baseline proposal. A baseline hash pins the source, native,
plan, proposal, planning evidence, operation keys and tool versions. The agent
starts from that proposal. `refine` requires the original pin and emits a native,
source/replay audit, baseline delta and metadata-change audit. `review` selects
stable keys and neighboring states through the existing actual compositor.

Hard checks preserve all source identities, raw poses, colours, namespaces,
exact-once inventory, whole planning/drawing units and laminar module replay.
They retain support, host and access prerequisites and check actual destination
availability: an introduced but unjoined sibling is unavailable. Source STEP,
region and camera choices are editable draft decisions. Reviewed wheel/joint
actions, hosted incoming assemblies and adopted finite source procedures retain
their receiving identities and specific handling/conditional assembly clauses.
The tool conservatively requires the relevant curated wording, rather than
claiming to recognize equivalent paraphrases.

Only exact source/state/context/mask/view matches retain applicable baseline
metadata and CAD records. New or changed operations become UNKNOWN and lose
stale blocker annotations. The refined plan removes the automatic generation
report and has separate baseline-linked agent provenance, retained through native
and publication metadata. Subsequent structural or camera edits invalidate it.
The CLI runs no remote model, requires no key and introduces no backend. Agents
are supplied the [builder prompt](../../../prompts/instruction-hybrid-agent.md),
[critic prompt](../../../prompts/instruction-hybrid-critic.md) and
[tool guide](../../HYBRID-INSTRUCTIONS.md).

## What the agents changed

Roadster splits early loose floor batches into explicit parts and bridge actions,
with particular support decisions. Existing rim→tyre→placement procedures remain
intact. Actual inspection caught an overstated claim that the hidden holder studs
were visible; repaired captions acknowledge the obstruction. Mixed windscreen
and body additions and actual holder seating remain gaps.

Truck narrows the actual control slot and wrist views, preserving supplied torso,
arm/hand and joined-control alternatives and the known source pivot discrepancy.
No part order or module changes. Invalidated control context is omitted, but its
whole-vehicle main picture still supplies the location. The critic found both
wrist mouths and the slot clearer without awarding a whole-model score increase.

House separates several mixed pane/frame/wall actions, shows empty receiving
frames and the door aperture, separates chimney from ridge work, and supplies a
roof-free wall-ring view. The critic found two remaining blank underside views;
the repair names and pictures their actual prior frames and separates one more
pane/frame batch. One newly exposed untouched pane still has a poor alternate.
Transparent parts and loose roof handling remain limitations.

Shark moves the complete jaw preparation and placement earlier, immediately
after its actual handle exists, and groups two mirrored source-STEP pairs. The
two-clip receiving identity and completed-pair detail remain intact. Inspection
found overly wide jaw framing; all thirteen affected states received tighter
fresh pictures. The early join exposes the receiver but leaves later shell work
with a hanging jaw and conditional support. Other articulated body sections,
chest dependence and crab construction remain substantially unresolved.

All 655 source occurrences across the four cases remain exact. Retained hard
prerequisite counts are 240/2,007/310/0 for Roadster/House/Truck/Shark. Shark's
empty graph is not positive physical evidence. Final plans retain respectively
44/260/89/194 baseline CAD records and mark 15/17/3/36 affected or new operations
UNKNOWN. Retained records include prior unknown outcomes; none is a new check or
a manufactured-fit certificate.

## Critique, validation and practical conclusion

The critic's code review found a missing protection for flat figure/control
procedures. The repaired guard re-evaluates pinned source profiles and protects
only procedures actually adopted by the baseline. Actual Roadster/Truck no-op
and camera-edit regressions exercise it; removing a supplied-assembly clause or
naming a future receiver refuses the proposal. Baseline and current tool hashes
remain separate in the trial records.

Final native phone checks verify the agent plan opens by default, actual prior,
receiver/incoming/completed masks, restoration, next state and reachable notes
at 360×600 and 686×411. Full publication preserves source inventory, complete
action notes and refinement provenance; PDF composition uses exact accepted
HTML raster bytes, with every image rectangle checked. The independent
[critic report](hybrid-workflow-critic.md) and
evidence packet (local artifact) distinguish actual execution,
recovered pilots, reused images and selected visual scope.
The first Truck export wrapper returned143 after complete child output; a clean
direct CLI retry reproduces every ZIP entry byte-for-byte. The first House139
export is likewise a recovered superseded pilot; its final140 export returnszero.

The hybrid is useful for targeted visual and procedural repair with machine
checks around source and replay. It did not eliminate the harder support,
access, attachment and broader sequence decisions in this trial. More extensive
restructuring and physical builder evidence remain feasible next work; bounded
acceptance of these tools does not close whole-corpus instruction readiness.

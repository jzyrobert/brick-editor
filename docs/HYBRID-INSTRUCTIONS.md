# Refine the latest deterministic instructions

The hybrid workflow starts with a newly generated deterministic draft, lets an
agent make constrained edits, then compares the actual resulting pictures with
that same draft. It combines automatic source resolution and invariant checks
with focused manual procedure review. Use the
[hybrid agent prompt](../prompts/instruction-hybrid-agent.md) with an input path,
workspace and concrete review objective.
Use the separate [critic prompt](../prompts/instruction-hybrid-critic.md) for the
paired review.

This is a local maintainer workflow. It uses the pinned library and existing
instruction workbench, native format and renderer. Ordinary runs do not download
models. It adds no editor automation API or backend.

## Prepare and inspect

Use Node 22.14 or later from the repository root. Run `--help` for current flags.

```sh
npx tsx scripts/instruction-hybrid.ts prepare --input model.mpd --output .local/hybrid-case
```

Read `hybrid-baseline.json`, `baseline-plan.json`, `baseline-proposal.json` and
`inspection-summary.json` first. The workspace also retains `source.brickproj`,
`source.json`, `aliases.json` and the detailed `inspection.json`. The pinned
baseline records which deterministic version actually ran; an older report or
manual draft is not the comparator. Preserve the baseline artifacts throughout
the trial. Start `proposal.json` as a copy of `baseline-proposal.json`.
`hybrid-baseline.json` binds the source/model/native, plan, proposal and tool
hashes and the ordered operation keys. Its `algorithm` identifies the generator;
its `baselineHash` is the pin used below. Do not edit this record to make a
changed baseline pass.

Ask the existing workbench for a small interface dossier rather than pasting
the full model into an agent prompt:

```sh
npm run instructions:workbench -- inspect --workspace .local/hybrid-case --parts p0001,p0002 --detail
npm run instructions:workbench -- inspect --workspace .local/hybrid-case --group SOURCE-GROUP
```

Render and **open** actual baseline windows before choosing a repair. Select
stable operation keys and adjacent states; `--steps` accepts displayed numbers
when no key selection is available.

```sh
npx tsx scripts/instruction-hybrid.ts review --input .local/hybrid-case/source.brickproj --plan-id baseline --output .local/hybrid-case/baseline-review --steps 1-3 --neighbors 1
```

Name the failure and intended repair using operation keys and source aliases.
For example, a wheel receiving view should show the bare holder pin, while the
incoming view should show the completed wheel. An underside foundation needs
an ordered construction window and a concrete temporary-support decision.
A marker on a large part does not establish that its socket is visible.

## Edit a complete proposal

The format is the existing
[workbench proposal](AGENT-INSTRUCTIONS.md), including its
[CameraSpec example](AGENT-INSTRUCTIONS.md#ordering-and-camera-overrides).
The hybrid tool does not introduce a separate action schema. Keep the full
source coverage and unchanged operation keys; additions use stable part aliases.
Each occurrence has one introduction, including members of nested modules.

This small format example is valid only for a prepared input containing exactly
these two aliases and no conflicting protected procedure or prerequisite:

```json
{
  "schemaVersion": 1,
  "name": "Reviewed draft",
  "sourceHash": "COPY FROM source.json",
  "operations": [
    {
      "key": "base",
      "additions": ["p0001"],
      "notes": "Prepare the base with its studs facing up."
    },
    {
      "key": "top",
      "additions": ["p0002"],
      "receiving": ["p0001"],
      "notes": "Locate the exposed studs before positioning the top piece."
    }
  ],
  "before": [["p0001", "p0002"]],
  "reviewTasks": ["Check the pictured receiving studs and the actual fit."]
}
```

For a real model, edit the supplied complete baseline proposal. Preserve reviewed
wheel/joint membership, parent/destination and procedural order. Improve views
or captions around those procedures without replacing a rim → tyre → placement
sequence with a single installed-pose batch. A new module needs complete,
nonmixed ownership, named receivers already assembled on its destination, and
valid child-build → child-placement → parent-placement replay. Source groups
are organizational evidence; they do not certify detachable stability.

Retain every source pose, colour, reference, namespace and whole generated
drawing owner. Preserve support, host and access prerequisites. A part introduced
on another loose bench is not automatically available at the receiving bench.
Do not remove a constraint because a proposed contraction creates a cycle.
Treat refused restructuring as a result and choose another bounded repair.
Local custom definitions continue to shadow library parts.

## Refine, audit and render

Use `hybrid-baseline.json.baselineHash`, also printed by preparation, as HASH
below. This is distinct from the source hash:

```sh
npx tsx scripts/instruction-hybrid.ts refine --workspace .local/hybrid-case --proposal .local/hybrid-case/proposal.json --baseline-hash HASH --output .local/hybrid-case/refined
npx tsx scripts/instruction-hybrid.ts review --input .local/hybrid-case/refined/result.brickproj --output .local/hybrid-case/refined-review --keys CHANGED-KEY --neighbors 1
```

Read `hybrid-delta.json`, `hybrid-audit.json` and the workbench `audit.json`.
Keep `proposal.json`, `authored-plan.json` and `result.brickproj` with them.
The comparison should identify actual membership, ordering, action/view and
claim changes against the pinned baseline. Any retained derived metadata must
remain applicable to the exact source, replay state and view. Changed actions
must not inherit stale clear-path claims. A conservative unknown CAD outcome
is distinct from a failed invariant and from a physical-impossibility claim.

Open the refined gallery and individual main, incoming, receiving and context
images. Check true-before masks, quantities, receiver landmarks and access in
consecutive states. Use camera overrides only after inspecting the actual
geometry. A physical reorientation or loose holding decision needs a specific
builder check; a different camera does not perform that action. Notes should
identify actual features without relying on publication-only letter markers.
Re-run refinement and capture the changed windows after repairing them.

## Independent comparison and delivery

Give an independent critic the pinned baseline, refined native/proposal,
audits/delta and both capture manifests. Have the critic inspect pictures before
the builder's explanation. Compare corresponding occurrence/action windows
against the **latest** baseline, including critical unchanged procedures; an
older manual's score cannot stand in for this comparison. Record concrete
repairs, regressions, remaining decisions and the inspected scope. Passing a
source/replay audit or adding warnings earns no automatic usability credit.

Keep brief `builder-notes.md` with baseline/refined operation-key mappings,
reviewed images, supported edits, rejected requests and unresolved tasks.
Include `source.json` and original author/licence notices with shared artifacts.
Report full versus selected review truthfully. When publication is requested,
export the actual plan using the existing [CLI](CLI.md), then inspect real PDF
pages and HTML/native views at 360×600 and 686×411. Publishing retains its
200-operation, 5,000-occurrence and capture-pixel limits. Report a refusal rather
than dropping source parts or treating a selected gallery as a full booklet.

The earlier [three-round critic](reports/instruction-generation/agent-workflow-critic.md)
provides useful defect examples and a desk-review rubric. Its manual-case scores
and historical deterministic baseline are not results for this workflow.
Neither visual review nor CAD translation checks prove physical fit, support,
stability, permissible mechanism angles, tyre deformation or a successful
builder trial.

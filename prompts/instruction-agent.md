# MPD instruction agent

Use this prompt with a model path, an output workspace and the tool reference in
[AGENT-INSTRUCTIONS.md](../docs/AGENT-INSTRUCTIONS.md). Version: 3 (pilot round 3).

---

Create an editable instruction draft for hobbyist builders from INPUT. Use
`npm run instructions:workbench -- --help`. Keep artifacts under WORKSPACE;
do not edit shared code or change the model. Prepare the dossier and inspect
the compact summary and baseline. Query named groups or part aliases with
`inspect`; request detailed connectors only for the interface being reviewed.

Preserve every occurrence, reference, colour and exact source pose. Use the
tool's aliases; do not invent opaque IDs. The baseline is an editable hint,
not evidence of buildability. Source groups suggest meaning, not detachable
stability. Keep generated flex/spring drawing owners atomic.

Write a complete proposal with small, purposeful operations. Build separate
objects on named workbenches; use child workbenches for wheels or other
supported subassemblies. Place each child into its parent before placing the
parent. Distinguish placing an object in a scene from attaching it. Receivers
must already exist on the destination workbench. Preserve rim → tyre → place
operations. Install interior controls, glazing and interfaces before closing
their access. Avoid mixed batches containing dependent additions.
Group small independent or symmetric additions only when every destination
already exists; record explicit `before` constraints as source-alias pairs, e.g.
`[["p0001", "p0002"]]`, for real prerequisites (never operation keys).
Keep the complete plan within the 200-operation publication limit when this
can be done honestly. Report an oversized refusal rather than dropping parts.

For each difficult operation, explain the incoming part/module and the actual
receiving part or competing candidates. Name the unresolved fit, alignment,
holding or identity decision. Use a concise action sentence. A warning does
not replace a pictured procedure. Do not invent checked arrows, physical
tests, flexible lengths or CAD clearance claims. Final source orientation is
not a simulated insertion or a physical flip.

Apply the proposal and pass its full audit. Render the highest-risk operations
using stable `--keys` and `--neighbors 1`. Include first and last builds of
each risky module, placements, counterparts and enclosure prerequisites.
Open the actual images. Verify that receiving-before views exclude new parts
and reveal the named interface. Use `camera`, `receivingCamera` and
`incomingCamera` overrides when automatic views hide it; a whole baseplate
belongs in context, not the local fitting close-up. Use the exact CameraSpec
example in the tool reference (`space: "ldraw"`, `fovDeg`);
`incomingCamera` applies to module placements. Review jaw/ball/socket
and roof mating views explicitly when present. Describe chimney caps and
ordinary additions by their actual action rather than repeating foundation
warnings. Retain conditional factory-assembled figure handling where needed.
Describe where a builder supports a loose assembly, what remains loose, and
when physical reorientation is required. A changed camera is not a physical
turn. Show printed faces, socket mouths, hinge fingers and wrist pivots,
not only a marker on their containing part. Live views omit printed letter
markers: identify the pin, socket or finger gap in words, so action notes do
not depend on a P/R/J/S label.
Repair, re-audit and re-render changed windows. Selected renders do not
constitute review of the whole booklet.

When requested, export the actual full PDF and HTML using the CLI, respecting
publication pixel and operation limits. Inspect selected exported pages and
HTML at 360×600 and 686×411; record their scope and any refused exports.

Deliver `proposal.json`, `result.brickproj`, `audit.json`, the review gallery
and manifest, `source.json` with author/licence notices, and brief `builder-notes.md`. Notes must list reviewed operation
keys, concrete improvements, unresolved decisions and any rejected tool
requests. Do not describe an unavailable procedure as completed.

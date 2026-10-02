# Author instructions from an MPD

An agent can propose assembly operations while the workbench resolves source
identity, validates replay and renders actual diagrams. The result is a manual,
editable instruction plan. It has no inherited generated clearance claims.
Use the [short agent prompt](../prompts/instruction-agent.md) with a concrete
input path and workspace.

To refine a freshly generated deterministic draft with pinned prerequisites and
an exact baseline delta, use the [hybrid workflow](HYBRID-INSTRUCTIONS.md).

Run with Node 22.14 or later from the repository root. Ordinary runs use the
pinned local library; they do not fetch models.

```sh
npm run instructions:workbench -- prepare --input model.mpd --output .local/my-guide
npm run instructions:workbench -- inspect --workspace .local/my-guide --parts p0001,p0002
npm run instructions:workbench -- apply --workspace .local/my-guide --proposal .local/my-guide/proposal.json --output .local/my-guide/result
npm run instructions:workbench -- review --input .local/my-guide/result/result.brickproj --output .local/my-guide/review --steps 1-5,12-14
```

Prepare writes stable occurrence aliases, exact poses, named source groups and
a deterministic baseline. Read the compact dossier first, then the details of
the particular interface being improved. An MPD file-local part can shadow a
library name; its source geometry and namespace remain authoritative.

Write a JSON proposal using aliases. Each real occurrence appears in exactly
one addition operation. Module membership can include a child's members, but
the child owns their introductions. Build a child on its own bench, place it
into its parent, then finish and place the parent. A scene placement denotes
positioning a completed object; it asserts no mating connection.

```json
{
  "schemaVersion": 1,
  "name": "Hobbyist draft",
  "sourceHash": "COPY FROM source.json",
  "modules": [
    {
      "id": "vehicle",
      "name": "Vehicle",
      "members": ["p0001", "p0002", "p0003"],
      "placement": "scene"
    },
    {
      "id": "wheel",
      "name": "Wheel",
      "members": ["p0002", "p0003"],
      "parentId": "vehicle",
      "purpose": "wheel",
      "receivers": ["p0001"]
    }
  ],
  "operations": [
    {
      "key": "holder",
      "additions": ["p0001"],
      "workbench": "vehicle",
      "notes": "Prepare the wheel holder."
    },
    {
      "key": "rim",
      "additions": ["p0002"],
      "workbench": "wheel",
      "notes": "Prepare the rim separately."
    },
    {
      "key": "tyre",
      "additions": ["p0003"],
      "workbench": "wheel",
      "notes": "Fit the tyre around the rim; check seating all around."
    },
    {
      "key": "wheel-place",
      "place": "wheel",
      "notes": "Locate the holder pin; check receiving fit before pressing."
    },
    {
      "key": "vehicle-place",
      "place": "vehicle",
      "notes": "Position the completed vehicle in the scene."
    }
  ],
  "reviewTasks": [
    "Confirm the source wheel/holder pairing and fastening by physical trial."
  ]
}
```

This is a format example, not a buildable three-part vehicle. Your proposal
must cover the whole input. Apply rejects repeated or missing parts, invalid
ownership and joins, and receivers missing from the destination bench. It
preserves the source model and strips old derived claims. Generated flexible
drawings must retain their whole owner; they do not become a verified loose
parts list.

Review selected consecutive operation windows, including incoming objects and
the actual receiving state. Open the images and revise the proposal when the
action is unclear. The same compositor serves the editor and publication.
The native result can be opened in Brick Editor or exported using the existing
[CLI instructions command](CLI.md). Full publication retains its 200-step and
5,000-occurrence limits. A selected review gallery is not a complete booklet.

Passing an audit establishes source identity, exact inventory and replay. It
does not establish detachable stability, a physical insertion path, deformable
tyre fit or flexible-element identity. Use concrete review tasks naming the
parts, receiving interface and decision still needed. See the
[research](reports/instruction-generation/agent-workflow-research.md) for the
workflow's sources and experimental scope.

## Ordering and camera overrides

`before` contains pairs of **part aliases**, not operation keys:
`"before": [["p0001", "p0002"]]`. This requires the first occurrence to be
introduced before the second. Nested module placement order is also validated.

An operation accepts `camera` for its main view and `receivingCamera` for its
bare receiving view. Module placements also accept `incomingCamera`. Use an
exact CameraSpec, for example:

```json
{
  "space": "ldraw",
  "position": [100, -100, 100],
  "target": [0, 0, 0],
  "up": [0, -1, 0],
  "projection": "perspective",
  "fovDeg": 35,
  "near": 0.5,
  "far": 10000
}
```

Coordinates must come from the dossier and source geometry. This example is
only a schema example. It does not establish a suitable view of your model.
Render the result and inspect the pictured interface. A camera change does not
instruct a builder to physically turn the model.

`inspect --group NAME` selects a source group; `--detail` includes connector
details for selected aliases. Default summaries are truncated explicitly; full
source information remains available in the dossier. Review by stable keys,
e.g. `review --input result/result.brickproj --output review --keys wheel-place
--neighbors 1`. The manifest records exact selected operations, source/plan/tool
hashes and capture requests.

Export the actual authored plan with `npm run cli -- instructions --input
result/result.brickproj --plan-id agent --format pdf --output draft.pdf --width
600 --height 450` (or `html-zip`). The full publication also counts auxiliary
views against its 64-million-pixel limit. Choose smaller dimensions when needed;
do not omit source occurrences. Inspect exported pages and HTML at phone sizes
as well as the review gallery. Keep the workspace’s `source.json` and original
author/licence notices alongside shared diagrams and publications.

Live editor/viewer diagrams currently omit the publication's letter markers.
Write notes that identify the pictured receiving feature directly, rather than
requiring a P/R/J/S label. Exported diagrams retain those markers and captions.

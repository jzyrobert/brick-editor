# Reviewed mechanism entry: implementation evidence

This slice adds explicit mechanical proposal review and session-only entry to
Play. It does not certify physical rack contacts or change the reviewed feature
pack. The source arrangement remains authoritative until an explicit save or
posed export.

The entry sheet uses the incumbent warm workshop controls and the existing
Mechanisms tab. Assembly scope is explicit: all visible parts or the Build
selection. Builders choose fixed parts, then inspect fixed/moving groups,
joints, transmission relations, warnings and unresolved connections. Both Try
and Save refuse unresolved connections and selected parts without a group.
Authored ownership is preserved. Hidden parts are excluded from the UI flow;
the API retains its explicit `includeHidden` contract.

The motor selector chooses one supported input occurrence. UI speed is bounded
to ±360 degrees/s or LDU/s and effort to 0.01–1,000 N·m or N. Linked outputs remain
passive. Try enters an ordinary Kinematic or Dynamic Play session using a private
source project, and opens the existing whole-mechanism controls/overview.
The reviewed request and motor settings survive leaving Play, so Save after
trying uses the original source revision and rest transforms. Save repeats the
review checks and uses the existing undoable `rigs.upsert` command. A stale
revision requires another review.

`prepareMechanicalProposal` is shared by UI and automation. Its existing
2,048-part analysis limit is retained. `reviewedProposalProject` requires all
selected parts to be accounted for and refuses existing rig ownership.
`BrowserPlay.enterProposal` checks source revision and entry epoch before
starting the standard, budgeted Play preparation. Session rigs are presented by
`getSessionRigs`; they are not installed on the editor. API additions are
`mechanisms.tryProposal` and `mechanisms.saveProposal`. Proposal results expose
`drivers`, mapping each supported joint to its motor input occurrence.

## Verification

- The original focused three-file unit run passed 17 tests. The added cancellation
  test file passed both tests after a browser-global harness correction, for
  18 accepted focused tests in total. Coverage includes full private-copy source
  preservation, stale/uncertain/owned drafts, unassigned-part refusal, drivers,
  save/undo and cancellation before Play allocation.
- The final production browser run passed eight tests in 2.6 minutes: deterministic
  unsaved Kinematic and Dynamic Technic sessions plus six UI viewport cases.
  Both input modes advance the reviewed 8:24 drive. Kinematic relation error is
  below 0.0001 degree; Dynamic below one degree. Mode reporting is asserted.
- During the unsaved sessions, query results, normal LDraw export, inventory
  preview and decoded native `project.json` remain identical. Posed export differs
  as requested. A stale attempted entry leaves the current session unchanged.
  Explicit save creates authored ownership; undo removes it.
- UI cases exercise 1440×1000, 1080×1800, 360×600, 411×685, 390×844 and 686×411.
  Controls open directly after Try; explorer joystick disappears during mechanism
  control. Visible control buttons meet 44 px targets. The 360×600 case leaves
  Play and saves the retained motor configuration through the review UI.
- Final type-check and changed-file formatting pass. Production build passes.
  The Rapier WASM marker `AGFzbQE` occurs only in lazy `session-Dtzo4PGE.js`,
  not the main application chunk. No dependency, external asset or backend
  was added. Private preview port 4404 is stopped after the browser run.
- A batched desktop/mobile inspection and one confirmation batch opened all
  12 final review/playing captures. Existing header, Gallery navigation, warm
  sheet styling, mechanism framing and touch controls are preserved. Impeccable's
  detector reports only two inherited advisory `17px` radii in `play.css`.
  Fresh finish review and documentation handoff are integration work; this
  implementation evidence is not a whole-surface design approval.

Final verified source hashes:

| File                                         | SHA-256                                                            |
| -------------------------------------------- | ------------------------------------------------------------------ |
| `src/play/browser.ts`                        | `8e2ee3737355a00bec0f2e45568a59555ad3b6a05b2a5d122723e5bec32b3f17` |
| `src/ui/PlayMechanismSetup.tsx`              | `29b4a96aab56408b462546b5ea8a7698f3433138512d5bd8a01f26fc9e2248ba` |
| `src/ui/PlayPanel.tsx`                       | `0b327ca6bd20cb9162706248beed93948c86b713d060520228cf8992817691fe` |
| unchanged `src/ui/PlayMechanismControls.tsx` | `ca7ff04e8285b1e33466a3793a53b08b9255076ef89007ffa17a3e6c449bbf82` |

These are child-worktree verification hashes; integration with other parallel
changes requires the parent to record its final combined hashes and verification.

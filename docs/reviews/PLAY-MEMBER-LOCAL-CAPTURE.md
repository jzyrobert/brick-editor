# Canonical Play member capture — 4 October 2026

The renderer can now provide canonical part-local collision surfaces from the
actual loaded occurrence prototype, before its placement is rounded into world
Float32 vertices. `SceneAdapter.playMemberGeometry(ids)` returns the optional
`PlayMechanismSource.memberLocals` input; existing world members and group meshes
remain available. This is source capture, not acceptance of rack contacts or a
new native proxy.

Each record retains its occurrence ID, revision, namespace, exact authored
frame, Float64 vertices, Uint32 triangle indices and local bounds. Only each
drawable's prototype-local matrix is applied. The current occurrence/world
matrix, transient pose and inverse world transform are excluded. Internal
mirrored drawables reverse winding; occurrence mirrors remain in the authored
frame for the consuming geometry policy to accept or refuse. Project/custom
same-name definitions use their actual prototype and cannot borrow an official
shape by filename. The loaded prototype already incorporates renderer source
context, embedded dependencies and raw records.

Browser entry captures the union of complete requested rig member IDs once,
then partitions the same records between rigs. Preflight counts every logical
member, including sparse-indexed unused vertices, before allocating canonical
buffers: the existing 600,000-source-vertex and 200,000-moving-triangle ceilings
remain in force. Validation requires complete maps with no extra IDs, matching
world-member sizes, source revision/namespace/frame, finite geometry and valid
indices/bounds. Combined validation repeats the aggregate guard before physics
allocation. Legacy injected renderers can omit the optional capture method;
production `SceneAdapter` supplies it and a failed capture is propagated.

Buffers are preallocated and shared by identical prototypes within that request;
consumers treat them as read-only session inputs and clone before mutation.
Records, authored frames and bounds are frozen. Typed-array storage itself is
not frozen: JavaScript does not support freezing nonempty typed arrays. The
internal ownership contract supplies immutability. The prototype cache is reset
between requests, avoiding retained canonical copies from previous Play builds.
The maximum unique canonical payload for one admitted union is 16.8 MB
(14.4 MB positions plus 2.4 MB indices), before metadata; sharing reduces this.
There is no new download, worker, runtime asset, dependency or Rapier import in
the renderer/capture code.

`tests/helpers/play-dynamic-source.ts` now identity-compiles canonical references
with their original occurrence BFC/color context and embedded dependency closure.
Simply changing its old world output to Float64 would not remove the loader's
prior world rounding. Pinned test sources do not replace embedded same-name
files. The helper returns canonical inputs alongside its existing world meshes.

Focused verification: 42 cases passed across canonical capture, rack refusal,
general mechanical contacts, browser session lifecycle and seats in 16.70 s.
The final additional sparse-index/previous-request-cache case brings the union
of covered tests to 43; all six capture cases pass in 1.15 s. Type checking passes.
Tests cover placement independence, prototype sharing, local mirrored winding,
missing/empty/malformed geometry, whole-request source limits, embedded override
isolation, complete source binding and unchanged authored source/rest occurrences.
Production browser/offline verification is recorded in the follow-up handoff.

The native consumer must still prepare canonical children in local coordinates
and compose their placement through `inverse(group.frame) ∘ member.frame`.
Rotating the point cloud back into world coordinates before native hull admission
would reintroduce the original microgeometry problem. Native precision, source
proxy acceptance, contacts and whole-volume proofs belong to that separate
integration; this change does not claim them complete.

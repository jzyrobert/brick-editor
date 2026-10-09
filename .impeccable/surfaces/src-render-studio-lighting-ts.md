---
version: 1
slug: "src-render-studio-lighting-ts"
primary_target: "src/render/studio-lighting.ts"
related_targets: ["src/render/look.ts"]
---

# Realistic studio refinement

Mode: Experience. Extend the existing rendered brick world and preserve the
workshop interface. User request: improve Realistic without the performance
weight of Photo; start with lighting and material tuning.

THESIS: Readable moulded plastic, with broad studio highlights and clear curved
surfaces during interactive viewing.
OWN-WORLD: Existing real LDraw geometry and colours, studio environment, fitted
cached shadows and finish-specific materials. Preserve DESIGN.md's workshop.
STORY: Open or orbit a build in Realistic and see its shape and finish immediately.
FIRST VIEWPORT: The model remains the focal artifact on its existing backdrop;
lighting and ABS reflections gain clarity without adding controls or UI chrome.
FORM: Narrow refinement of the established renderer; no replacement visual world
or new page composition.
FINISH: Compare matched desktop and mobile renders of the finish fixture, house
and jeep. Check draw calls, triangles, shadow-map reuse and frame costs. Phone
Realistic retains its direct draw, with AO and vignette off. No additional scene
passes, runtime assets, shader sampling or path tracing. Real-device performance
remains unverified on this software-WebGL development machine.

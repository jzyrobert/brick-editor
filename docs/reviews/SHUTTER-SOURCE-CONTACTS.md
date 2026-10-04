# Shutter source covers and available swing

The original CC0 `fixtures/ldraw/omr-doors.mpd` study places the official 3582
shutter in its 3581 holder, both directly and through a rounded, rotated
submodel. Its rendered shutter surface has a hinge spine only between local
Y4 and Y44. A whole-part convex hull lofted that spine into the Y0..4 and
Y44..48 end bands. The resulting invented material produced a roughly
2.66 LDU deep holder contact and stopped the browser's requested +60° at 1.5°.

`door-leaf-solids.ts` now clips the actual captured triangles into three
conservative convex covers at Y4/Y44. Only triangles strictly participating
below/above those planes contribute to the end covers: a broad coplanar body
face cannot reintroduce the spine loft. Every original vertex and sampled
triangle centroid remains covered; the source, placement, part inventory and
LDraw library headers are unchanged. These covers do not exclude contacts.
The pinned part is by Willy Tschager (Holly-Wood), CC BY 4.0; the holder is by
James Jessiman, CC BY 4.0. The source files retain their original attribution.

The actual positive swing still meets the holder's end tab. The negative
swing is free. The former entry classifier's inset whole hull intersected at
rest, causing its generic “both” fallback to offer the obstructed direction.
The reviewed three-cover shutter now uses a private kinematic pose preview
and the **same** source-bound world/holder contact predicate as runtime motion.
It checks each direction in bounded subsegments (at most 0.25 LDU surface
travel, with further subdivision when required), keeps the 0.001 LDU guard,
and leaves the published pose and walking proxies untouched. The existing
1024 segment, 200,000 pair-check and 200,000 enumeration limits apply across
both directions. Only completed 5° ranges of at least 15° are offered. Budget
exhaustion may conservatively truncate a range or leave an unverified side
unavailable; this does not prove that side physically obstructed. The
nine-door study verifies a negative range sufficient for the requested −60°
(the square shutter's bounded preview reaches 65°). Other door families and
custom project parts retain their existing entry classifier.

`tests/unit/play-shutter-solids.test.ts` verifies actual source cover support,
native end-band rays, captured-local/legacy geometry equivalence, origin and
nested rotated placements, and a reversed proper-rotation installation that
selects the opposite free side. Both unchanged shutters in the original study
reach −60°. A direct +3° request is stopped by the real holder. A 0.1 LDU thick
foreign wall stops negative opening; removing it permits retry. Closing
approaches the holder/end-panel tangent. Near rest, predictive subdivision
exhausts the unchanged safety-check budget and conservatively stops short
(±1.5° in the standalone fixtures); this is **not** proof of physical
obstruction at that angle or certification of full zero-angle closing. The
original nine-door probe reports “This mechanism is too complex to check
safely. Try fewer moving parts.” Reopening remains usable. Full closing
certification at this tangent is a remaining limit. No frame, floor, hinge,
body-wide or foreign contact is exempted.

Verification commands:

```sh
npx vitest run tests/unit/play-shutter-solids.test.ts tests/unit/play-door-leaf-solids.test.ts tests/unit/play-auto-doors-omr.test.ts
npx tsc -b
npm run build
BROWSER_WORKERS=1 npx playwright test -c .local/shutter.config.ts --project=main tests/browser/official-set-doors.spec.ts
```

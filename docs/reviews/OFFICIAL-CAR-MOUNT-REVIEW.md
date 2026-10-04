# Source-supported official road cars

This bounded review extends session-only ordinary car driving to three real OMR
car assemblies. Driving does not require a motor; other unsupported mechanics
remain static. The source document, metadata, part placements and inventory are
never rewritten by detection or runtime driving.

The reviewed car excerpts and their exact upstream hashes are attributed in
[the fixture notice](../../fixtures/play/official-cars/NOTICE.md). OMR files are
fan-authored models of official sets, under CC BY 2.0. The selected records and
licensed headers are unchanged. Official part geometry comes from the pinned
`ldraw-full-2026-09-28` pack, manifest SHA-256
`93042f4a636a15655f350c5309bb14086ad53e9df0654b3c2d0af32bfd799ce7`;
no library file or generated asset changes are needed.

## Reviewed interfaces

| Source assembly     | Actual wheel composition            | Actual mount                              | Source pin/hub coordinates, local LDU                       |
| ------------------- | ----------------------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| 6503-1 Sprint Racer | Four `4624` rims and `3641` tyres   | One `2441` car base carries both axles    | `wpin2a` roots X±22/Y5/Z±50; authored rim hubs X±32/Y5/Z±50 |
| 31027-1 Blue Racer  | Four `93593` rims and `50951` tyres | Two stud-connected `6157` wide-pin plates | `wpin` roots X±32/Y5/Z0; authored rim hubs X±40/Y5/Z0       |
| 30572-1 Race Car    | Four `93595` rims and `50951` tyres | Two stud-connected `6157` wide-pin plates | Identical source hub/seat, wheelbase 120 LDU                |

`2441.dat` and `6157.dat` are James Jessiman source parts. The former's four
literal pin references establish two axles on one physical base; no connection
between separate chassis pieces is invented. The latter's two holders must be
connected through the bounded source stud graph. The reviewed stud subsets are
`2441` end groups X±10/Y0/Z±50 and middle studs X{-30,-10,10,30}/Y8/Z{-20,0,20},
and `6157`'s four X±10/Y8/Z±10 studs. Existing `4600` and `3788` subsets are
retained. All other graph edges require already verified connector data.

`93593.dat` is Philippe Hurbain's rim; `50951.dat` is Michael Heidemann's tyre.
The alternate `93595` spoke design by Philippe Hurbain references the same
`s\93593s01.dat` hub at the identical literal transform, with different spoke/face decoration.
Both rims and the tyre share the local-Z hub axis and zero hub offset. The complete compiled tyre
radial vertices fit 19.001 LDU. Existing `3641` uses 18.001 LDU. Actual bounds can
increase the declared radius conservatively; no geometry is shrunk. These two
zero-offset tyres have reviewed symmetry across the hub plane, permitting the
reversed axial tyre orientation written in Sprint Racer. The directional
`6014b/56890` offset and source seating checks remain unchanged.

Wheel/tyre pairing and pin seating still use the existing 0.5 LDU tolerance and
parallel-axis threshold. Exactly four wheels must form two parallel horizontal
axles with a level stable wheelbase. A tyre or pin seat cannot be shared. Holder
identity includes its source axle position, so `2441`'s two axles are distinct.

Chassis membership starts with actual source stud connectivity, then includes
bounded official decoration within the non-root authored car submodel and its
nested descendants. This preserves Blue Racer's nested rear assembly while
leaving independent root scenery outside. It is an authored assembly association,
not a generic proximity weld or a theorem that every decorative attachment has
been certified. A different wheel assembly, reserved mechanism, unsupported
member or out-of-bounds descendant refuses that candidate rather than being
silently swept into its chassis.

## Orientation and limits

Automatic group frames follow the measured horizontal axle direction with an
exact rigid yaw basis. Source member matrices and rest transforms remain intact.
Wheel ordering/steering uses that frame rather than world Z. Kinematic travel
adds the chassis rest heading to its translation direction; reported heading
remains a delta from rest, as does the existing rotation/pose export. Identity
rest frames retain the original driving direction.

Explicit posed exports preserve authored decimal bases. The existing strict
absolute rigid-transform path remains; a rounded source member can also export
when its original satisfies the existing LDraw member allowance and
`posed * inverse(original)` is a strict proper rigid transform. Added scale,
shear, reflection and nonfinite data refuse this path. No normalization is
written back into the source. This resolves actual Race Car rounded-part export
without increasing the tolerance for newly supplied motion transforms.

Only complete compiled-source tyre bounds participate. Session-only ground is
chosen beneath the supported vehicle and included source, preserving authored
placement; see [the ground review](VEHICLE-SESSION-GROUND.md). An unrelated
source obstacle remains an obstacle when that temporary plane is lower.

The source detector still caps vehicles at eight, members at 600 per vehicle,
wheel parts at 256, holders at 128, nearby candidates at 2,000, connectors at
20,000 and graph comparison work at 100,000. Nearby bounds are only a bounded
candidate filter: connectivity still determines which holders share a chassis.
The horizontal candidate search uses ±260 LDU in both X and Z to accommodate
rotated versions of the same bounded car. Existing Play rig/group, world geometry
and collision-query limits remain in force. Trains and authored rigs reserve
members before automatic car detection.

## Verification scope

The portable tests use attributed car excerpts, with original part transforms
and headers. Unit cases cover 0°, 37° and 90° placement, exact stored rest/source
and inventory preservation, correct holder membership, forward travel, neutral
stop, reverse and steering. Negative cases cover floating/copied wheels, a
nonhorizontal axle, disconnected wide holders, and independent root scenery.
The compiled new tyre radius is measured from all source vertices. Existing
car/jeep source tests and kinematic steering tests remain acceptance checks.

The focused source/kinematic batch passes 36 checks in four files; the scoped
rounded-source export batch passes 23 checks in three files (including overlapping
real-car cases). The production build passes in 36.33 seconds. Six portable
production browser drive cases pass at 1440 × 1000 and 360 × 600; Race Car is
placed at 37° in both screen sizes. They check forward travel greater than
100 LDU along the actual rest-forward axis, neutral stop, more than 40 LDU reverse,
steering, posed export, unchanged source/query/inventory and no horizontal page
overflow. Default temporary ground is enabled; no source shift or ground override
is used. Vehicle motion uses the existing kinematic driving and conservative
compiled-source world protection, not a new dynamic-car implementation.

Private maintainer production checks also pass all four full-original cases
in 59.1 seconds: Blue Racer and Race Car on both screen sizes. The downloaded
Blue Racer contains 67 parts: exactly 59 car parts move and all eight separately
rooted cone parts remain static. All 68 Race Car parts move; original editor
metadata remains intact. These checks fulfill local mocked OMR requests and
compare the complete imported source state after exit. The full original file
hashes are in the fixture notice; originals and private test scripts stay out
of the repository.

The full Sprint Racer source includes an independently rooted seated minifigure
which remains outside the source-connected car; its foreign collision stops the
car. This was measured in a production default-ground run: world protection
reports “Vehicle stopped before intersecting included world or another rig”.
No passenger weld or inferred seat is added. Its portable car excerpt
omits that figure explicitly. The two other full models have no passengers;
Blue Racer's separate cones remain outside its car assembly.

A separate production negative adds a real root-level `3001` blocker. The car
travels then stops before intersecting it; only the 59 car parts enter the posed
export, the blocker remains static, and all 60 original parts/source records
remain unchanged (24.5-second check).

No general articulated vehicle, inferred seat, arbitrary-cylinder wheel or
universal part-attachment coverage is claimed.

Other handpicked official sources remain unsupported: cached 6350/6450 have
literal unseated wheel offsets, 6361 has three axles, 8832 has an unsupported
Technic axle/rim arrangement, and 7601/4309 use unreviewed or mixed wheel families.
No placement repair, chassis proximity weld, generic cylinder exception or
relaxed seat tolerance is used to make those models drivable.

Reproduce the portable checks:

```sh
npx vitest run tests/unit/play-auto-vehicles.test.ts tests/unit/play-official-car-mounts.test.ts tests/unit/mechanisms.test.ts tests/unit/play-vehicle-steer.test.ts tests/unit/posed-export-rounding.test.ts tests/unit/rig-dynamics-data.test.ts --maxWorkers=1
npm run build
BROWSER_WORKERS=1 npx playwright test -c .local/official-cars.config.ts --project=main tests/browser/play-official-cars.spec.ts
```

The private browser config uses a separately checked unused port, production
preview, one worker and `reuseExistingServer: false`, as required by AGENTS.md.
Browser OMR requests are fulfilled from the attributed local fixtures and direct
LDraw.org requests are aborted. Full downloaded originals and exploratory logs
remain private; they are not production runtime assets.

# Native vehicle direction at an imported rest yaw

The reviewed imported wheelbases can have arbitrary horizontal yaw. Native rigid
bodies start with identity rotation: their collider geometry, wheel connections
and axle vectors already include the authored rest basis. Applying the inverse
rest basis to those connections would move the wheels away from their source
positions.

The actual regression was the separate world-Z forward assumption. With the
unchanged 31027 and 30572 car excerpts at 180°, positive throttle moved roughly
174 LDU opposite their rest-forward direction after 90 ticks. At 90°, reverse
travel was correct but speed reported positive (about 206 LDU/s), which also
prevented the negative speed limit from cutting engine force correctly.

Wheel drive now chooses axle sign against the source chassis forward. Speed
uses that forward rotated by the current native body delta for its sign. It
preserves the controller's cached velocity-norm magnitude and the same sample
before wheel forces; both engine limiting and the public speed report consume
that value. The [native controller implementation](https://raw.githubusercontent.com/dimforge/rapier/v0.36.0/src/control/ray_cast_vehicle_controller.rs)
uses a velocity norm with an axis-index forward sign, which cannot represent an
arbitrary rest yaw in this identity-rest body convention. An initial repair
using instantaneous longitudinal magnitude changed the existing seated
head-obstacle reverse behavior; that broader change was discarded.

Heading remains relative to the authored rest frame. Wheel visual transforms,
source geometry, source transforms, effort, suspension, contact rules and speed
limits are unchanged. The force cutoff permits fixed-tick acceleration overshoot;
it is not a hard assignment of velocity.

`tests/unit/play-native-vehicle-yaw.test.ts` covers actual 31027/30572 excerpts at
37°, 90° and 180°, plus the unrotated Roadster and Jeep. It checks rest-forward
travel, signed reversal, steering, ground contacts, unchanged 160 LDU/s limits
with less than 10 LDU/s discrete overshoot, and exact document/export/inventory
preservation. Existing dynamic seat and session-ground tests remain separate
regression checks.

Verification: the eight native yaw/driving cases, three existing dynamic-seat
cases and seven session-ground cases passed together (18/18; 55.70 seconds of
test time, 61.00 seconds wall time on the shared VM). The source-car 90° baseline
reported +205.926 and +206.251 LDU/s during reverse; corrected forward/reverse
snapshots in every fixture stay within the unchanged 160 LDU/s limit plus less
than 10 LDU/s discrete overshoot. This is a snapshot bound, not a measured peak
over every intermediate tick or a phone performance claim. TypeScript, scoped
formatting and diff checks pass.

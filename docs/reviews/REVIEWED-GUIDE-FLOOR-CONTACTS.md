# Reviewed guide floor contacts

This review supports an additional ideal sliding-bearing contact class for the
source-bound `18940.dat` housing and `18942.dat` rack. It retains every collision
region and native child. It permits bearing contacts only between the actual
matched housing/rack occurrence pair while the whole rack remains within the
reviewed carrier-relative corridor. It does not exempt the housing core, its
lower stops, or contacts with foreign objects.

See [the housing proxy review](HOLLOW-HOUSING-PROXY-REVIEW.md),
[the source review](RACK-SOURCE-REVIEW.md), and
[contact origin and factoring](RACK-CONTACT-ORIGIN-AND-FACTORING.md) for the
bounded simulation proxy, source attribution, and earlier rejected constructions.
The pinned parts are by Philippe Hurbain [Philo], under CC BY 4.0; library source
headers remain unchanged. This supplement changes contact policy, not geometry,
source provenance, or packet hashes.

## Geometry and exact classification

The reconstructed rack has 1,245 convex source regions and exact source bounds
`[-139, -29, -10]` through `[139, 9, 10]` LDU. At the reviewed relative translation
Y = −20, every rack point lies in Y ∈ [−49, −11]. Pure X travel preserves this
halfspace. Consequently a convex housing region entirely in Y ≥ −11 cannot have
positive interior overlap with that rack at the reviewed alignment. The shared
plane may carry a tangent contact.

The native packet uses metres with coordinate mapping
`[X, Y, Z] → [0.02 X, -0.02 Y, -0.02 Z]`. Derive a distinct floor class, `2`, only
from existing core regions (`planeClass === 0`) that satisfy this finite test:

```ts
region.vertices.every(
  (coordinate, index) =>
    index % 3 !== 1 ||
    region.position[1] + coordinate <= Math.fround(11 * 0.02),
);
```

The threshold is the exact F32 value `7381975 / 33554432` metres
(`0.2199999988079071`). Use the reconstructed sum without an epsilon or an
additional `fround(sum)`. The accepted packet's shared lattice makes these sums
exact F32 coordinates. Checking every point proves the halfspace condition for
its entire convex hull, including lower-rank polygon and segment supports; it
is not a contact-normal heuristic or a sample of boundary vertices against
unrelated surfaces.

The independent finite check gives:

| Class               | Source regions | Retained native children |
| ------------------- | -------------: | -----------------------: |
| Existing Z caps, ±1 |            192 |                      192 |
| New floor, 2        |            414 |                      425 |
| Remaining core, 0   |            294 |                      310 |
| Total               |            900 |                      927 |

The floor contains 402 rank-three regions, ten rank-two regions represented by
21 triangles, and two rank-one segments. No region, point, triangle, or segment
is removed, padded, resized, or replaced.

Strict F64 source Y ≥ −11 selects 401 of these regions. Thirteen more project
onto the native floor plane: IDs 265, 331, 332, 467, 555, 587, 610, 644, 669,
683, 756, 757, and 758. Eleven are F64 boundary differences below
`4e-14` LDU. IDs 331/332 extend below the source plane by at most the exact
`79958259 / 562949953421312` LDU, or
`0.00000014203440024118663` LDU. These are explicitly bounded source-to-native
projection exceptions, not literal exact source separation. The native threshold
itself corresponds to source Y = −10.999999940395355 LDU.

The closest excluded core regions, 523/524, have minimum source
Y = −12.608800000000004 LDU, extending 1.6088 LDU below the floor. There is no
broad near-floor classification tolerance. Regions 32, 44, 31, and 4 from the
upper-guide contact diagnostic belong to the new floor class. Their sloped faces
remain authored geometry; observed contact normals alone do not establish that
a native contact is geometrically false.

## Pair and pose restrictions

The allowance requires actual canonical-source binding for both members, the
reviewed rack-guide/rack-slide match, and the corresponding prismatic joint
axis. Part references or group membership alone grant no allowance. Keep the
floor class distinct from the Z caps and keep all other core contacts active.
Foreign objects collide with the complete floor, caps, and core.

At both the current and proposed next carrier-relative part poses, compute the
minimum and maximum support of the **whole source rack AABB** along Y and Z.
For coordinate row `r` and relative translation `t`, the extrema are
`t + Σ r[k] * bounds.min[k]` or `bounds.max[k]`, choosing the bound by the sign
of each coefficient. Require:

- Y minimum ≥ −49 − 0.05 and Y maximum ≤ −11 + 0.05 LDU;
- Z minimum ≥ −10 − 0.05 and Z maximum ≤ 10 + 0.05 LDU;
- maximum basis-component difference from the reviewed rest basis ≤ 0.002.

This preserves the existing 0.05-LDU cap allowance and 0.002 rotation limit.
The Y envelope is necessary: a 0.001-radian rotation about Z has basis error
`0.0009999998333333417`, but its rack Y envelope is
`[-49.13898547683455, -10.86100452316629]`, exceeding the corridor by
0.13899547683370983 LDU. Checking only relative translation or rotation misses
that endpoint displacement. Both endpoint checks are an operational contact
policy; they are not a theorem for arbitrary continuous angular sweeps.

The 0.05-LDU allowance is an explicit ideal-bearing alignment allowance, not a
source precision or welding threshold. Under that allowance there can be small
intentional floor penetration. This review does not certify physical friction,
loads, LEGO fit, native world-transform roundoff, or every native solver query.
Core/endstop, foreign-obstruction, travel, backdrive, and mobile-carrier acceptance
remain separate runtime tests.

## Finite evidence and reproduction

The independent read-only check used these immutable inputs:

| Input                           | SHA-256                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| Housing F64 regions             | `68be3f1c17e2b30cb82d09f9ea8a8ae94c1cd64f22cf2bfea1c0fb0b02472414` |
| Generated housing native packet | `d4ef6073722bed3a4568e491cc00cdc553977d2f8f850e7b8d7ca3b3f7f46ec9` |
| Rack source manifest            | `8c808a1d2ce4cd7318e6fb79ba09f4c8b5ff1114a5996307d02d7adff4488537` |

The private exploratory certificate checked all 900 housing regions and all
7,844 stored native vertices after exact-coordinate deduplication. Its SHA-256
is `6bb0953ba12241242c9f90e376aa49fd9aa4f73dc7d2b01077e6ce842a73ff77`.
Private artifacts are not a runtime dependency. The public maintainer constructor
reproduces the source manifests; the following independent finite check can be
run without accessing private artifacts or fetching library data:

```sh
npx tsx scripts/build-reviewed-source-regions.ts .local/guide-floor-source
python3 - <<'PY'
import json, struct
from fractions import Fraction as F
from pathlib import Path
read = lambda p: json.loads(Path(p).read_text())
f32 = lambda x: struct.unpack('f', struct.pack('f', x))[0]
h = read('.local/guide-floor-source/18940.dat.json')['regions']
r = read('.local/guide-floor-source/18942.dat.json')['regions']
p = read('src/play/generated/reviewed-18940.json')['regions']
threshold = F(f32(.22))
floor, core, exceptions = [], [], []
for i, (points, region) in enumerate(zip(h, p)):
    assert i == region['id']
    ys = [F(region['position'][1]) + F(region['vertices'][k])
          for k in range(1, len(region['vertices']), 3)]
    assert all(F(f32(float(y))) == y for y in ys)
    assert set(ys) <= {F(f32(-v[1] * .02)) for v in points}
    if region['planeClass'] != 0:
        continue
    if max(ys) <= threshold:
        floor.append(i)
        if min(v[1] for v in points) < -11:
            exceptions.append(i)
    else:
        core.append(i)
assert len(h) == len(p) == 900 and len(r) == 1245
assert len(floor) == 414 and len(core) == 294 and len(exceptions) == 13
assert [(min(v[k] for ps in r for v in ps),
         max(v[k] for ps in r for v in ps)) for k in range(3)] == [
         (-139, 139), (-29, 9), (-10, 10)]
penetration = max(F(-11) - F(v[1]) for i in floor for v in h[i])
assert penetration == F(79958259, 562949953421312)
assert max(min(v[1] for v in h[i]) for i in core) < -12.6087
print('PASS: 414 floor / 294 core; exact projected halfspaces; source bounds')
PY
```

The contact implementation independently asserts child counts
`[-1: 96, 0: 310, +1: 96, 2: 425]`. Relevant runtime regressions can be run
separately; the finite halfspace evidence above does not substitute for them:

```sh
npx vitest run tests/unit/play-reviewed-guide-alignment.test.ts tests/unit/play-reviewed-guide-solids.test.ts tests/unit/play-reviewed-guide-native.test.ts
```

The constructor's frozen coordinate hashes and licensed source attribution
remain authoritative. This finite halfspace review supplements the accepted
bounded housing proxy; it does not upgrade its documented limits into a complete
semantic-solid or topology theorem.

# Narrow axial profile provenance

> Generated evaluation outputs referenced below are retained locally, outside
> this PR. See the [artifact policy](README.md#local-artifacts).

Round 6 reads six official sources from the committed `ldraw-full-2026-09-28` pack, whose [manifest](../../../public/libraries/ldraw-full-2026-09-28/manifest.json) pins the complete archive SHA-256 `d2a695868ed2b3957c45b022a6451908edab22cc043179dd61d18dd382b35e11`. The implementation and regression test verify the individual source hashes below. The local axis/end spans were inspected in those sources by the implementer and independently by the critic.

| Reference | Local axis | Nominal source end span | Source SHA-256                                                     |
| --------- | ---------- | ----------------------- | ------------------------------------------------------------------ |
| 3705.dat  | 1, 0, 0    | ±40 LDU                 | `ed90738971675e2dbd05b5a0aecaccf2da32e62b4e9085b886f084de890a853a` |
| 3706.dat  | 1, 0, 0    | ±60 LDU                 | `a45710ed426e853ec856c7a13339ff0e1821d67ffc792b2d931ff57dafb01443` |
| 3707.dat  | 1, 0, 0    | ±80 LDU                 | `e7843fe0f96ce7c6c99cd79bff5ee5d5493e438bfb822f00a739f900bf3374ae` |
| 3708.dat  | 1, 0, 0    | ±120 LDU                | `005c1a60fa620efe3ddadb388481ed06a4cee73d4dec7aad5509492c26941dbc` |
| 3713.dat  | 0, 0, 1    | ±10 LDU                 | `2b813f30e7a6843cbd330035763f6ef904eafc8e7b5395c98332d07e8dfa1c43` |
| 4265a.dat | 0, 0, 1    | ±5 LDU                  | `c620aa9fa2510b275b17c90a26ee0bcd0e6453fe60f53cbf57f1bdab8a1fd0ea` |

The four axle references and two bushes derive from James Jessiman's LDraw parts; the axle beveled-end revision credits Magnus Fors. The pinned official source pack retains the complete source histories and [LDraw attribution/licensing](https://www.ldraw.org/article/349.html), including CC BY 4.0. No LEGO booklet is redistributed here.

Matching uses a normalized transformed axis, absolute dot product at least 0.999, radial separation at most 0.5 LDU, and a contained collar span with 0.5 LDU tolerance. A unique candidate yields an ordering hint. Overlapping collars, conflicting prerequisites and ambiguous candidates do not establish such an order. The graph scan is bounded at 200,000 work units.

Rounded source transforms may pass the 0.001 physical-orientation tolerance for these hints. Source transforms are never normalized or repaired; strict connector qualification is unchanged. Local shadows, nonordinary geometry, generated drawing ownership, mirrors and scales are excluded. The profile is an axis/family hint, not a hole/roll/fit/travel or access certificate. `axisReference.feasibility` remains `unknown`.

# Rebuild reviewed Play source regions

The offline maintainer constructor reconstructs the frozen **900 housing regions**
and **1,245 rack regions**, including every coordinate and region order. Read the
[housing proxy review](HOLLOW-HOUSING-PROXY-REVIEW.md) and
[source review](RACK-SOURCE-REVIEW.md) for accepted semantics and limitations.

## Clean-checkout commands

Use Node >=22.14, installed repository dependencies (`npm ci`), Python >=3.11 and
the committed pinned library packs. No network, browser, Rapier import, private
checkout or diagnostic file is needed.

```sh
npx tsx scripts/build-reviewed-source-regions.ts .local/reviewed-regions
python3 scripts/build-reviewed-native-regions.py \
  --input .local/reviewed-regions/18940.dat.json \
  --output .local/reviewed-regions/native-18940.json
python3 scripts/build-reviewed-native-regions.py \
  --input .local/reviewed-regions/18942.dat.json \
  --output .local/reviewed-regions/native-18942.json
```

The first command emits deterministic compact JSON plus a newline, with keys
`source`, `regions`, `planeClasses`. The other commands use the existing exact
native-support compiler. Runtime publication is a separate reviewed step: format
compiler output with Prettier before comparing it with the committed
`src/play/generated/reviewed-18940.json` and `reviewed-18942.json` packets.

To regenerate those repository packets during a reviewed maintainer update:

```sh
python3 scripts/build-reviewed-native-regions.py \
  --input .local/reviewed-regions/18940.dat.json \
  --output src/play/generated/reviewed-18940.json
python3 scripts/build-reviewed-native-regions.py \
  --input .local/reviewed-regions/18942.dat.json \
  --output src/play/generated/reviewed-18942.json
npx prettier --write src/play/generated/reviewed-18940.json src/play/generated/reviewed-18942.json
```

## Binding and attribution

Both parts derive from Philippe Hurbain's (Philo's) official LDraw source, licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), in the pinned
`ldraw-full-2026-09-28` library. Original headers and library packs are unchanged.
Compact derived construction parameters retain that attribution and license.
`scripts/reviewed-play-proxies/provenance.json` records source URLs, exact dependency
hashes and canonical surface digests; these are emitted in each manifest.

`fullLibrarySources` verifies the pinned manifest, index and loaded chunks. The
constructor checks all literal hashes in the actual 51-file housing and 49-file
rack dependency closures, compiles both through the vendored renderer LDraw loader,
captures their canonical surfaces with `PlayMemberGeometryCapture`, and checks
exact unordered triangle-coordinate digests including multiplicity. It checks
809 housing plane ancestry paths against actual source references and final
triangle/quad records. It does not resolve remote files or admit by filename alone.

## Frozen construction

`housing-construction.json` retains 446 source-bound planes, 40 signed Z bands,
7,726 corners `[xIntercept, xSlope, incomingPlane, outgoingPlane]`, closed paths
and literal face ancestry. These are reviewed source-derived construction
parameters, **not the final regions**. They retain the approved roof/rib and brace
union masks, true tilted brace faces and reviewed void boundaries. The compact
parameters are not automatically regenerated for changed source semantics.

The accepted chain preserves every positive width, height and event interval,
with exact serialized shared affine-cut identity: **63,081 cells → 2,473
identical-halfspace cells → 900 convex regions**. Original Python arithmetic and
stable group order are intentional. Convex coalescing's rounded neighbor keys
only find candidates; point identity remains exact serialized identity. Its
historical floating volume thresholds are retained to reproduce the bounded
proxy; they do not establish an exact convex-union theorem.

`rack-boundaries.json` retains source sections at Z=0.5, 5 and 9. Band order is
center `[-2,2]`, middle `[2,8]`, middle `[-8,-2]`, outer `[8,10]`, outer `[-10,-8]`.
Accepted triangulation/coalescing gives 197 + 263 + 263 + 261 + 261 = 1,245 regions.
Historical five-decimal polygon keys, positive triangle-area cutoff and merge
thresholds remain unchanged; reproducibility does not strengthen their review.

Frozen construction-file hashes and both final coordinate-stream hashes must
match before either output is written. Housing plane classes are +1 for all Z>=10,
-1 for all Z<=-10, zero otherwise; rack classes are zero. The separate native
compiler preserves lower-rank supports.

## Verification and limits

Two fresh generations matched each other and the frozen manifests byte for byte.
Coordinate hashes cover `JSON.stringify(regions)` without a trailing newline.
The permanent offline integration test rebuilds both manifests and native packets,
checking exact hashes, source attribution and all rank/child counts. Type checking
and formatting pass. Changed construction, canonical surface and final coordinate
hashes each refuse before writing any output.

| Part        | Regions SHA-256                                                    | Manifest SHA-256                                                   | Native ranks / children                                |
| ----------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------ |
| `18940.dat` | `68be3f1c17e2b30cb82d09f9ea8a8ae94c1cd64f22cf2bfea1c0fb0b02472414` | `8accfb04d89e4ace6d074a406bbc65711ec535dd3eb8b9f7dda0ac7e15eaf029` | 871 solids, 26 planar hulls, 3 segments / 927 children |
| `18942.dat` | `51f01244f4af0cc600cc620ef81a5e40f86b872a3cd8f102c4888b4d27f68343` | `8c808a1d2ce4cd7318e6fb79ba09f4c8b5ff1114a5996307d02d7adff4488537` | 1,245 solids / 1,245 children                          |

After Prettier, native packet SHA-256 values are
`d4ef6073722bed3a4568e491cc00cdc553977d2f8f850e7b8d7ca3b3f7f46ec9`
for housing and `58da6a2b709d77151706db93faeac849156cdbc906ac6887de2dd4304511c95a`
for rack. These cover final repository packet bytes including the newline.

The housing's 26 planar hulls produce 53 triangle children. Native compiler bounds
remain 4,096 regions/expanded children, 256 points per region and 2,000,000
supporting triples. Construction neighbor work remains bounded at 100,000 housing
and 200,000 rack trials per section. No runtime budgets or loading policy change.

Housing remains the owner's accepted bounded simulation proxy with 0.0012 LDU
finite source-surface maps and the material-interior, full cavity, semantic topology
and native behavior limitations in its review. Reproduction establishes exact
rebuildability and source binding; it does not prove those remaining obligations
or integrated motion acceptance.

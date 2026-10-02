# Instruction generation research and source audit

> Generated evaluation outputs referenced below are retained locally, outside
> this PR. See the [artifact policy](README.md#local-artifacts).

Investigation began on 30 September 2026 from `/home/ubuntu/instructions-report.md`. The supplied report contains named references but no citation URLs, despite claiming that citations are linked. We retrieved primary sources, downloaded and read the three papers most relevant to this implementation, inspected eight OMR model files through the repository's existing OMR helpers, and read LEGO booklets for three matching sets. The implementation is original TypeScript; no paper or tool code was copied.

## Sources that inform the design

**Ono et al. (2013), “LEGO Builder: Automatic Generation of LEGO Assembly Manual from 3D Polygon Model.”** The author list begins Sumiaki Ono and Alexis André; “Ono & Alexis” confuses André's given name with a surname. The paper converts polygon geometry to a hollow brick layout, uses layerwise connection priorities, separates regions into larger model sections and renders manuals. Section 6 describes separate construction of the bunny's body, face and ears. Section 7 explicitly describes cases where connectivity is not guaranteed. We take the lower-support ordering idea, while recognizing that generating instructions for an existing arbitrary-part model is a different problem. [Publisher and full paper](https://www.jstage.jst.go.jp/article/mta/1/4/1_354/_article/-char/en).

**Testuz, Schwartzburg and Pauly (2013), “Automatic Generation of Constructable Brick Sculptures.”** This work merges voxels, optimizes a brick contact graph and looks for disconnected components and weak articulation points. Its instruction output depicts layers with the previous layer shadowed. The paper builds example sculptures, but does not establish arbitrary-model feasibility or partial-build stability. Its future-work section notes the problem of pieces supported only from above and proposes adding weight/gravity checks. It also respects colour in merging, contrary to the report's overly broad claim that academic work ignores colour. Our contact graph and dimmed context draw on these ideas; we do not implement their layout optimization. [Eurographics full paper](https://diglib.eg.org/bitstreams/3fbdf89b-339e-4f00-b3cf-9604fd1744e2/download).

**Agrawala et al. (2003), “Designing Effective Step-By-Step Assembly Instructions.”** This directly relevant planning/presentation paper was missing from the supplied report. It couples attachment planning with visibility, grouping and orientation. Its cognitive-design discussion favours coherent sequences and showing new parts clearly. We implement local grouping, a small set of camera candidates, continuity penalties and visibility flags. These are simplified engineering choices, not a reproduction of its optimizer. [Authors' Stanford page](https://graphics.stanford.edu/papers/assembly_instructions/) and [full paper](https://graphics.stanford.edu/papers/assembly_instructions/assembly.pdf).

| Downloaded paper | SHA-256                                                          |
| ---------------- | ---------------------------------------------------------------- |
| Ono et al.       | 1e745c24ed532e7c792417182cce6a70a607960d1d8e5b33515d6ccea98b927f |
| Testuz et al.    | 83357cfe692b782832afe1d0eaa0a1d1dce48f78b9f96e1659ebedf5fdc65a6d |
| Agrawala et al.  | 9d649a8da979cb184bc43daecf0c1a57a2c35dc9dbb2f68695fe4c797153d2a2 |

The PDFs and extracted text were retained locally in `.local/research/`; the papers are linked, not redistributed in the repository.

The user subsequently supplied a [theoretical algorithm report](lego_instruction_generation_heuristic.md), preserved verbatim. Its [assessment](additional-report-assessment.md) checks the additional LEGO/Studio sources and a fourth downloaded physics-aware planning paper, and maps its proposed action/subassembly architecture to concrete follow-up requirements.

## Corrections and references traced further

- **StableText2Lego is a dataset**, released with the 2025 LegoGPT work by Ava Pun et al., not a 2024 “Wu” instruction-generator paper. The original work uses validity checks and physics-aware rollback during model generation. The latest revision renames it BrickGPT / StableText2Brick. Brick sequences are not equivalent to a polished instruction booklet. [Version 1, original naming](https://arxiv.org/abs/2505.05469v1), [current paper](https://arxiv.org/abs/2505.05469), [authors' project](https://avalovelace1.github.io/LegoGPT/).
- **LegoACE** is a model-generation method using tokens for position, orientation and type, trained on LegoVerse. Its project describes 55,000 models and 9,314 brick types. That supports the report's general model-generation description; it does not justify assuming human-friendly steps or guaranteed physical builds. [Authors' project](https://xh38.github.io/LegoACE/).
- **Peysakhov and Regli (2003)** is “Using assembly representations to enable evolutionary design of Lego structures,” AI EDAM 17(2), 155–168. The publisher describes messy genetic algorithms and labelled assembly graphs for evolving designs. We did not find evidence in the accessible abstract that it produces LEGO-style step booklets. [Publisher](https://www.cambridge.org/core/journals/ai-edam/article/abs/using-assembly-representations-to-enable-evolutionary-design-of-lego-structures/94CB61C095F6C2AC0942452E2465E893).
- **Petrovic (2001), Gower et al. (1998), van Zijl and Smal (2008), Legolizer (2009)** are traceable in Testuz's bibliography: a Norwegian University of Science and Technology brick-layout technical report; “LEGO: Automated Model Construction”; “Cellular automata with cell clustering”; and Silva, Pamplona and Comba's SIBGRAPI rendering paper. These were checked through that bibliography, not represented as independently read full texts. The report's “Legolizer (academic siggraph)” venue is incorrect. Smal's thesis repository was inaccessible during this investigation; no thesis-specific implementation claims are adopted.
- **LDCad is not established as GPL/open-source by the supplied report.** Its own download site supplies an application and separate licence files. Free-of-charge software does not imply GPL. [Developer download page](https://www.melkert.net/LDCad/download). **LPub3D** explicitly describes itself as an instruction editing application licensed GPLv3; automatic page rendering/layout should not be conflated with automatic assembly planning. [Project](https://github.com/trevorsandy/lpub3d).
- The report names no specific patent number and gives no evidence for a universal “child-friendly” step size or blanket claims that CAD guarantees feasible assemblies. Those claims remain unverified and do not constrain this feature. Real geometry alone does not prove intermediate assembly stability or a valid insertion path.

## OMR findings

OMR files are community-authored representations of official sets, licensed CC BY 2.0, not official LEGO booklets. The repository's `OMR_UPSTREAM`, `omrFileName`, index decoding and header attribution were reused to download a varied eight-set corpus; the committed complete part pack resolved all part references in this corpus. The machine-readable evaluation (local artifact) records exact model hashes, authors, themes and source URLs. Two unmodified files are included as [offline regression fixtures](../../../fixtures/instructions/omr/NOTICE.md).

Several files have useful nested steps but no root steps: Pizza To Go, Mobile Police Truck and Mountain Hut. The existing importer only creates a root imported plan. The evaluation traverses actual nested instance paths to compare source boundaries; the generator does not consume those boundaries. London and Mobile Crane supply no STEP benchmark at all. Technic Roadster and Deep Sea Creatures have root boundaries that introduce whole submodels; treating each boundary as a uniform few-part step would be misleading.

Galaxy Commander contains a hose drawn with thousands of raw elements. London also expands drawing geometry into many occurrences. These inflate occurrence counts above physical inventory counts. Deep Sea Creatures uses posed matrices rounded to three decimals; they fail the repository's strict rigid-transform test. Unknown connector coverage is retained rather than changing the model to make a benchmark look better.

## LEGO-published booklet comparison sources

These PDFs were downloaded directly from LEGO, read as text and visually inspected. They remain local; the report links them instead of reproducing pages. The independent critic compares the generated views with numbered booklet pages and describes the sampling limits.

| Set                                  | Booklet                                                                                | Pages | SHA-256                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------- |
| 21034 London                         | [6532388.pdf](https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6532388.pdf) | 144   | f4cc1db810d17d3e08e88acfcd93dcb5a6803144a72265274f15b228b55f3efe |
| 31025 Mountain Hut, main model       | [6073974.pdf](https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6073974.pdf) | 76    | dad6000ab64cc4da6b292131d7cd49cc34b97c043d5c7bed447ebca15b25bc41 |
| 31088 Deep Sea Creatures, main model | [6263589.pdf](https://www.lego.com/cdn/product-assets/product.bi.core.pdf/6263589.pdf) | 68    | 6c7da365099ba34f88107e24edef9ad40ecefe7ca21ed40ddec590b458259e1f |

LEGO pages show pictorial part trays, isolated subassemblies, explicit merge arrows and flip/rotation guidance. Our current flat plan format cannot express detached construction and later insertion, so these are concrete future requirements rather than implied capabilities.

# Format-first sizing with and without commercial reference counts

This follow-up tests the user's supplied [piece-count summary](supplied-piece-count-summary.md) across the six original briefs and both Lego and diorama styles. **48 clean Sol 6.1 high generations**: two independent runs of each brief/style under each condition.

- **Format first:** choose scale and format before estimating count, using comparable commercial formats without numerical examples.
- **Format + references:** identical instructions plus the seven-family table of sample sizes, medians and middle-half ranges, with its coverage limitations.

| Condition           | Lego prompt                                             | Diorama prompt                                             |
| ------------------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| Format first        | [Prompt](../../../prompts/style-size-format-lego.md)    | [Prompt](../../../prompts/style-size-format-diorama.md)    |
| Format + references | [Prompt](../../../prompts/style-size-reference-lego.md) | [Prompt](../../../prompts/style-size-reference-diorama.md) |

Both have no numerical target. Only the Size section differs from the earlier target-free prompts; the reference condition adds only the table and explanatory boundaries to the format-first condition. The table does not assign families to briefs or require a match. Counts include bases, accessories and secondary models. No visual style is prescribed by a reference family.

## Reading the comparison

The [preview](index.html) includes every new run and 48 historical builds, with front, back, top and three-quarter views. Each subject page embeds its own images and opens without the app or a server. Compare both repeats rather than choosing one attractive sample. Review notes are available below each new build.

The primary question is whether the numerical table improves on the same format-first wording. This batch does not isolate format-first wording from the current E prompt: older E runs appear only as historical context. A small score lead here would not by itself justify replacing E.

## Frozen protocol

The [protocol](protocol.json) records all 48 cases before generation, a deterministic shuffled order and hashes of the four prompt variants, unchanged original reply examples and runner. Eight cases run concurrently. Each starts from its original brief in an empty directory with a new native session, no images, other builds or reviewer feedback. Only the existing text part search and compiler count/error feedback are available. Richer part facts are off. Existing execution limits remain; model-selected counts are not enforced as targets. No runtime/compiler code changes are part of this experiment.

The supplied summary is preserved byte-for-byte. It is treated as user-provided reference data; its underlying 142-row dataset was not supplied or independently verified. Its narrow family boundaries and incomplete coverage are included in the model input. No catalogue is browsed during generation.

Two repeats test whether an apparent table benefit survives ordinary variation; this is still a small exploratory sample. All generations are retained, without choosing the better repeat or rerunning poor outputs. All cases, including any failures, are reported. Accepted models are rendered only after generation, in the same four 1,280 × 960 Standard views used previously.

## Evaluation

Review all four views using the existing five 0–4 axes: recognition/proportions, intentional finish, composition, visible support and across-view consistency. Angular forms and exposed studs can be deliberate. Review whether size supports the requested subject and useful detail, not whether it matches the table. Counts, warnings, checks, searches and failures are separate measurements. Piece count is not a physical dimension or a direct measure of construction complexity: part sizes, compound parts and the compiler's packing choices also affect it. Commercial catalogue counts are approximate context, not a calibrated ground truth for these generated models. Compare both repeats per brief/style, their mean scores and whether one condition consistently beats both samples of the other. Small differences are not proof of improvement; review is unblinded and does not certify physical buildability.

Historical context includes retained E/diorama builds, their two unchanged-prompt repeats and the earlier commercial/open-size arm. These were generated earlier and are not contemporaneous controls for the new comparison. The primary contrast is the two new conditions. The paired, task-specific evaluation follows [OpenAI's evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices); the runner and model remain pinned.

## Results and recommendation

**The reference table changes sizing, but does not establish a reliable overall quality improvement.** All 48 generations were accepted on their first attempt and reviewed across four views. Both repeats count equally.

| Condition           | Lego score / 240 | Diorama score / 240 | Total / 480 | Mean / 20 | Repeat totals / 240 |
| ------------------- | ---------------: | ------------------: | ----------: | --------: | ------------------- |
| Format first        |              174 |                 169 |         343 |     14.29 | 175 / 168           |
| Format + references |              176 |                 173 |         349 |     14.54 | 175 / 174           |

References win six brief/style comparisons by mean score, tie two and lose four. The average advantage is **0.25 points out of 20**. Repeat 1 ties overall; repeat 2 favors references. Only the Lego Destroyer has both reference samples strictly above both format-only samples; the Lego Ewok has the reverse. These are exploratory, unblinded judgments, not a statistically established improvement.

| Style / brief       | Format pieces (runs 1 / 2) | Reference pieces (runs 1 / 2) | Format scores / 20 | Reference scores / 20 |
| ------------------- | -------------------------: | ----------------------------: | -----------------: | --------------------: |
| Lego · Pelican      |                  363 / 289 |                     235 / 288 |            16 / 14 |               16 / 16 |
| Lego · Piplup       |                  301 / 249 |                     148 / 163 |            13 / 12 |               13 / 15 |
| Lego · Temple       |                1921 / 1632 |                   1791 / 1631 |            17 / 17 |               17 / 17 |
| Lego · Dragon       |                  401 / 410 |                     512 / 400 |            12 / 14 |               12 / 12 |
| Lego · Destroyer    |                  632 / 685 |                    1036 / 907 |            13 / 13 |               15 / 15 |
| Lego · Ewok         |                  313 / 322 |                     278 / 191 |            16 / 17 |               14 / 14 |
| Diorama · Pelican   |                  662 / 234 |                     539 / 538 |            16 / 13 |               16 / 16 |
| Diorama · Piplup    |                  349 / 478 |                     361 / 364 |            13 / 12 |               15 / 12 |
| Diorama · Temple    |                1266 / 1768 |                   1254 / 1149 |            15 / 16 |               15 / 16 |
| Diorama · Dragon    |                 741 / 1058 |                    1231 / 764 |            16 / 12 |               15 / 14 |
| Diorama · Destroyer |                  572 / 836 |                    483 / 1076 |            13 / 13 |               13 / 12 |
| Diorama · Ewok      |                 1169 / 646 |                     861 / 948 |            15 / 15 |               14 / 15 |

The table does not simply increase counts. Lego Piplup falls from 301/249 pieces to 148/163, while Lego Destroyer rises from 632/685 to 1,036/907. Diorama pelican becomes more consistent at 539/538 instead of 662/234. Across all 24 samples per condition, median count is 602 without references and 538.5 with them; the direction differs by style (Lego 382 → 344; diorama 701.5 → 812.5). There is no single correct count for these open-ended briefs.

My visual preferences:

- **Temples are the strongest results in both conditions.** All four Lego temples score 17/20, and the diorama pair has identical scores in both conditions. The table adds no visible advantage here.
- **References help the Lego Destroyers in this batch:** both have a broader triangular hull. Their serrated edges still fall short of a continuous wedge, and the diorama Destroyers remain thin and pronged.
- **Format first is better for the Lego Ewoks:** compact, coherent freestanding craft at 313/322 pieces outperform the reference samples at 278/191. Smaller is not automatically better scoped.
- **References are promising for pelicans**, especially the two coherent waterfront dioramas, but one format-only run matches them in each style.
- **Piplup remains unreliable.** The first reference diorama is better, but the second returns to a hollow helmet and body gaps despite almost the same count (361 versus 364). Hollow heads also occur without the table; this study cannot attribute them specifically to the BrickHeadz row.
- **Dragons still expose spatial errors:** floating horns and detached or stiff wings occur under both conditions. Count selection does not fix attachment geometry.

I would **keep the default E and diorama prompts unchanged**. If choosing a sizing instruction for further work, I prefer the shorter format-first wording: it stays build-agnostic and avoids anchoring unrelated subjects to a narrow product-family sample. Keep the numerical table as optional reference material when the intended product format actually matches. The small aggregate reference lead is insufficient to justify its additional prompt length and uneven effects. This batch does not prove format-first beats E; the historical unchanged-prompt totals (172, 182 and 175 / 240) also show why a single attractive run is insufficient.

## Verification

The frozen preflight validates 48 cases and 24 distinct inputs, each repeated twice. Final audits confirm 48 unique native Sol 6.1 high sessions, exact initial inputs, empty working directories, no images or prior model sources, and accepted JS identical to the final submissions. One attempted native tool call was blocked with `code-mode host is disabled`; no native tool executed. Existing text part-search and compiler feedback remained available as specified.

All 48 final models compile with zero errors; **214 construction warning records remain**. Those warnings and visible defects are retained, not repaired by the reviewer. Input audits, compiler reports, sources, measurements and per-case notes are archived alongside the preview. The focused 28 tests and TypeScript build pass. Portable preview and formatting checks are recorded in [verification](../../VERIFICATION.md).

## Reproduction

Generation and review are complete. [Preview](index.html), [measurements](measurements.json), [assessment](assessment.json) and [input audit](input-audit.json) retain every result. No default prompt or published gallery is changed.

From the repository root, in a new study/output location (existing runs are refused):

```sh
python3 docs/samples/format-size/run.py --prepare
node node_modules/tsx/dist/cli.mjs docs/samples/format-size/preflight.ts
python3 docs/samples/format-size/run.py --run
```

The package/audit scripts retain exact inputs and accepted JS/JSON/MPD sources. Native session logs and internal reasoning remain private. Preview pages embed images for standalone viewing.

# Fresh E generation and Sol E/F comparison

This comparison generates the six original gallery briefs independently. E uses Sol 6.1, Astra 6 and Opus 5.5 at high effort; F uses Sol 6.1 high. The six Sol E runs serve both comparisons, for 24 distinct runs. [Interactive previews](index.html) switch between three-quarter, front, back and top views. [E model overview](e-model-overview.png) and [Sol E/F overview](sol-ef-overview.png) are standalone images.

Every build starts in its own empty directory and a new session. Inputs contain only the original brief, part target, frozen system/reply guidance and catalogue metadata. No generated model source, original gallery source, preservation request, repository instructions, reference images or render feedback is supplied. A build's search/check continuations remain in its own session; another build's output is never added. Accepted source is retained unchanged and rendered only after generation finishes. Reviewing those renders does not change the remaining runs' inputs.

The E inputs are byte-identical across the three models for each subject. Sol E/F holds the model, effort, brief, target, catalogue and search/check/repair limits fixed while changing the system and reply prompts. E is the current default, frozen as `build-agent-contextual.md` with `brick-build-object.md`. F is `build-agent-economical.md` with `brick-build-economical.md`: it distinguishes design intent from geometry, prefers replacing weak geometry to covering it, removes architectural recipes and uses a syntax-only example, with separate revision audits. All added guidance remains general; no subject-specific construction instructions or repairs are inserted.

Both variants allow ten text search replies, up to three compiler checks per attempt and five attempts. Compiler feedback contains counts and errors, without images or construction warnings. Targets are soft scores, not acceptance gates. Final renders use the same Standard look, 1,280 × 960 resolution and four camera presets as the historical study previews. Codex and Claude retain different built-in CLI system prompts; the E model comparison therefore changes both model and runner for Opus.

Camera labels refer to the shared world-coordinate presets. Independently generated subjects can face different directions; compare all four views rather than treating the named front view as a normalized subject pose.

[Provenance](provenance.json) records exact input/source hashes, requested and verified models, effort, session identifiers, working directories, zero supplied sources/images and zero native tool events. [Metrics](metrics.json) retain counts, elapsed generation/check time, attempts and compiler warnings. Compiler acceptance is not a certificate of physical buildability. Baseplate inventory counts also do not distinguish meaningful plate-built terrain from generic slabs; visible construction must be assessed in the views.

The [earlier E/F and published three-model E results](../README.md) are source-conditioned revisions. All three models received the same original Sol source for each subject and were instructed to preserve its composition. Those comparisons measure construction revision and cannot establish independent design diversity or fresh-generation quality. Earlier A/B and four C trials are fresh generation; the C bird revisions and D reference-image runs have different input conditions.

There is one fresh sample per subject/model/variant. Visual preferences are judgments about these outputs, not a general model ranking or proof that a prompt change caused an improvement. Repeated runs would be needed to distinguish a consistent prompt effect from generation variance.

## Results

All 24 builds accept in one attempt, with zero final compiler errors, zero baseplate parts and four final views. Some use draft checks to repair colour or overlap errors before submission. Warnings remain and are retained per build.

| Brief                    | Target | Sol E | Astra E | Opus E | Sol F |
| ------------------------ | -----: | ----: | ------: | -----: | ----: |
| Pelican riding a bicycle |    800 |   889 |     825 |    828 |   916 |
| Piplup                   |  1,000 | 1,204 |   1,160 |  1,112 | 1,093 |
| Japanese Buddhist temple |  2,000 | 2,258 |   2,231 |  2,014 | 2,201 |
| Dragon                   |  1,000 | 1,017 |   1,220 |  1,097 |   934 |
| Imperial Star Destroyer  |  5,000 | 5,630 |   5,700 |  5,404 | 5,106 |
| Ewok / Classic Space     |  3,000 | 3,278 |   3,128 |  2,803 | 2,978 |

## My visual preferences

Among the fresh E models, Astra is my strongest collection overall: it wins four of these six comparisons. Sol's pelican and Opus's Destroyer are my other picks. That is a preference across these specific outputs, not an established model ranking.

| Subject   | Fresh E pick | Why                                                                                                                                                                                                                                                                          | Sol E/F pick |
| --------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Pelican   | Sol          | More coherent curved bird body, tucked wings, shaped bill and actual bicycle wheels. Astra's layered neck/body and Opus's stepped body remain more blocky.                                                                                                                   | E            |
| Piplup    | Astra        | A clearer continuous face, forehead marking and readable compact body. Sol's protruding eye surrounds distort its face; Opus has a rounder but strongly stepped head. F improves on Sol E's face and belly.                                                                  | F            |
| Temple    | Astra        | Balanced hall/pagoda proportions, finished roofs and warm timber detailing, with distinct compact foundations. Within Sol, I prefer E's five-tier tower, entrance and richer small composition to F's broader hall.                                                          | E            |
| Dragon    | Astra        | A more coherent flying silhouette and curved head. Sol E's moulded wings are visibly suspended away from the body; F's brick-built wings avoid that visible defect, although its 20 clash warnings still require attention.                                                  | F            |
| Destroyer | Opus         | The most coherent triangular hull skin and recognizable silhouette, with a small companion ship. Sol E and Astra E record 200 clash warnings each. Within Sol, F gives a cleaner pointed hull, closer part count and one connectivity warning instead of 200 clash warnings. | F            |
| Ewok      | Astra        | Airier foliage, recognizable huts and bridges, a separate spacecraft and the Classic Space palette. Sol E preserves a fuller forest settlement; F instead makes a large wooden spacecraft the focus with one small hut. I prefer E's forest concept here.                    | E            |

Sol E/F splits **three–three** visually: E for pelican/temple/Ewok, F for Piplup/dragon/Destroyer. F uses fewer parts in five pairs, but its pelican uses more. Total parts fall from 14,276 to 13,228 (7.3%); absolute target miss improves in four pairs. These observations support testing F's economical construction guidance further, but do not justify calling it a consistent visual improvement or replacing E on this evidence alone. The earlier revision comparison also split three–three, but the preferred variant changes for four subjects. Revision preferences do not transfer directly to independent generation.

## Compared with the existing builds

The fresh compositions differ substantially from the source-conditioned collection. The published [Opus E Piplup revision](../opus-text-only-contextual-piplup/iso.webp) still has a more appealing rounded character than these fresh Piplup candidates. The owner's preferred [original temple](../original-temple/iso.webp) and [original Ewok scene](../original-ewok/iso.webp) also retain richer, more cohesive settings than the fresh alternatives. Their broad grounds are part of those compositions; removing a baseplate is not enough reason to replace a preferred concept.

Those older models and their revisions have different inputs and additional iteration, so the comparison cannot attribute every visual difference to prompting. This fresh test confirms that E reliably avoids baseplate parts in these samples, but does not by itself eliminate stepped organic forms or disconnected construction. Text-only feedback about clashes and attachment groups is a useful next process experiment, while explicitly allowing intentional independent modules. No visual feedback is needed to test that improvement.

The fresh builds are comparison artifacts; the published gallery remains the documented source-conditioned collection. The current default guidance has not been changed by this experiment.

## Reproduce

The harness is `scripts/evaluate-build-style.ts` at source commit `ed5eda6`. Use a new output directory for each rerun; an accepted result in an existing directory is intentionally reused. Effort is always high. Do not add `--revise-from`, `--source-variant`, `--reference-images` or `--images`.

```sh
npx tsx scripts/evaluate-build-style.ts --model gpt-6.1-sol --cases contextual-pelican,contextual-piplup,contextual-temple,contextual-dragon,contextual-destroyer,contextual-ewok --out .local/lego-study/fresh-e-sol-rerun --concurrency 3
npx tsx scripts/evaluate-build-style.ts --model gpt-6.1-sol --cases economical-pelican,economical-piplup,economical-temple,economical-dragon,economical-destroyer,economical-ewok --out .local/lego-study/fresh-f-sol-rerun --concurrency 3
```

For Astra E, use the first command with `--model gpt-6-astra` and a separate output directory. For Opus E, use `--runner claude --model claude-opus-5-5` and a separate directory. All four cohorts use the same six briefs/targets and automatic text-only feedback.

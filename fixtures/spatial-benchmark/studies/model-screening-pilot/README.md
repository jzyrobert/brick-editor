# Automatic facts: model screening pilot v1

Frozen before generation, 13 October 2026. Extends the Sol automatic-facts development pilot with GPT-6 Luna/high and GPT-6 Astra/medium, explicitly requested by the owner. No API-key fallback, credits or resets.

## Design

Each model: four identical development briefs × control/combined facts × two independent repetitions = 16 scheduled cases. Total 32 new generation cases. E, reply contract, inventory, language, feedback policy, budgets and automatic exposure match the Sol pilot. Combined means supplied shape and connector facts, not additional style prose. Shortcut evidence remains off. No feedback or repairs; no images or evaluator data in generation.

Run each model's frozen randomised schedule (seed 131026), alternating models one case at a time, starting Luna. Each case is a new isolated session. No replacement or retry of a failed case. Five-minute cooldown after infrastructure failure; stop that model after three consecutive infrastructure failures. Quota checked before and after every request/case, with existing reserve; stop when the gate rejects. Pause generation while the prior Sol evaluation is using the provider to avoid overlapping requests.

Preflight and zero-model dry runs first. Independently checked calibration fixtures from the automatic-facts pilot are reused; these are infrastructure verification, not new model calibration results.

## Evaluation and analysis

Freeze all candidate sources and artifacts before rendering. Use the existing submitted-only visual protocol and fixed four views. The reviewer remains Sol 6.1/high for both generating models, blinded to generating model and condition; recognition before the brief. Failed submissions retain diagnostics and are not assigned a visual score. Infrastructure failures remain distinct. No evaluator feedback returns to any generation session.

Primary descriptive contrast per model: combined minus control on the six-field visual total /24. Compute condition means within each task then equally weight tasks with at least one scored case in each condition. Report task effects and missing pairs; task-cluster percentile bootstrap, seed 20261011, 10,000 resamples (no interval with fewer than two tasks). Report acceptance rates on all scheduled cases separately, process/cost and supplied facts. Compare the two within-model treatment effects descriptively with the Sol combined-control arm, disclosing missingness and different study timing. No significance or broad improvement claim from four tasks/two repetitions. Different requested reasoning efforts mean this is not a pure model-size comparison. A single model reviewer is not independent human agreement.

Do not select prompts, subjects, successful cases or views after observing results. No default promotion or gallery publication. Raw native contexts stay private; archive exact model-visible inputs, hashes, statuses, artifacts and structured assessments without credentials.

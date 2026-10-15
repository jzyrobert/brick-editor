# Review eligibility implementation record

Recorded during generation on 13 October 2026, before any candidate rendering or assessment. The frozen README specifies no visual scores for failed candidates. The existing evaluator can render and assess any compiled artifact, including one rejected by the compiler; a rejected canal submission exposed this distinction.

An opt-in `scoreEligibility: submitted-only` implements the already-declared analysis rule. Use `visual-protocol-submitted.json` for both render and review commands instead of `visual-protocol.json`. Invalid compiled artifacts may still be rendered for failure inspection but are marked `unevaluated-invalid-submission` and never sent to the reviewer. Legacy protocols without the option keep their behavior. No generation input, case order, feedback, budget, primary contrast or scoring rubric changes. The original protocol files remain unchanged; new evaluator source hashes are archived separately before review.

The report now derives its repetition-count limitation from the manifest instead of hard-coding three. This pilot has two repetitions. Neither change provides candidate feedback or alters frozen outcomes.

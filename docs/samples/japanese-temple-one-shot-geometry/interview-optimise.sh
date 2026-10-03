#!/usr/bin/env bash
# Resumes each effort's final one-shot session and asks how the process could
# be optimised for it. Writes <effort>/optimise.md (+ event log) in the run folder.
set -uo pipefail
RUN=${1:?usage: interview-optimise.sh <oneshot run folder>}
NO_TOOLS=(--disable shell_tool --disable unified_exec --disable multi_agent --disable browser_use
  --disable browser_use_external --disable computer_use --disable apps --disable image_generation
  --disable in_app_browser --disable code_mode_host --disable goals --disable skill_search
  --disable tool_suggest --disable sleep_tool)

ask() {
  local e=$1 n thread summary
  n=$(jq '.attemptsUsed' "$RUN/$e/result.json")
  thread=$(jq -r 'select(.type=="thread.started") | .thread_id' "$RUN/$e/attempt-$n.codex.jsonl" | head -1)
  summary=$(jq -r '
    "Your run (\(.effort) reasoning effort): " + (if .accepted then "accepted at \(.parts) parts" else "not accepted" end) +
    " after \(.attemptsUsed) attempt(s), \(.seconds) seconds and \(.tokens.output) output tokens (\(.tokens.reasoning) reasoning); \(.searches) parts searches.\n" +
    ([.attempts[] | "- Attempt \(.attempt): \(.outcome)" + (if .parts then ", \(.parts) parts" else "" end) +
      ", \(.seconds) s, \(.usage.output) output tokens" +
      (if .reason then "; errors sent back:\n" + (.reason | .[0:2000]) else "" end)] | join("\n"))' \
    "$RUN/$e/result.json")
  local msg="This is not a build request: please answer in plain prose (no JSON). Every attempt in this experiment started a fresh session, so you only remember this one; here is what happened across all of yours:

$summary

Since the last round of feedback we added geometry rules to the prompt, footprints and heights to the part list and search results, and errors that say where overlaps are. This round is about efficiency: how could the whole process be optimised for you, so that you reach an accepted, good build with less effort, fewer tokens and fewer attempts? Please be concrete and cite the sections, fields or messages you mean:

1. Where did your effort and tokens go in this run? What was most expensive to work out, and was it avoidable?
2. Which parts of the prompt did you not use or need for this build? What could be cut, shortened or moved out of the prompt (into search, or a reference you could ask for) without hurting you?
3. What single piece of information or rule, had it been in the prompt, would most likely have made your first reply acceptable?
4. You did not search. Why not, and what would make search worth using (or should it be dropped)?
5. The repair step: was the error format and the repeated prompt the right shape for a fast fix? Would you rather get the errors in the same session, only the changed parts, a diff, or something else?
6. The process itself: one reply then repairs, a fixed part range, a long JSON script. What would you change to make building faster or better (for example an outline step first, reusable recipes or components, a part-count estimate, a different script shape)?
7. Your top three optimisations, most valuable first."
  codex exec resume "$thread" --ignore-user-config --skip-git-repo-check -m gpt-6.1-sol \
    -c "model_reasoning_effort=\"$e\"" -c 'web_search="disabled"' -c 'sandbox_mode="read-only"' \
    "${NO_TOOLS[@]}" --json -o "$RUN/$e/optimise.md" "$msg" \
    > "$RUN/$e/optimise.codex.jsonl" 2> "$RUN/$e/optimise.codex.stderr" < /dev/null
  echo "$e: exit $? ($(wc -c < "$RUN/$e/optimise.md" 2>/dev/null || echo 0) bytes)"
}

mkdir -p "$RUN/.interview" && cd "$RUN/.interview" || exit 1
for e in low medium high xhigh max; do ask "$e" & done
wait

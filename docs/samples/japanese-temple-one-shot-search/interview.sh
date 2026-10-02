#!/usr/bin/env bash
# Resumes each effort's final one-shot session and asks for feedback on the
# prompt and tooling. Writes <effort>/feedback.md (+ event log) in the run folder.
set -uo pipefail
RUN=${1:?usage: interview.sh <oneshot run folder>}
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
    " after \(.attemptsUsed) attempt(s); \(.searches) parts searches in all.\n" +
    ([.attempts[] | "- Attempt \(.attempt): \(.outcome)" + (if .parts then ", \(.parts) parts" else "" end) +
      (if (.searches|length) > 0 then ", \(.searches|length) searches" else "" end) +
      (if .reason then "; errors sent back: " + (.reason | gsub("\n"; " ") | .[0:400]) else "" end)] | join("\n"))' \
    "$RUN/$e/result.json")
  local msg="This is not a build request: please answer in plain prose (no JSON). Every attempt in this experiment started a fresh session, so you only remember this one; here is what happened across all of yours:

$summary

We are improving the prompt and the tooling for agents like you, and your candid feedback is the most useful input we have. Please answer each question concretely, citing the exact sections, fields, ops or messages you mean:

1. Prompt: what was unclear, contradictory, missing or wasted space? What would you cut or add?
2. Part list: did the 224-part list with common colours help? What did you need from it that it lacked (sizes, heights, connection points, how parts sit on studs, images, examples)?
3. Search: how well did the {\"parts_search\": …} reply protocol work? Would you rather have had it as a tool call? Were the results useful, and what was missing from them?
4. Errors and repairs: which error messages helped you fix the script, and which were hard to act on (overlaps, schema errors such as the open faces or non-integer at, part-count range, colours)? What would have made each easier?
5. Your failures: in your own words, why did your rejected attempts fail, and what in the prompt or tooling would have prevented it?
6. Without compiling or seeing renders, what was hardest to reason about (coordinates, heights in plates, overlaps between ops, roofs, components, part counts)? What would help most if you still had to answer in one pass?
7. If you could change three things about the prompt or tools, what would they be, most important first?"
  codex exec resume "$thread" --ignore-user-config --skip-git-repo-check -m gpt-6.1-sol \
    -c "model_reasoning_effort=\"$e\"" -c 'web_search="disabled"' -c 'sandbox_mode="read-only"' \
    "${NO_TOOLS[@]}" --json -o "$RUN/$e/feedback.md" "$msg" \
    > "$RUN/$e/feedback.codex.jsonl" 2> "$RUN/$e/feedback.codex.stderr" < /dev/null
  echo "$e: exit $? ($(wc -c < "$RUN/$e/feedback.md" 2>/dev/null || echo 0) bytes)"
}

cd "$RUN/low/empty" || exit 1
for e in low medium high xhigh max; do ask "$e" & done
wait

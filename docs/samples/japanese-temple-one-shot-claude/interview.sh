#!/usr/bin/env bash
# Resumes each effort's final one-shot Claude Code session and asks for
# feedback on the prompt and tooling (the run-2 questions, as in
# ../japanese-temple-one-shot-search/interview.sh). Writes <effort>/feedback.md
# (+ feedback.claude.json) in the run folder.
set -uo pipefail
RUN=${1:?usage: interview.sh <oneshot run folder>}

ask() {
  local e=$1 n log session summary
  n=$(jq '.attemptsUsed' "$RUN/$e/result.json")
  log=$(ls "$RUN/$e"/attempt-"$n".*claude.json | sort -V | tail -1)
  session=$(jq -r '.session_id' "$log")
  summary=$(jq -r '
    "Your run (\(.effort) effort): " + (if .accepted then "accepted at \(.parts) parts" else "not accepted" end) +
    " after \(.attemptsUsed) attempt(s); \(.searches) parts searches in all.\n" +
    ([.attempts[] | "- Attempt \(.attempt): \(.outcome)" + (if .parts then ", \(.parts) parts" else "" end) +
      (if (.searches|length) > 0 then ", \(.searches|length) searches" else "" end) +
      (if .reason then "; errors sent back: " + (.reason | gsub("\n"; " ") | .[0:400]) else "" end)] | join("\n"))' \
    "$RUN/$e/result.json")
  local msg="This is not a build request: please answer in plain prose (no JSON). Every attempt in this experiment started a fresh session, so you only remember this one; here is what happened across all of yours:

$summary

We are improving the prompt and the tooling for agents like you, and your candid feedback is the most useful input we have. Please answer each question concretely, citing the exact sections, fields, ops or messages you mean:

1. Prompt: what was unclear, contradictory, missing or wasted space? What would you cut or add?
2. Part list: did the 224-part list with common colours, footprints and heights help? What did you need from it that it lacked (sizes, reach, connection points, how parts sit on studs, images, examples)?
3. Search: how well did the {\"parts_search\": …} reply protocol work? Would you rather have had it as a tool call? Were the results useful, and what was missing from them?
4. Errors and repairs: which error messages helped you fix the script, and which were hard to act on (overlaps, schema errors such as the open faces or non-integer at, part-count range, colours)? What would have made each easier?
5. Your failures: in your own words, why did your rejected attempts fail, and what in the prompt or tooling would have prevented it?
6. Without compiling or seeing renders, what was hardest to reason about (coordinates, heights in plates, overlaps between ops, roofs, components, part counts)? What would help most if you still had to answer in one pass?
7. If you could change three things about the prompt or tools, what would they be, most important first?"
  (cd "$RUN/$e/empty" && printf '%s' "$msg" | claude -p --resume "$session" --model claude-opus-5-5 --effort "$e" \
    --tools "" --safe-mode --strict-mcp-config --disable-slash-commands --output-format json \
    > "$RUN/$e/feedback.claude.json" 2> "$RUN/$e/feedback.claude.stderr")
  jq -r '.result' "$RUN/$e/feedback.claude.json" > "$RUN/$e/feedback.md"
  echo "$e: $(wc -c < "$RUN/$e/feedback.md") bytes"
}

for e in low medium high xhigh max; do ask "$e" & done
wait

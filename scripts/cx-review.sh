#!/usr/bin/env bash
# cx-review: Codex wrapper that saves full output to tmp and returns only the summary.
# Prevents Codex's verbose thinking/reasoning from consuming Opus context.
#
# Usage: cx-review 'your prompt here'
# Output: Only the final result (max 200 lines). Full output saved to /tmp/cx-review-*.md
set -euo pipefail

PROMPT="$*"
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
FULL_OUTPUT="/tmp/cx-review-${TIMESTAMP}.md"
SUMMARY_OUTPUT="/tmp/cx-review-${TIMESTAMP}-summary.md"

# Run Codex, capture stdout to file, suppress stderr (session noise)
codex exec --skip-git-repo-check "$PROMPT" > "$FULL_OUTPUT" 2>/dev/null

TOTAL_LINES=$(wc -l < "$FULL_OUTPUT")

if [ "$TOTAL_LINES" -le 200 ]; then
  # Short enough — return as-is
  cat "$FULL_OUTPUT"
else
  # Too long — extract tail and notify
  {
    echo "[cx-review] Full output: $FULL_OUTPUT ($TOTAL_LINES lines)"
    echo "[cx-review] Showing last 200 lines:"
    echo "---"
    tail -n 200 "$FULL_OUTPUT"
  } | tee "$SUMMARY_OUTPUT"
fi

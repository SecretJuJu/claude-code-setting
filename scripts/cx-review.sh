#!/usr/bin/env bash
# cx-review: Context-safe Codex wrapper.
# Full output → /tmp file. Returns metadata + optional preview.
#
# Usage:
#   cx-review 'prompt'                  # metadata only (0 lines)
#   cx-review --lines 50 'prompt'       # metadata + last 50 lines
#   cx-review --lines 200 'prompt'      # metadata + last 200 lines
#   cx-review --lines all 'prompt'      # metadata + full output
#
# Claude decides --lines based on expected output size:
#   Quick question  → --lines 50
#   Code review     → --lines 100
#   Deep analysis   → --lines 200
#   Huge output     → (no flag), then Read tool selectively
set -euo pipefail

# Parse --lines flag
PREVIEW_LINES=0
if [[ "${1:-}" == "--lines" ]]; then
  shift
  PREVIEW_LINES="${1:-0}"
  shift
fi

PROMPT="$*"
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
OUTPUT_FILE="/tmp/cx-review-${TIMESTAMP}.md"

# Run Codex, capture stdout to file, suppress stderr (session noise)
codex exec --skip-git-repo-check "$PROMPT" > "$OUTPUT_FILE" 2>/dev/null

TOTAL_LINES=$(wc -l < "$OUTPUT_FILE" | tr -d ' ')
TOTAL_BYTES=$(wc -c < "$OUTPUT_FILE" | tr -d ' ')

# Always print metadata
echo "CODEX_OUTPUT_FILE=${OUTPUT_FILE}"
echo "LINES=${TOTAL_LINES}"
echo "BYTES=${TOTAL_BYTES}"

# Print preview if requested
if [[ "$PREVIEW_LINES" == "all" ]]; then
  echo "---"
  cat "$OUTPUT_FILE"
elif [[ "$PREVIEW_LINES" -gt 0 ]] 2>/dev/null; then
  if [[ "$TOTAL_LINES" -le "$PREVIEW_LINES" ]]; then
    echo "---"
    cat "$OUTPUT_FILE"
  else
    echo "[showing last ${PREVIEW_LINES} of ${TOTAL_LINES} lines]"
    echo "---"
    tail -n "$PREVIEW_LINES" "$OUTPUT_FILE"
  fi
else
  echo ""
  echo "Use Read tool to view: ${OUTPUT_FILE}"
fi

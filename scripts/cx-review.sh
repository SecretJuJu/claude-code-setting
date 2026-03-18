#!/usr/bin/env bash
# cx-review: Context-safe Codex wrapper with session support.
# Full output → /tmp file. Returns metadata + optional preview.
#
# Flags:
#   --lines N|all     Preview last N lines (default: 0 = metadata only)
#   --session ID      Resume a previous Codex session
#
# Examples:
#   cx-review 'Review this code'                          # new session, metadata only
#   cx-review --lines 100 'Review this code'              # new session, 100 lines preview
#   cx-review --session abc123 'What about edge cases?'   # resume session
#   cx-review --session abc123 --lines 50 'Follow up'     # resume + preview
set -euo pipefail

# Parse flags
PREVIEW_LINES=0
SESSION_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --lines)
      PREVIEW_LINES="${2:-0}"
      shift 2
      ;;
    --session)
      SESSION_ID="${2:-}"
      shift 2
      ;;
    *)
      break
      ;;
  esac
done

PROMPT="$*"
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
OUTPUT_FILE="/tmp/cx-review-${TIMESTAMP}.md"
STDERR_FILE="/tmp/cx-review-${TIMESTAMP}-stderr.log"

# Run Codex in subshell to ensure stderr redirect works
if [[ -n "$SESSION_ID" ]]; then
  bash -c 'codex exec resume "$1" "$2"' _ "$SESSION_ID" "$PROMPT" \
    >"$OUTPUT_FILE" 2>"$STDERR_FILE"
else
  bash -c 'codex exec --skip-git-repo-check "$1"' _ "$PROMPT" \
    >"$OUTPUT_FILE" 2>"$STDERR_FILE"
fi

# Extract session ID from stderr for future resume
EXTRACTED_SESSION=$(grep -o 'session id: [0-9a-f-]*' "$STDERR_FILE" 2>/dev/null \
  | sed 's/session id: //' | head -1 || echo "")
rm -f "$STDERR_FILE"

TOTAL_LINES=$(wc -l < "$OUTPUT_FILE" | tr -d ' ')
TOTAL_BYTES=$(wc -c < "$OUTPUT_FILE" | tr -d ' ')

# Always print metadata
echo "CODEX_OUTPUT_FILE=${OUTPUT_FILE}"
echo "CODEX_SESSION_ID=${EXTRACTED_SESSION}"
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

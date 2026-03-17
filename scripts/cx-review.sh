#!/usr/bin/env bash
# cx-review: Codex wrapper that saves output to tmp file.
# Claude reads only the file path — NOT the raw content.
# This prevents Codex output from polluting Opus context.
#
# Usage: cx-review 'your prompt here'
# Returns: File path to read with Read tool. Never dumps content to stdout.
set -euo pipefail

PROMPT="$*"
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
OUTPUT_FILE="/tmp/cx-review-${TIMESTAMP}.md"

# Run Codex, capture stdout to file, suppress stderr (session noise)
codex exec --skip-git-repo-check "$PROMPT" > "$OUTPUT_FILE" 2>/dev/null

TOTAL_LINES=$(wc -l < "$OUTPUT_FILE")
TOTAL_BYTES=$(wc -c < "$OUTPUT_FILE")

# Return ONLY metadata — Claude uses Read tool to access content
echo "CODEX_OUTPUT_FILE=${OUTPUT_FILE}"
echo "LINES=${TOTAL_LINES}"
echo "BYTES=${TOTAL_BYTES}"
echo ""
echo "Use Read tool to view: ${OUTPUT_FILE}"

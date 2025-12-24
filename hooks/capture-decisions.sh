#!/usr/bin/env bash
# Post-response hook: Capture tagged lines for future context
set -euo pipefail

CTX_DIR="${CLAUDE_CONTEXT_DIR:-$HOME/.claude/context}"
SUMMARY="$CTX_DIR/summary.txt"

mkdir -p "$CTX_DIR"

# Read response to temp file
TMP="$(mktemp)"
cat > "$TMP"

# Capture tagged lines (DECISION, TODO, ASSUMPTION, NOTE)
grep -E '^(DECISION|TODO|ASSUMPTION|NOTE):' "$TMP" >> "$SUMMARY" 2>/dev/null || true

# Keep summary compact (max 200 lines)
if [ -f "$SUMMARY" ]; then
  tail -n 200 "$SUMMARY" > "$SUMMARY.tmp" && mv "$SUMMARY.tmp" "$SUMMARY"
fi

# Output original response
cat "$TMP"
rm -f "$TMP"

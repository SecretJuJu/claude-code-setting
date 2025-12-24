#!/usr/bin/env bash
# Pre-prompt hook: Inject context summary before each prompt
set -euo pipefail

CTX_DIR="${CLAUDE_CONTEXT_DIR:-$HOME/.claude/context}"
SUMMARY="$CTX_DIR/summary.txt"

# Create context dir if not exists
mkdir -p "$CTX_DIR"

# Inject summary if exists
if [ -s "$SUMMARY" ]; then
  printf "=== CONTEXT SUMMARY ===\n"
  tail -n 100 "$SUMMARY"
  printf "\n========================\n\n"
fi

# Pass through stdin
cat

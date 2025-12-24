#!/usr/bin/env bash
# Pre-prompt hook: Inject stable knowledge from global and project files
set -euo pipefail

KNOWLEDGE_FILE="${CLAUDE_KNOWLEDGE_FILE:-$HOME/.claude/context/knowledge.md}"
PROJECT_KNOWLEDGE="$(pwd)/knowledge.md"
PROJECT_NOTEPAD="$(pwd)/notepad.md"

injected=false

if [ -s "$KNOWLEDGE_FILE" ] || [ -s "$PROJECT_KNOWLEDGE" ] || [ -s "$PROJECT_NOTEPAD" ]; then
  printf "=== KNOWLEDGE ===\n"

  if [ -s "$KNOWLEDGE_FILE" ]; then
    cat "$KNOWLEDGE_FILE"
    printf "\n"
    injected=true
  fi

  if [ -s "$PROJECT_KNOWLEDGE" ]; then
    printf "## Project Knowledge\n"
    cat "$PROJECT_KNOWLEDGE"
    printf "\n"
    injected=true
  fi

  if [ -s "$PROJECT_NOTEPAD" ]; then
    printf "## Recent Learnings (last 20 lines)\n"
    tail -n 20 "$PROJECT_NOTEPAD"
    printf "\n"
    injected=true
  fi

  if [ "$injected" = true ]; then
    printf "=================\n\n"
  fi
fi

# Pass through stdin
cat

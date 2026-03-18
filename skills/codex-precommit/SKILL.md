---
name: codex-precommit
description: >-
  Send staged diff to Codex for independent pre-commit code review. Use this skill before committing
  code, when the user says "커밋 전 리뷰", "precommit review", "커밋해도 될까", "push 전 체크",
  "commit review", "pre-commit check", or asks whether their changes are ready to commit.
  Also activate when the user is about to commit and wants a final safety check, or says
  "이거 커밋해도 돼?", "변경사항 확인해줘" before a git commit.
allowed-tools: Bash, Read, Glob
---

# Codex Pre-Commit Review

Gets an independent code review from Codex before committing. A different model catches different bugs — this is a safety net against shipping broken code.

## Flow

### Step 1: Collect the diff

Prefer staged changes (what will actually be committed). Fall back to unstaged if nothing is staged.

```bash
DIFF=$(git diff --cached)
if [ -z "$DIFF" ]; then
  DIFF=$(git diff)
fi
```

If both are empty, inform the user there's nothing to review and skip.

### Step 2: Send to Codex

```bash
~/.claude/scripts/cx-review.sh --lines 100 "You are a senior code reviewer.
Review this diff for bugs, security issues, and design problems.

$(git diff --cached)

Focus on:
1. Bugs and logic errors
2. Security vulnerabilities (injection, auth, data exposure)
3. Edge cases that could cause production incidents
4. Breaking changes or backwards compatibility

Format:
CRITICAL: [must fix before commit]
WARNING: [should consider]
APPROVED if no critical issues found

Be concise. Only flag real issues."
```

### Step 3: Act on results

- **CRITICAL found** → fix before committing
- **WARNING only** → present to user for judgment
- **APPROVED** → proceed with commit

## Rules

1. Use `cx-review.sh` wrapper — raw codex exec wastes context
2. Staged diff first — fall back to unstaged only if staging is empty
3. No diff = skip — don't run on an empty changeset
4. Warn about sensitive data — if .env content appears in the diff, flag it before sending

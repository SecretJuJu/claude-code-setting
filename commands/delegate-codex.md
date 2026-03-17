# Delegate to Codex (Code Review Partner)

Codex를 코드리뷰 파트너로 활용합니다.

## Instructions
1. Analyze the user request: $ARGUMENTS
2. Gather relevant code/diff context from the codebase
3. Formulate a clear review prompt with full context for Codex
4. Execute via wrapper: `~/.claude/scripts/cx-review.sh 'Think deeply. [review request with code context]'`
5. If output was truncated, read full output from `/tmp/cx-review-*.md` only if needed
6. Present Codex feedback organized by severity

## CRITICAL
- **ALWAYS** use `~/.claude/scripts/cx-review.sh` — NEVER raw `codex exec`
- The wrapper saves full output to `/tmp/cx-review-*.md` and returns max 200 lines
- This protects Opus context from Codex's verbose thinking/reasoning output
- Set Bash timeout to 1800000 for large reviews

## Output Format
```
CODEX REVIEW
Target: [what was reviewed]
🔴 Critical: [must-fix issues]
🟡 Suggestions: [should-consider improvements]
🟢 Good: [notable positive patterns]
Verdict: [1-2 sentence summary]
```

## Rules
- Include all necessary code context in the Codex prompt
- Focus on real issues, not style nitpicks
- Never include raw Codex output; organize by severity

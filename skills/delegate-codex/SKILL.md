---
name: delegate-codex
description: >-
  Use Codex as a thinking partner for code review, design validation, deep analysis, tradeoff
  comparison, debugging consultation, and second opinions. Use this skill whenever the user asks
  for a code review, wants design feedback, needs help debugging, asks to compare approaches,
  or requests deep thinking on a problem. Also activate when the user says "codex한테", "리뷰해줘",
  "검증해줘", "고민", "피드백", "맡겨", "깊게 생각", "세컨드 오피니언", or any phrase suggesting
  they want an independent perspective from another AI model. Even casual requests like
  "이거 어떻게 생각해?" or "한번 봐줘" about code or architecture should trigger this skill.
allowed-tools: Bash, Read, Glob
---

# Codex Thinking Partner

Delegates complex reasoning to Codex CLI. Using a separate model provides an independent perspective — Codex has different strengths and blind spots than Claude, making it valuable for catching issues Claude might miss.

## Context-Safe Invocation

Use the `cx-review.sh` wrapper to control how much output enters the Opus context window. Raw `codex exec` dumps everything into context and wastes tokens.

```bash
cx='~/.claude/scripts/cx-review.sh'

# --lines controls how much comes back into context
$cx --lines all 'Short answer...'       # full output (small responses)
$cx --lines 50  'Quick question...'     # short feedback
$cx --lines 100 'Review this code...'   # code review
$cx --lines 200 'Deep analysis...'      # deep analysis
$cx              'Massive analysis...'  # metadata only → Read selectively

# --session continues a Codex conversation (it remembers prior context)
$cx --lines 100 'Review this plan: ...'
# → CODEX_SESSION_ID=019cfaac-22bc-...
$cx --session 019cfaac-22bc-... --lines 100 'What about edge cases?'
```

### --lines guide

| Expected output | --lines | Reason |
|-----------------|---------|--------|
| One-liner | `all` | Fits entirely |
| Short feedback | `50` | Covers most |
| Code review | `100` | Key issues included |
| Deep analysis | `200` | Conclusion + evidence |
| Large analysis | (omit) | Metadata only, Read the rest |

### When to use sessions
- **Plan review loop**: plan → Codex review → revise → re-review in same session
- **Debugging dialogue**: share error → discuss hypotheses → provide more info
- **Design iteration**: draft → feedback → improve → re-evaluate

## Prompt structure

Codex has zero knowledge of the current conversation. Include all relevant context — project details, tech stack, constraints, and the specific code or decision under review. Be concrete about what you want evaluated.

```bash
~/.claude/scripts/cx-review.sh --lines 100 'Think deeply and thoroughly.

[Role or perspective]

[Question or request]

Context:
- Project: [description]
- Tech stack: [stack]
- Constraints: [constraints]

[Specific evaluation criteria]

Be direct and critical. Respond concisely.'
```

## Examples

### Code review
```bash
$cx --lines 100 'Think deeply.
You are a senior code reviewer. Review this code:

[code or diff]

Review for: correctness, design, performance, security.
Format: Critical / Suggestion / Good'
```

### Design validation
```bash
$cx --lines 100 'Think deeply.
Validate this design:

[design details]

1. Does it meet requirements?
2. What edge cases are missed?
3. Simpler alternatives?
4. What could go wrong in production?'
```

### Debugging
```bash
$cx --lines 100 'Think deeply.
Debug this issue:

Error: [error message]
Code: [relevant code]
Context: [reproduction steps]

Most likely root causes? Rank by probability.'
```

### Tradeoff analysis
```bash
$cx --lines 150 'Think deeply.
Compare these approaches:

Option A: [description]
Option B: [description]

Context: [project situation, constraints]

Compare on: complexity, performance, maintainability, risk.
Clear recommendation with reasoning.'
```

## If output is truncated

Full output is always saved to `/tmp/cx-review-*.md`. Use Read to access specific sections.

## Rules

1. Use `cx-review.sh` wrapper — raw `codex exec` wastes context
2. Include full context — Codex has no conversation history
3. Exclude sensitive data — no API keys or passwords

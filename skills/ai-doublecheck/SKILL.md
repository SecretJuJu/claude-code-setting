---
name: ai-doublecheck
description: >-
  Cross-validate plans, code, and decisions with multiple AI models (Codex, Gemini) in parallel.
  Use this skill whenever the user asks for a double-check, cross-check, second opinion, verification
  with other AIs, or wants independent validation of their work. Also use when the user says
  "더블체크", "검증해줘", "크로스체크", "세컨드 오피니언", "다른 AI한테 확인", or any phrase
  suggesting they want another perspective on code, architecture, plans, or important decisions.
  Even if the user just says "이거 맞아?" or "확인 좀" in the context of reviewing code or plans,
  this skill should activate.
allowed-tools: Read, Bash, Glob
---

# AI Double Check

Cross-validate with Codex and Gemini by running 4 parallel calls — two perspectives (code review + QA) across two models. This catches blind spots that a single model misses, because different models have different failure modes.

## Prerequisites

Check if enabled before proceeding:
```bash
cat ~/.claude/skills/ai-doublecheck/config.json
```
If `enabled: false`, inform the user and stop.

## Process

### 1. Compress the subject

Distill what needs verification into ≤500 tokens. Include the core intent so external models have enough context:
- **Plans**: goals, key steps, risks
- **Code**: logic, intent, edge cases
- **Decisions**: options, rationale, tradeoffs

### 2. Run 4 parallel calls

Launch all 4 simultaneously — different perspectives surface different issues:

**Code Review (Codex)**
```bash
codex exec --skip-git-repo-check 'You are a senior code reviewer. Evaluate for code quality, readability, maintainability, and design patterns:

[SUBJECT]

Format: Improvements / Strengths / Refactoring suggestions. ≤400 tokens.'
```

**Code Review (Gemini)**
```bash
gemini -m gemini-3-pro-preview -y "You are a senior code reviewer. Evaluate for code quality, readability, maintainability, and design patterns:

[SUBJECT]

Format: Improvements / Strengths / Refactoring suggestions. ≤400 tokens."
```

**QA (Codex)**
```bash
codex exec --skip-git-repo-check 'You are a QA engineer hunting for bugs. Check for bugs, edge cases, exceptions, and security vulnerabilities:

[SUBJECT]

Format: Potential bugs / Missing edge cases / Security concerns. ≤400 tokens.'
```

**QA (Gemini)**
```bash
gemini -m gemini-3-pro-preview -y "You are a QA engineer hunting for bugs. Check for bugs, edge cases, exceptions, and security vulnerabilities:

[SUBJECT]

Format: Potential bugs / Missing edge cases / Security concerns. ≤400 tokens."
```

### 3. Synthesize results

Present a comparison table so the user can see agreement and disagreement at a glance:

**Code Review:**
| Area | Codex | Gemini |
|------|-------|--------|
| Improvements | | |
| Strengths | | |
| Refactoring | | |

**QA:**
| Area | Codex | Gemini |
|------|-------|--------|
| Bugs | | |
| Edge cases | | |
| Security | | |

**Summary:**
- **Consensus** — issues flagged by multiple models deserve attention
- **Disagreements** — present both sides, let user decide
- **Urgent** — anything that needs immediate action

## Toggle

```bash
# Enable
sed -i '' 's/"enabled": false/"enabled": true/' ~/.claude/skills/ai-doublecheck/config.json

# Disable
sed -i '' 's/"enabled": true/"enabled": false/' ~/.claude/skills/ai-doublecheck/config.json
```

## Notes

- 4 parallel calls complete in ~30 seconds (same as 1 serial call)
- Exclude sensitive data (API keys, passwords) from the subject
- Final judgment always belongs to the user

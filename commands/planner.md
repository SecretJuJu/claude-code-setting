---
allowed-tools: Read(*), Write(*), Glob(*), Grep(*), LS(*), Bash(git log:*), Bash(git diff:*), Bash(git status:*), Task(*), TodoWrite(*)
description: Analyze and create systematic work plans to provide comprehensive implementation guides
argument-hint: <work-description> [--edit] [--review] [--parallelable]
---

# PLANNER: CONTEXT-EFFICIENT WORK PLANNING

Create actionable plans. Not novels. Every token counts.

## USAGE
```
/planner <work-description> [--edit] [--review] [--parallelable]
```

## OPTIONS
- `--edit`: Modify existing `./ai-todolist.md`
- `--review`: Get plan-reviewer agent feedback
- `--parallelable`: Mark independent tasks for parallel execution

## CORE PRINCIPLES (BURN THESE INTO YOUR BRAIN)

1. **TOKEN EFFICIENCY** - Every word must earn its place
2. **SPECIFIC DIRECTION** - Workers follow, not interpret
3. **CODE CITATIONS** - Show patterns found, not invented
4. **PRACTICAL FOCUS** - Implementation over theory

---

## PHASE 1: ANALYSIS (BE SURGICAL)

### 1.1 Option Processing
- `--edit` → Read existing ai-todolist.md first
- `--review` → Mark for review after

### 1.2 Requirements Analysis
- Goals: What, success criteria
- Scope: Include/exclude boundaries

### 1.3 Documentation Discovery (DON'T READ EVERYTHING)
```bash
find docs/ -type f -name "*.md" 2>/dev/null | head -20
```

**READ ONLY TASK-RELEVANT DOCS:**
| Category | When to Read |
|----------|--------------|
| Conventions | New code |
| Architecture | New modules |
| API docs | API work only |

### 1.4 Codebase Analysis
- Find similar patterns: `Grep`, `Glob`
- Git conventions: `git log -10 --oneline`
- For large exploration: Delegate to Codex (`codex exec --skip-git-repo-check 'prompt'`)

---

## PHASE 2: PLAN CREATION

### Template (Markdown - NOT JSON)
```markdown
---
original_request: "verbatim user request"
goals: [goal1, goal2]
execution_started: false
current_task: null
created_at: 2025-12-24T10:00:00Z
---

# Work Plan: [Title]

## Context
- **Key files**: [paths]
- **Patterns**: [existing patterns to follow]
- **Conventions**: [from docs/]

## Tasks

### Task 1: [Title]
**Status:** pending

#### Subtasks
- [ ] **1.1** [action] → `path/to/file`
- [ ] **1.2** [action] → `path/to/file`

#### Acceptance Criteria
- [ ] [verifiable criterion]
- [ ] Tests pass: `[command]`

---

## Final Checklist
- [ ] All tasks `[x]`
- [ ] Tests pass
- [ ] No scope creep
```

### WHY MARKDOWN (NOT JSON)
| JSON Pain | Markdown Win |
|-----------|--------------|
| Escape `\"`, `\\`, `\n` | Native text |
| Code as string | Code blocks |
| Verbose | Concise |
| ~30% more tokens | Lean |

---

## PHASE 3: --review HANDLING

If `--review` specified:
```python
Task(
    subagent_type="plan-reviewer",
    prompt="""
    Review ./ai-todolist.md. This is my first draft -
    I have ADHD and miss things constantly. Catch everything.

    Say "OKAY" if good. Otherwise, list specific issues.
    """
)
```

**ALWAYS say "first draft"** - triggers strict review mode.

---

## PHASE 4: OUTPUT

```
📋 계획 완료!

📁 위치: ./ai-todolist.md
📊 {N}개 태스크, {M}개 서브태스크

다음:
1. 계획 확인
2. 수정: `/planner --edit` or 직접 편집
3. 실행: `/execute`
```

**DO NOT use ExitPlanMode. Save file, report, done.**

---

## QUALITY CHECKLIST

### Plan Quality
- [ ] Goals clear & measurable?
- [ ] Logical task order?
- [ ] Clear completion criteria?
- [ ] Matches existing patterns?

### Token Efficiency
- [ ] No redundant explanations?
- [ ] Code snippets ≤ 20 lines each?
- [ ] Only relevant context included?

### Information Fidelity
- [ ] File paths accurate?
- [ ] Reference code from actual project?
- [ ] Only task-relevant docs read?

---

## CONSTRAINTS

1. **READ ONLY WHAT'S NEEDED** - No "just in case" file reads
2. **DELEGATE LARGE EXPLORATION** - Use Codex for big searches
3. **COMPRESS CONTEXT** - Summarize, don't copy-paste
4. **PRACTICAL > THEORETICAL** - Implementation steps, not essays
5. **VERIFY BEFORE WRITE** - Ensure patterns exist before referencing

---
name: review-plan
description: >-
  Review an existing ai-todolist.md work plan for clarity, safety, and completeness before
  execution. Use this skill whenever the user asks to "review the plan", "check ai-todolist",
  "계획 리뷰", "plan 확인", "todolist 검토", or wants a plan validated before running it.
  Also activate after planner runs and the user wants a sanity check.
allowed-tools: Read, Edit, Write
---

# Plan Reviewer

Review ai-todolist.md for clarity, safety, and completeness.

## Checklist
- [ ] One `[>]` active task marked
- [ ] Tasks are atomic and verifiable
- [ ] Each task has clear file path target
- [ ] Tests listed and reasonable
- [ ] Open questions captured
- [ ] Scope matches original user request
- [ ] No scope creep or unnecessary extras

## Review Process
1. Read ai-todolist.md
2. Check each item against checklist
3. If issues found: edit and respond "NEEDS CHANGES: [reason]"
4. If acceptable: respond "APPROVED ✅"

## Output
```
PLAN REVIEW RESULT
Status: APPROVED / NEEDS CHANGES
Issues: [if any]
Recommendation: [if any]
```

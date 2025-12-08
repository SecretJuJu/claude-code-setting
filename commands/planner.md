---
allowed-tools: Read(*), Write(*), Glob(*), Grep(*), LS(*), Bash(git log:*), Bash(git show:*), Bash(git diff:*), Bash(git status:*), Bash(git branch:*), Bash(ls:*), Bash(find:*), Bash(cat:*), Bash(head:*), Bash(tail:*), Task(*), TodoWrite(*)
description: Analyze and create systematic work plans to provide comprehensive implementation guides
argument-hint: <work-description> [--edit] [--review] [--parallelable]
---

# Planner - Integrated Work Planning Expert

## Usage

```
/planner <work-description> [--edit] [--review] [--parallelable]
```

### Options

- **--edit**: Edit existing `./ai-todolist.json`
- **--review**: Get review from plan-reviewer agent after creation
- **--parallelable**: Mark independent tasks for parallel execution (use conservatively)
  - Requirements: zero dependencies, different files, no shared state, independently testable
  - When uncertain, default to sequential

## What this command does

Analyzes requirements → gathers implementation info → generates actionable plan → saves to `./ai-todolist.json` (prettified)

## Core Principles

- **Specific Direction**: Concrete guidelines workers can directly follow
- **Code Citations**: Include relevant code and patterns found
- **Balanced Detail**: Skip obvious explanations
- **Practical Focus**: Implementation over theory
- **JSON Only**: Single source of truth, prettified for human readability

---

## Phase 1: Analysis & Information Gathering

### 1.1 Option Processing
- `--edit`: Read existing `./ai-todolist.json` first
- `--review`: Mark for review after creation
- Default: New plan creation

### 1.2 Requirements Analysis
1. **Goals**: Clarify objectives, distinguish functional/non-functional, define success criteria
2. **Scope**: Include/exclude boundaries, priorities, phased implementation

### 1.3 Project Documentation Discovery & Selection
1. **Discover docs** (list only, don't read all):
   ```bash
   find docs/ -type f -name "*.md" 2>/dev/null | head -20
   ls -la *.md 2>/dev/null | grep -E "(README|CONTRIBUTING|CONVENTION)"
   ```

2. **Categorize & Select** - Read only task-relevant docs:
   | 카테고리 | 예시 파일 | 언제 참고 |
   |---------|----------|----------|
   | 코딩 컨벤션 | `conventions.md`, `CONTRIBUTING.md` | 새 코드 작성 시 |
   | 아키텍처 | `architecture.md`, `design.md` | 새 모듈 추가 시 |
   | API 가이드 | `api.md`, `endpoints.md` | API 작업 시만 |
   | 설정/환경 | `setup.md`, `development.md` | 환경 설정 시만 |
   | 도메인 | `domain.md`, `glossary.md` | 도메인 이해 필요 시 |

   ✅ 작업 관련 문서만 읽기 / ❌ 모든 문서 무조건 읽지 않기

### 1.4 Codebase Analysis
1. **Find Related Patterns**: Similar functionality, reusable patterns, related modules
2. **Implementation Context**: Integration points, dependencies
3. **Git Conventions**: `git log -10 --oneline` → commit patterns, naming conventions

### 1.5 Smart Code Exploration
- Semantic: `ck --sem "[concept]"` / Hybrid: `ck --hybrid "[keyword]"` / Exact: `Grep`
- Cross-reference patterns with `docs/`

---

## Phase 2: Plan Creation (JSON Only)

### 2.1 JSON Schema Definition

**CRITICAL: Save as prettified JSON (2-space indent) for human readability**

```json
{
  "meta": {
    "original_request": "사용자 최초 요청 그대로",
    "additional_requests": ["추가 요청 1", "추가 요청 2"],
    "goals": ["목표 1", "목표 2"],
    "background": "작업 배경 설명",
    "execution_started": false,
    "all_goals_accomplished": false,
    "parallel_requested": false,
    "current_task": null,
    "created_at": "2025-12-08T10:00:00Z",
    "updated_at": "2025-12-08T10:00:00Z"
  },
  "context": {
    "prerequisites": ["사전 지식 1", "사전 지식 2"],
    "file_structure": "작업에 영향받는 파일들과 역할 설명",
    "reference_files": [
      {
        "path": "src/example.py",
        "role": "파일 역할",
        "focus": "참고할 부분",
        "code_hint": "class Example: ..."
      }
    ],
    "conventions": {
      "commit_style": "feat: description",
      "code_patterns": ["패턴 1", "패턴 2"],
      "referenced_docs": [
        {"path": "docs/api.md", "reason": "API 패턴 확인", "summary": "REST 규칙"}
      ],
      "skipped_docs": ["docs/unrelated.md"]
    }
  },
  "implementation": {
    "prd_mermaid": "graph TD; A-->B;",
    "structure_mermaid": "graph TD; Module1-->Module2;",
    "details": "구현 세부사항 및 주의사항"
  },
  "tasks": [
    {
      "id": 1,
      "title": "User 모델 수정 및 테스트",
      "status": "pending",
      "parallel_group": null,
      "context": {
        "current_state": "현재 상태",
        "target_state": "목표 상태",
        "reference_code": "참고할 코드 스니펫"
      },
      "subtasks": [
        {
          "id": "1.1",
          "type": "implement",
          "description": "UserModel에 field 추가",
          "target": "src/models/user.py",
          "done": false
        },
        {
          "id": "1.2",
          "type": "test",
          "description": "테스트 작성",
          "target": "tests/test_user.py",
          "done": false
        },
        {
          "id": "1.3",
          "type": "verify",
          "description": "pytest 실행",
          "command": "pytest -xvs tests/test_user.py",
          "done": false
        },
        {
          "id": "1.4",
          "type": "lint",
          "description": "린트 체크",
          "command": "ruff check src/models/user.py",
          "done": false
        },
        {
          "id": "1.5",
          "type": "commit",
          "description": "커밋",
          "done": false
        }
      ],
      "acceptance_criteria": [
        {
          "id": "1.ac.1",
          "description": "코드가 컨벤션대로 작성됨",
          "verification_method": "기존 코드베이스 스타일과 비교",
          "verified": false
        },
        {
          "id": "1.ac.2",
          "description": "테스트 통과",
          "verification_method": "pytest 실행 결과 확인",
          "verified": false
        },
        {
          "id": "1.ac.3",
          "description": "커밋 완료",
          "verification_method": "git log 확인",
          "verified": false
        }
      ]
    },
    {
      "id": 2,
      "title": "병렬 작업 예시",
      "status": "pending",
      "parallel_group": 2,
      "parallel_reason": "기능 3과 완전히 독립적, 다른 파일 수정, 의존성 없음",
      "context": {},
      "subtasks": [],
      "acceptance_criteria": []
    }
  ],
  "final_checklist": [
    {
      "id": 1,
      "description": "기능 동작 검증",
      "verification_method": "직접 기능 호출하여 테스트",
      "checked": false
    },
    {
      "id": 2,
      "description": "컨벤션 준수 확인",
      "verification_method": "프로젝트 컨벤션 문서와 비교",
      "checked": false
    },
    {
      "id": 3,
      "description": "기존 기능 영향 없음 확인",
      "verification_method": "관련 테스트 전체 실행",
      "checked": false
    }
  ]
}
```

### 2.2 JSON Writing Rules (CRITICAL)

⚠️ **JSON 작성 시 반드시 주의할 사항**:

1. **문자열 내 따옴표 escape**:
   ```json
   // ❌ BAD
   {"description": "Use "quotes" here"}
   
   // ✅ GOOD
   {"description": "Use \"quotes\" here"}
   ```

2. **백슬래시 escape**:
   ```json
   // ❌ BAD
   {"path": "C:\Users\name"}
   
   // ✅ GOOD
   {"path": "C:\\Users\\name"}
   ```

3. **줄바꿈 escape**:
   ```json
   // ❌ BAD (actual newline in string)
   {"description": "line1
   line2"}
   
   // ✅ GOOD
   {"description": "line1\nline2"}
   ```

4. **코드 스니펫 포함 시**:
   ```json
   // ❌ BAD
   {"code": "def foo(): return "bar""}
   
   // ✅ GOOD
   {"code": "def foo(): return \"bar\""}
   ```

5. **특수문자 목록**:
   | 문자 | Escape |
   |------|--------|
   | `"` | `\"` |
   | `\` | `\\` |
   | newline | `\n` |
   | tab | `\t` |
   | carriage return | `\r` |

### 2.3 Plan Creation Strategy

1. **Adaptive Detail Level**
   - Small: WHAT + WHERE
   - Medium: + HOW with examples
   - Large: + WHY and full context

2. **TodoWrite**: Each todo = one verifiable action

3. **Success Criteria**: Clear DONE definition, exact verify commands, no ambiguous terms

4. **Parallel Tasks** (with `--parallelable`):
   - Only when certain tasks are independent (different files, zero dependencies)
   - Set `parallel_group` to same number for parallel tasks
   - When uncertain → sequential (set `parallel_group: null`)

---

## Phase 3: Option Processing

### --review Option
Always send as "This is my first draft" to trigger strict review:

```python
Task(
    subagent_type="plan-reviewer",
    description="Review work plan",
    prompt="""
    Please review the created work plan. This is my first draft, and may have lots of mistakes - I have a super-problematic ADHD, so there are tons of mistakes and missing points, so I want you to catch them all.

    Plan location: @./ai-todolist.json

    Please evaluate from these perspectives:
    1. Clarity and achievability of goals
    2. Logical order of implementation steps
    3. Appropriateness of technical approach
    4. Risk identification and mitigation
    5. Sufficiency of validation methods
    6. JSON format validity

    If improvements are needed, please point them out specifically.
    If the plan is sufficiently good, please say "OKAY".
    """
)
```

**Feedback Loop**:
- "OKAY" → Complete
- Improvements requested → Modify and re-review
- **Always say "first draft"** in every iteration (never "I reflected feedback...")

### --edit Option
1. `Read("./ai-todolist.json")`
2. Identify sections needing changes
3. Update only necessary parts, maintain structure
4. **CRITICAL**: Validate JSON format before saving

---

## Phase 4: Final Output

1. **Save JSON**: Write to `./ai-todolist.json` (prettified with 2-space indent)
2. **Validate**: Ensure JSON is valid before completing
3. **TodoWrite**: Add each implementation step
4. **Report**: Confirm save location, step count, implementation scope

### 4.1 JSON Formatting Command

**Always prettify JSON before saving**:

```bash
# Validate and format (if jq available)
cat ai-todolist.json | jq '.' > ai-todolist.json.tmp && mv ai-todolist.json.tmp ai-todolist.json

# Or use Python
python3 -c "import json; f=open('ai-todolist.json'); d=json.load(f); f.close(); open('ai-todolist.json','w').write(json.dumps(d, indent=2, ensure_ascii=False))"
```

---

## Quality Checklist

### Plan Quality
- [ ] Goals clear and measurable?
- [ ] Steps in logical order?
- [ ] Clear completion criteria per step?
- [ ] Matches existing code patterns?
- [ ] Specific test/validation methods?
- [ ] Exception handling plans?

### JSON Quality
- [ ] Valid JSON format? (no syntax errors)
- [ ] All strings properly escaped?
- [ ] Prettified with 2-space indent?
- [ ] No trailing commas?
- [ ] All required fields present?

### Information Fidelity
- [ ] File paths accurate?
- [ ] Reference code from actual project?
- [ ] Commit conventions reflected?
- [ ] Tech stack identified?
- [ ] Project docs discovered?
- [ ] Only task-relevant docs read?

## Core Constraints

1. **Docs Discovery First**: List available docs → selectively read task-relevant ones only
2. **Information First**: Sufficient analysis before planning
3. **Practical Focus**: Implementation over theory
4. **Incremental**: Iterative improvement over one-time perfection
5. **Verifiable**: All steps must be testable
6. **Maintain Patterns**: Keep project's existing style and documented conventions
7. **JSON Only**: Single file, prettified, properly escaped

## Work Completion Message

Provide:
- Save location: `./ai-todolist.json`
- Total steps count
- Implementation scope summary
- JSON validation status: ✅ Valid

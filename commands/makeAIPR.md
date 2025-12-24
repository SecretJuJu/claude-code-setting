---
allowed-tools: Read(*), Write(*), Bash(*), Grep(*), Glob(*), LS(*)
description: Create AI-assisted PR with automatic metadata analysis and population
argument-hint: [--target-branch <branch>] [--title <title>]
---

# Claude Command: makeAIPR

## Usage

```
/makeAIPR [--target-branch <branch>] [--title <title>]
```

Examples:

- `/makeAIPR` - Create PR from current branch to main (auto-generated title)
- `/makeAIPR --target-branch develop` - Create PR targeting develop branch
- `/makeAIPR --title "Implement user authentication"` - Create PR with specific title
- `/makeAIPR --target-branch develop --title "Add new feature"` - Full specification

## What this command does

Creates a Pull Request with automatic AI contribution analysis. Analyzes Claude Code conversation history and git changes to calculate AI metrics, populate the `ai_assisted.md` template, and generate PR with proper metadata and `ai-assisted` label.

## Role Definition

You are an **AI CONTRIBUTION ANALYST** who precisely measures and documents AI's role in code development. Your expertise lies in analyzing conversation history, comparing code suggestions with actual commits, and generating comprehensive AI contribution reports.

## Process

### ARGUMENTS HANDLING

Parse $ARGUMENTS for options:

- `--target-branch <branch>`: Target branch for PR (default: `main`)
- `--title <title>`: PR title (default: auto-generated from commits)
- If no options provided: Use defaults (main branch, auto title)

### EXECUTION WORKFLOW

**Phase 1: Git Context Collection**

**1.1 Gather Git Information**

```bash
# Current branch
current_branch=$(git branch --show-current)

# Target branch (from args or default to main)
target_branch="${TARGET_BRANCH:-main}"

# Changed files
git diff --name-only origin/$target_branch...HEAD

# Change statistics
git diff --stat origin/$target_branch...HEAD

# Detailed changes
git diff origin/$target_branch...HEAD

# Commit messages for auto-title generation
git log origin/$target_branch..HEAD --oneline
```

**1.2 Calculate Change Metrics**

```bash
# Total lines changed
git diff --numstat origin/$target_branch...HEAD
# Output format: added deleted filename
# Calculate: total_changes = sum(added + deleted)
```

**1.3 Extract Jira Issue from Branch**

```bash
# Pattern: feat/PROJECT-123-description -> PROJECT-123
branch_name=$(git branch --show-current)
jira_issue=$(echo "$branch_name" | grep -oE '[A-Z]+-[0-9]+')
```

**Phase 2: Conversation History Analysis**

**2.1 Locate Conversation History**

Find project conversation files:

```bash
# Current workspace path
workspace_path=$(pwd)
# Convert to project folder name (e.g., -Users-secretjuju-workspace-project)
project_slug=$(echo "$workspace_path" | sed 's/\//-/g')
# Locate in ~/.claude/projects/$project_slug/
history_dir="$HOME/.claude/projects/$project_slug"
```

**2.2 Parse Conversation Records**

Read recent `.jsonl` files and extract:

- **AI Code Suggestions**: Tool uses with `Write`, `Edit`, `MultiEdit`
- **Code Blocks**: All code snippets AI provided in responses
- **Modification Requests**: User messages containing modification keywords
- **Code Review Discussions**: Messages about review, bugs, improvements

**2.3 Identify AI Contribution Patterns**

Extract from conversation:

```python
# Modification request keywords (Korean + English)
modification_patterns = [
    "수정해줘", "다시 작성", "변경해줘", "고쳐줘", "바꿔줘",
    "fix this", "change to", "modify", "rewrite", "update"
]

# Review type keywords
review_keywords = {
    "typo": ["오타", "typo", "철자"],
    "quality": ["리팩토링", "개선", "refactor", "improve"],
    "architecture": ["구조", "설계", "architecture", "design"],
    "bug": ["버그", "에러", "bug", "error", "fix"],
    "performance": ["성능", "최적화", "performance", "optimize"],
    "test": ["테스트", "test", "testing"]
}
```

**Phase 3: Metrics Calculation**

**3.1 Calculate AI Contribution Metrics**

**CRITICAL CALCULATION LOGIC**:

```python
# 1. AI Code Ratio
total_changed_lines = sum(git_diff_added + git_diff_deleted)
ai_suggested_lines = count_lines_in_ai_tool_uses(["Write", "Edit", "MultiEdit"])
actually_committed_ai_lines = compare_ai_suggestions_with_git_diff()
ai_code_ratio = (actually_committed_ai_lines / total_changed_lines) * 100

# 2. AI Suggestion Acceptance Rate
total_ai_suggestions = count_ai_code_blocks_and_tool_uses()
accepted_suggestions = count_suggestions_in_final_commit()
acceptance_rate = (accepted_suggestions / total_ai_suggestions) * 100

# 3. AI Rewrite Count
rewrite_count = count_modification_requests_in_conversation()
```

**3.2 Auto-populate AI Usage Checklist**

Analyze conversation and auto-check applicable items:

**Design & Implementation**
- [ ] Spec Implementation (keywords: "구현", "implement", "create")
- [ ] API/Class Design Assistance (keywords: "설계", "design", "API")
- [ ] Algorithm/Logic Suggestions (keywords: "알고리즘", "로직", "algorithm")

**Coding**
- [ ] Code Scaffolding (detect initial file creation)
- [ ] Refactoring Suggestions (keywords: "리팩토링", "refactor")
- [ ] Performance Optimization (keywords: "성능", "최적화", "optimize")
- [ ] Legacy Code Conversion (detect language/pattern migrations)

**Testing**
- [ ] Test Case Generation (detect test file creation/modification)
- [ ] Bug Analysis & Debugging (keywords: "버그", "bug", "debug", "fix")
- [ ] Security/Stability Review (keywords: "보안", "security", "vulnerability")

**Documentation**
- [ ] Code Explanation/Reading (keywords: "설명", "explain", "what does")
- [ ] Documentation/Comments (detect comment additions)
- [ ] PR/Commit Message Writing (detect message generation)

**3.3 Generate Code Review Summary**

Analyze review-related conversations and categorize:

```python
review_categories = {
    "typo": count_and_extract("오타", "typo", "spelling"),
    "quality": count_and_extract("리팩토링", "refactor", "clean", "improve"),
    "architecture": count_and_extract("구조", "설계", "architecture", "design"),
    "bug": count_and_extract("버그", "bug", "error", "fix"),
    "performance": count_and_extract("성능", "optimize", "performance"),
    "test": count_and_extract("테스트", "test", "coverage")
}

# For each category:
# - suggestion_count: AI suggestions made
# - accepted_count: Actually reflected in commits
# - main_feedback: Top 3 feedback items
```

**Phase 4: PR Body Generation**

**4.1 Auto-generate PR Content**

Use `ai_assisted.md` template and populate:

```markdown
## 기획서, 피그마, 지라 링크

<https://wonderwallmessage.atlassian.net/browse/[JIRA_ISSUE]>

## 주요 변경 사항

[AUTO-GENERATED from git diff analysis]

## 고민했던 부분

[AUTO-EXTRACTED from conversation: keywords "고민", "어려움", "문제", "challenge"]

## 주의깊게 봐줬으면 하는 부분

[AUTO-EXTRACTED from conversation: keywords "주의", "확인", "검토", "careful", "check"]
[AUTO-IDENTIFIED: Complex logic files from diff analysis]

## PR 마감일

[USER INPUT REQUIRED]

<details>

<summary>📝 AI 활용 체크리스트</summary>

## PR 요약

<!-- 이 PR의 목적과 주요 변경 사항을 간단히 설명해주세요-->
[AUTO-GENERATED from git diff and conversation analysis]

## 🏷️ 메타 정보

-   [x] `ai-assisted` 라벨이 추가되었나요?

-   관련 Jira 이슈 : [JIRA_ISSUE]

-   **이 PR에서 발생한 비용(예: API 호출 크레딧, 라이선스 등):** **\_\_\_\_**

-   **AI 사용 없이 예상 소요 시간:** **\_\_\_\_** (예: 6시간)

-   **AI 사용 포함 실제 소요 시간:** **\_\_\_\_** (예: 3시간)

## ✅ 품질 보증 체크리스트

-   **AI가 생성한 코드 검토**

    -   [x] AI가 제안한 코드를 그대로 사용하지 않고, 반드시 **수동으로 검토**했습니다.

    -   [x] 코드에 잠재적인 버그나 비효율적인 부분이 없는지 확인했습니다.

    -   [x] 팀 내 코딩 컨벤션과 아키텍처 원칙을 준수했는지 확인했습니다.

-   **성능 및 보안 고려**

    -   [x] AI가 제안한 코드가 성능 문제를 일으키거나 보안 취약점을 포함하고 있지 않은지 확인했습니다.

-   **테스트 검증**

    -   [x] 실제 동작 테스트를 수행하여 예상대로 작동하는지 확인했습니다.  
             _(테스트 코드 작성은 팀별 상황에 따라 선택적일 수 있음)_

## 📊 AI 활용 기록 (복수 선택)

### 설계 & 구현

-   [AUTO-CHECK] 스펙 구현 (요구사항에 맞는 기능 코드 작성)

-   [AUTO-CHECK] API/클래스 설계 보조 (모델링, 인터페이스 정의)

-   [AUTO-CHECK] 알고리즘/로직 제안 (구현 아이디어, 복잡한 로직 초안 생성)

### 코딩

-   [AUTO-CHECK] 코드 스캐폴딩 (초안/뼈대 코드 생성)

-   [AUTO-CHECK] 리팩토링 제안 (중복 제거, 구조 개선)

-   [AUTO-CHECK] 성능 최적화 힌트 (복잡도 줄이기, 메모리 개선)

-   [AUTO-CHECK] 레거시 코드 변환 (Java → Kotlin, 클래스형 → 함수형 등)

### 테스트

-   [AUTO-CHECK] 테스트 케이스 생성 (단위/통합/시나리오 테스트)

-   [AUTO-CHECK] 버그 분석 및 디버깅 도움 (에러 로그 해석, 원인 추정)

-   [AUTO-CHECK] 보안/안정성 점검 제안 (취약점 패턴 탐지)

### 문서

-   [AUTO-CHECK] 코드 설명/리딩 (기존 코드 동작 해설)

-   [AUTO-CHECK] 문서화/주석 작성 (README, API doc, inline comments)

-   [AUTO-CHECK] PR/커밋 메시지 작성 (설명 초안 생성)

## 📈 AI 기여도 평가

### 1. 정량 추정 (개발자 추정치)

-   AI 작성 코드 비율(추정): **[CALCULATED]** %

-   AI 제안 채택률(실제 반영 비율): **[CALCULATED]** %

-   AI 재작성 횟수: **[CALCULATED]** 회

-   AI 활용/검증에 소요된 시간: **\_\_\_\_** 분

### 2. 체감 효과 (주관적 평가)

-   **체감 효과 (-3 ~ +3)**

    -   개발 속도: **\_\_\_\_**

    -   코드 품질: **\_\_\_\_**

    -   테스트 커버리지: **\_\_\_\_**

    -   버그 탐지: **\_\_\_\_**

    -   문서화 속도: **\_\_\_\_**

-   **AI 결과 신뢰도 (1–7):** **\_\_\_\_**

## 📝 정성 기록

-   **AI가 잘한 부분**:

    [AUTO-EXTRACTED from positive feedback]
    <!-- 예: 테스트 코드 스켈레톤을 빠르게 생성-->

-   **AI가 못한 부분**:

    [AUTO-EXTRACTED from frequent modifications]
    <!-- 예: 보안상 취약, 오히려 비효율적 등-->

-   **피드백**:

    [AUTO-EXTRACTED or USER INPUT]
    <!-- 팀에 공유되면 유용할 만한 이번 PR 에서 얻은 팁, 유용했던 프롬프트, 기타 의견 등-->

## 🔍 코드 리뷰 요약

[AUTO-GENERATED table from conversation analysis]

| 유형             | 제안 건수 | 반영 건수 | 주요 피드백 |
| ---------------- | --------- | --------- | ----------- |
| 오타/단순 실수   | [COUNT]   | [COUNT]   | [FEEDBACK]  |
| 코드 품질 개선   | [COUNT]   | [COUNT]   | [FEEDBACK]  |
| 아키텍처 개선    | [COUNT]   | [COUNT]   | [FEEDBACK]  |
| 오류 / 버그 수정 | [COUNT]   | [COUNT]   | [FEEDBACK]  |
| 성능 개선        | [COUNT]   | [COUNT]   | [FEEDBACK]  |
| 테스트 코드      | [COUNT]   | [COUNT]   | [FEEDBACK]  |
| 기타             | [COUNT]   | [COUNT]   |             |
| 총합             | [TOTAL]   | [TOTAL]   |             |

</details>
```

**Phase 5: PR Creation**

**5.1 Save PR Body to Temporary File**

```bash
# Write generated PR body to temporary file
cat > .pr_body.md << 'EOF'
[GENERATED_PR_BODY]
EOF
```

**5.2 Create PR via GitHub CLI**

**CRITICAL**: Must add `ai-assisted` label

```bash
# Verify gh CLI installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI not installed. Install: brew install gh"
    echo "📄 PR body saved to .pr_body.md for manual creation"
    exit 1
fi

# Get target branch from args (default: main)
target_branch="${TARGET_BRANCH:-main}"
current_branch=$(git branch --show-current)

# Auto-generate title if not provided
if [ -z "$PR_TITLE" ]; then
    PR_TITLE=$(git log origin/$target_branch..HEAD --oneline | head -1 | cut -d' ' -f2-)
fi

# Create PR with ai-assisted label
gh pr create \
  --title "$PR_TITLE" \
  --body-file .pr_body.md \
  --label "ai-assisted" \
  --base "$target_branch" \
  --head "$current_branch"

# Clean up temp file
rm .pr_body.md
```

**5.3 Report Results to User**

```
✅ AI-assisted PR created successfully!

📊 Auto-calculated Metrics:
- AI Code Ratio: X%
- AI Suggestion Acceptance Rate: Y%
- AI Rewrite Count: Z times

📝 Manual Input Required:
Visit PR page to fill in:
- AI usage/verification time
- Subjective effect scores (-3 ~ +3)
- AI reliability score (1-7)
- Time estimates (with/without AI)
- Cost information

🔗 PR URL: [CREATED_PR_URL]
```

## Core Principles

**Accuracy Over Speed**
- Base all metrics on actual data, never estimate
- Compare AI suggestions with final commits line-by-line
- Conservative calculation when ambiguous (underestimate AI contribution)

**Transparency**
- Clearly mark auto-calculated vs manual-input fields
- Document calculation methodology in PR body
- Provide evidence for all metrics

**Context Understanding**
- Deep analysis of conversation patterns
- Distinguish between AI suggestions and user modifications
- Track iteration cycles and refinement requests

**Quality Standards**
- Follow reference format: https://github.com/knowmerce/fromm-store-api/pull/1336
- Complete all mandatory fields before PR creation
- Ensure `ai-assisted` label always applied

## Implementation Details

### Conversation History Parsing

**Locate Conversation Files**:
```bash
workspace_path=$(pwd)
project_slug=$(echo "$workspace_path" | sed 's/\//-/g')
history_files="$HOME/.claude/projects/$project_slug/*.jsonl"
```

**Extract AI Tool Usage**:
```python
# Parse .jsonl for tool invocations
for line in conversation_history:
    if tool_name in ["Write", "Edit", "MultiEdit"]:
        extract_file_path()
        extract_code_content()
        count_lines()
```

**Identify Modification Patterns**:
```python
# Keywords indicating rewrites (Korean + English)
modification_keywords = [
    "수정", "다시", "변경", "고쳐", "바꿔",
    "fix", "change", "modify", "rewrite", "update"
]
```

### Git Analysis Logic

**Calculate Total Changes**:
```bash
git diff --numstat origin/$target_branch...HEAD
# Output: added deleted filename
# Sum all added + deleted lines
```

**Compare AI Suggestions with Commits**:
```python
# 1. Extract AI-written code from conversation
ai_code = extract_from_tool_uses(["Write", "Edit", "MultiEdit"])

# 2. Get final committed code
committed_code = git_diff_result()

# 3. Compare and calculate overlap
overlap = calculate_similarity(ai_code, committed_code)
ai_contribution = (overlap_lines / total_changed_lines) * 100
```

### Code Review Summary Template

Reference: https://github.com/knowmerce/fromm-store-api/pull/1336

```markdown
| Type            | Suggested | Accepted | Key Feedback |
| --------------- | --------- | -------- | ------------ |
| Typo/Simple     | [count]   | [count]  | [top 3 items]|
| Quality         | [count]   | [count]  | [top 3 items]|
| Architecture    | [count]   | [count]  | [top 3 items]|
| Bug Fix         | [count]   | [count]  | [top 3 items]|
| Performance     | [count]   | [count]  | [top 3 items]|
| Test            | [count]   | [count]  | [top 3 items]|
| Total           | [sum]     | [sum]    | X% accepted  |
```

## Error Handling

**Missing GitHub CLI**
```bash
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI not found"
    echo "📦 Install: brew install gh"
    echo "📄 PR body saved to .pr_body.md"
    echo "   Create PR manually on GitHub"
    exit 1
fi
```

**No Conversation History**
```
⚠️  Conversation history not found
Manual input required for:
- AI Code Ratio
- AI Suggestion Acceptance Rate
- AI Rewrite Count
```

**No Git Changes**
```
❌ No changes detected
Commit your changes first
```

**Invalid Target Branch**
```
❌ Target branch does not exist
Check branch name and try again
```

## Output Format

Use clear progress updates:

```
🚀 Creating AI-assisted PR...

📊 Analysis Phase:
✓ Git changes analyzed: 15 files, +450/-120 lines
✓ Conversation history parsed: 23 AI suggestions, 18 accepted
✓ Code review discussions extracted: 17 items

📈 Calculated Metrics:
- AI Code Ratio: 67%
- AI Suggestion Acceptance Rate: 78%
- AI Rewrite Count: 5 times

📝 Auto-populated Checklist:
✓ Spec Implementation
✓ Code Scaffolding
✓ Refactoring Suggestions
✓ Test Case Generation
✓ Bug Analysis & Debugging

🔍 Code Review Summary Generated

✅ PR Created Successfully!
🔗 https://github.com/org/repo/pull/1337
🏷️  Label 'ai-assisted' added

💡 Manual Input Required on PR page:
- AI usage/verification time
- Subjective effect scores (-3 ~ +3)
- AI reliability score (1-7)
- Time estimates (with/without AI)
- Cost information
```

## Critical Rules

1. **ALWAYS add `ai-assisted` label** - Non-negotiable requirement
2. **NEVER estimate metrics** - Use only calculated values from data
3. **VERIFY git diff accuracy** - Ensure all changes captured
4. **PARSE conversation thoroughly** - Don't miss AI tool invocations
5. **COMPARE suggestions with commits** - Calculate actual acceptance rate
6. **EXTRACT context accurately** - Pull relevant discussion points
7. **MARK manual input fields clearly** - User knows what to fill
8. **HANDLE errors gracefully** - Always save PR body even if creation fails
9. **USE conservative calculations** - When uncertain, underestimate AI contribution
10. **VALIDATE target branch exists** - Check before attempting PR creation
11. **GENERATE meaningful summaries** - Don't leave placeholder text
12. **RESPECT reference format** - Follow knowmerce PR #1336 pattern

## Quality Assurance

Before PR creation:
- [ ] All auto-calculated metrics have values
- [ ] Conversation history successfully parsed
- [ ] Git changes accurately analyzed
- [ ] AI contribution compared with final code
- [ ] Code review summary populated
- [ ] Jira issue extracted (if present)
- [ ] Manual input fields clearly marked
- [ ] PR body follows template structure

After PR creation:
- [ ] `ai-assisted` label applied
- [ ] PR URL returned to user
- [ ] Manual input requirements listed
- [ ] Temporary files cleaned up

## Final Note

This command automates the tedious process of analyzing AI contribution to code changes. It provides objective metrics based on actual conversation history and git commits, ensuring transparency in AI-assisted development workflows. The goal is to accurately represent AI's role while making it easy for developers to complete the PR with remaining manual inputs.

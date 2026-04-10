---
name: makeAIPR
description: >-
  Create an AI-assisted GitHub PR with automatically analyzed metadata (AI code ratio, acceptance
  rate, rewrite count) and a generated PR body. Use this skill whenever the user asks to
  "make a PR", "create PR", "PR 만들어", "AI PR 생성", "gh pr 만들어줘", or wants an ai-assisted
  labeled pull request. Also activate when the user is ready to push and needs a PR created.
allowed-tools: Read, Write, Bash, Grep, Glob
---

# MAKE AI PR: CONTEXT-EFFICIENT PR CREATION

Create AI-assisted PRs with automatic contribution analysis.

## USAGE
Pass optional flags (`--target-branch <branch>`, `--title <title>`) as arguments.

---

## WORKFLOW

### Phase 1: Git Analysis

```bash
target_branch="${TARGET_BRANCH:-main}"
current_branch=$(git branch --show-current)

# Changes
git diff --name-only origin/$target_branch...HEAD
git diff --stat origin/$target_branch...HEAD

# Extract Jira from branch
jira_issue=$(echo "$current_branch" | grep -oE '[A-Z]+-[0-9]+')

# Commits for title
git log origin/$target_branch..HEAD --oneline
```

### Phase 2: Conversation Analysis (OPTIONAL - SKIP IF NO HISTORY)

Location: `~/.claude/projects/[project-slug]/*.jsonl`

Extract:
- AI tool uses: Write, Edit, MultiEdit
- Modification keywords: "수정", "다시", "fix", "change"
- Review discussions

**IF NO HISTORY: Skip to Phase 3, mark metrics as "수동 입력 필요"**

### Phase 3: Calculate Metrics

```python
# AI Code Ratio
ai_lines = lines_from_AI_tools()
total_lines = git_diff_lines()
ai_ratio = (ai_lines / total_lines) * 100

# Acceptance Rate
accepted = suggestions_in_final_commit()
total = all_ai_suggestions()
acceptance_rate = (accepted / total) * 100

# Rewrite Count
rewrites = count_modification_requests()
```

### Phase 4: Generate PR Body

```markdown
## 주요 변경 사항
[from git diff analysis]

## 고민했던 부분
[from conversation: "고민", "어려움", "challenge"]

<details>
<summary>📝 AI 활용 체크리스트</summary>

## 📊 AI 기여도
- AI 코드 비율: [CALCULATED]%
- AI 제안 채택률: [CALCULATED]%
- AI 재작성 횟수: [CALCULATED]회

## 📈 AI 활용 기록
### 설계 & 구현
- [AUTO-CHECK] 스펙 구현
- [AUTO-CHECK] API/클래스 설계

### 코딩
- [AUTO-CHECK] 코드 스캐폴딩
- [AUTO-CHECK] 리팩토링 제안

### 테스트
- [AUTO-CHECK] 테스트 케이스 생성
- [AUTO-CHECK] 버그 분석

## 🔍 코드 리뷰 요약
| 유형 | 제안 | 반영 | 주요 피드백 |
|------|------|------|-------------|
| 오타/단순 | [N] | [N] | [feedback] |
| 품질 개선 | [N] | [N] | [feedback] |
| 버그 수정 | [N] | [N] | [feedback] |

</details>
```

### Phase 5: Create PR

```bash
# Save body
cat > /tmp/pr_body_$(date +%s).md << 'EOF'
[GENERATED_BODY]
EOF

# Create with label
gh pr create \
  --title "$PR_TITLE" \
  --body-file /tmp/pr_body_*.md \
  --label "ai-assisted" \
  --base "$target_branch"
```

---

## OUTPUT

```
✅ AI-assisted PR created!

📊 Metrics:
- AI Code Ratio: X%
- Acceptance Rate: Y%
- Rewrites: Z

📝 Manual input needed:
- Time estimates
- Subjective scores
- Cost info

🔗 PR: [URL]
```

---

## CRITICAL RULES

1. **ALWAYS add `ai-assisted` label**
2. **NEVER estimate** - Use calculated values only
3. **CONSERVATIVE calculation** - When uncertain, underestimate AI
4. **SAVE body to /tmp first** - Get user confirmation
5. **HANDLE missing history gracefully** - Mark as manual input

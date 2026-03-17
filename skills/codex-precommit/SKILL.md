---
name: codex-precommit
description: |
  커밋 전 staged diff를 Codex에게 보내 독립적 코드리뷰를 받습니다.
  "커밋 전 리뷰", "precommit", "커밋해도 될까", "push 전 체크" 키워드에 반응합니다.
allowed-tools: Bash, Read, Glob
---

# Codex Pre-Commit Review

커밋 전에 staged changes를 Codex에게 보내 독립적 리뷰를 받는 스킬입니다.
다른 모델의 관점에서 내가 놓친 문제를 잡아냅니다.

## 실행 흐름

### Step 1: Diff 수집
```bash
# staged changes가 있으면 staged, 없으면 unstaged
DIFF=$(git diff --cached)
if [ -z "$DIFF" ]; then
  DIFF=$(git diff)
fi
```

### Step 2: Codex에 리뷰 요청
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
🔴 CRITICAL: [must fix before commit]
🟡 WARNING: [should consider]
✅ APPROVED if no critical issues found

Be concise. Only flag real issues."
```

### Step 3: 결과 처리
- 🔴 CRITICAL 있으면 → 커밋 전에 수정
- 🟡 WARNING만 있으면 → 사용자에게 판단 위임
- ✅ APPROVED → 커밋 진행

## 규칙

1. **cx-review.sh 래퍼 사용** — raw codex exec 금지
2. **staged diff 우선** — staged가 없으면 unstaged diff 사용
3. **diff가 없으면 스킵** — 변경사항 없으면 실행하지 않음
4. **민감 정보 필터** — .env 내용이 diff에 포함되어 있으면 경고

---
name: delegate-codex
description: |
  Codex를 사고 파트너로 활용합니다.
  코드리뷰, 설계 검증, 깊은 사고가 필요한 문제, 트레이드오프 분석,
  세컨드 오피니언, 디버깅 상담 등 범용적으로 사용합니다.
  "codex한테", "리뷰해줘", "검증해줘", "고민", "피드백", "맡겨",
  "깊게 생각", "세컨드 오피니언" 키워드에 반응합니다.
allowed-tools: Bash, Read, Glob
---

# Codex Thinking Partner

Codex를 범용 사고 파트너로 활용하는 스킬입니다.

## CRITICAL: Context-Safe Invocation

**반드시 `~/.claude/scripts/cx-review.sh` 래퍼를 사용하세요.**

Codex의 raw 출력(thinking, reasoning, session noise)은 매우 길 수 있습니다.
`cx-review.sh`는:
- 전체 출력을 `/tmp/cx-review-*.md`에 저장
- 200줄 이하면 그대로 반환, 초과시 마지막 200줄만 반환
- Opus 컨텍스트를 보호

```bash
# GOOD — 래퍼 사용
~/.claude/scripts/cx-review.sh '[프롬프트]'

# BAD — raw 호출 금지 (컨텍스트 낭비)
codex exec --skip-git-repo-check '...'
```

## 사용 시점

| 상황 | 예시 |
|-----|-----|
| 코드 리뷰 | "이 코드 리뷰해줘" |
| 설계 검증 | "이 접근 방식 괜찮을까?" |
| 깊은 사고 위임 | "이 문제 깊게 생각해봐" |
| 트레이드오프 분석 | "A vs B 어떤게 나을까?" |
| 디버깅 상담 | "이 에러 원인이 뭘까?" |
| 세컨드 오피니언 | "내 분석 맞는지 확인해줘" |
| 아키텍처 고민 | "이 구조로 가도 될까?" |

## 프롬프트 작성법

### 핵심 원칙
1. **Codex는 현재 대화를 모름** — 필요한 컨텍스트를 모두 포함
2. **구체적으로** — 막연한 질문 대신 판단 기준 제시
3. **형식 지정** — 원하는 응답 포맷을 명시

### 템플릿

```bash
~/.claude/scripts/cx-review.sh 'Think deeply and thoroughly.

[역할 또는 관점 지정]

[질문 또는 요청]

Context:
- Project: [프로젝트 설명]
- Tech stack: [기술 스택]
- Constraints: [제약사항]

[구체적인 평가 기준 또는 관점]

Be direct and critical. Respond concisely.'
```

## 예시

### 코드리뷰
```bash
~/.claude/scripts/cx-review.sh 'Think deeply.
You are a senior code reviewer. Review this code:

[코드 또는 diff]

Review for: correctness, design, performance, security.
Format: 🔴 Critical / 🟡 Suggestion / 🟢 Good'
```

### 설계 검증
```bash
~/.claude/scripts/cx-review.sh 'Think deeply.
Validate this design:

[설계 내용]

1. Does it meet requirements?
2. What edge cases are missed?
3. Simpler alternatives?
4. What could go wrong in production?'
```

### 디버깅 상담
```bash
~/.claude/scripts/cx-review.sh 'Think deeply.
Debug this issue:

Error: [에러 메시지]
Code: [관련 코드]
Context: [재현 조건]

What are the most likely root causes? Rank by probability.'
```

### 트레이드오프 분석
```bash
~/.claude/scripts/cx-review.sh 'Think deeply.
Compare these approaches:

Option A: [설명]
Option B: [설명]

Context: [프로젝트 상황, 제약사항]

Compare on: complexity, performance, maintainability, risk.
Give a clear recommendation with reasoning.'
```

## 출력이 잘렸을 때

```bash
# 전체 출력 확인
cat /tmp/cx-review-*.md
```

## 규칙

1. **항상 `cx-review.sh` 래퍼 사용** — raw codex exec 호출 금지
2. **충분한 컨텍스트 포함** — Codex는 현재 대화를 모름
3. **민감 정보 제외** — API 키, 비밀번호 등 제외

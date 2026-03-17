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

전체 출력은 항상 `/tmp/cx-review-*.md`에 저장됩니다.
`--lines N` 옵션으로 Opus 컨텍스트에 들어오는 양을 조절합니다.

```bash
# 예상 출력 크기에 따라 --lines 조절
cx='~/.claude/scripts/cx-review.sh'

$cx --lines 50  'Quick question...'     # 짧은 질문
$cx --lines 100 'Review this code...'   # 코드리뷰
$cx --lines 200 'Deep analysis...'      # 깊은 분석
$cx --lines all 'Short answer...'       # 전체 출력 (짧을 때)
$cx              'Massive analysis...'  # 메타만 → Read로 선택 읽기

# BAD — raw 호출 금지 (컨텍스트 낭비)
codex exec --skip-git-repo-check '...'
```

### --lines 가이드
| 예상 출력 | --lines | 이유 |
|-----------|---------|------|
| 한줄 답변 | `all` | 전체 읽어도 작음 |
| 짧은 피드백 | `50` | 대부분 커버 |
| 코드리뷰 | `100` | 핵심 이슈 포함 |
| 깊은 분석 | `200` | 결론 + 주요 근거 |
| 대규모 분석 | (생략) | 메타만 받고 Read로 필요한 부분만 |

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

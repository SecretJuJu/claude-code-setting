---
name: delegate-codex
description: |
  Codex를 코드리뷰 파트너로 활용합니다.
  구현 전 설계 검증, 코드 리뷰, 엣지케이스 발견,
  다른 관점에서의 피드백이 필요할 때 사용합니다.
  "codex한테 리뷰", "리뷰해줘", "검증해줘", "피드백" 키워드에도 반응합니다.
allowed-tools: Bash, Read, Glob
---

# Codex Code Review Partner

Codex를 코드리뷰 파트너로 활용하는 스킬입니다.

## CRITICAL: Context-Safe Invocation

**반드시 `~/.claude/scripts/cx-review.sh` 래퍼를 사용하세요.**

Codex의 raw 출력(thinking, reasoning, session noise)은 매우 길 수 있습니다.
`cx-review.sh`는:
- 전체 출력을 `/tmp/cx-review-*.md`에 저장
- 200줄 이하면 그대로 반환, 초과시 마지막 200줄만 반환
- Opus 컨텍스트를 보호

```bash
# GOOD — 래퍼 사용
~/.claude/scripts/cx-review.sh 'Review this code...'

# BAD — raw 호출 금지 (컨텍스트 낭비)
codex exec --skip-git-repo-check '...'
```

## 사용 시점

| 상황 | 예시 |
|-----|-----|
| 구현 전 설계 검증 | "이 접근 방식 괜찮을까?" |
| 코드 리뷰 | "이 코드 리뷰해줘" |
| 엣지케이스 발견 | "놓친 케이스 없나?" |
| 리팩토링 의견 | "더 나은 구조 있을까?" |
| 트레이드오프 분석 | "A vs B 어떤게 나을까?" |

## 실행 방법

### 1. 코드리뷰 요청

```bash
~/.claude/scripts/cx-review.sh 'Think deeply and thoroughly.

You are a senior code reviewer. Review the following code:

[코드 또는 diff 붙여넣기]

Context:
- Project: [프로젝트 설명]
- Goal: [구현 목표]
- Constraints: [제약사항]

Review for:
1. Correctness - bugs, logic errors, edge cases
2. Design - patterns, abstractions, coupling
3. Maintainability - readability, naming, complexity
4. Performance - obvious bottlenecks
5. Security - input validation, injection risks

Format your response as:
- 🔴 Critical issues (must fix)
- 🟡 Suggestions (should consider)
- 🟢 Good patterns (worth noting)
- Summary: 1-2 sentence verdict'
```

### 2. 설계 검증 요청

```bash
~/.claude/scripts/cx-review.sh 'Think deeply and thoroughly.

Validate this design approach:

[설계 내용 또는 계획]

Context:
- Requirements: [요구사항]
- Tech stack: [기술 스택]
- Existing patterns: [기존 패턴]

Evaluate:
1. Does this approach meet all requirements?
2. What edge cases might be missed?
3. Are there simpler alternatives?
4. What could go wrong in production?

Be direct and critical. Flag real issues only.'
```

### 3. 출력이 잘렸을 때

```bash
# 전체 출력 확인이 필요하면 tmp 파일을 직접 읽기
cat /tmp/cx-review-*.md
```

## 규칙

1. **항상 `cx-review.sh` 래퍼 사용** — raw codex exec 호출 금지
2. **항상 코드/diff 포함** — Codex는 현재 대화를 모름
3. **구체적 컨텍스트 제공** — 프로젝트 배경, 제약사항, 기존 패턴
4. **Critical 이슈만 집중** — nitpick 보다 실질적 문제 위주
5. **민감 정보 제외** — API 키, 비밀번호 등 제외

## 수동 호출

`/delegate-codex [요청]` 명령어로 호출 가능합니다.

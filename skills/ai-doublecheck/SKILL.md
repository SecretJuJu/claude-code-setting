---
name: ai-doublecheck
description: |
  다른 AI(Codex, Gemini)와 계획/코드/결과를 더블체크하고 검증합니다.
  "더블체크", "검증해줘", "다른 AI한테 확인", "크로스체크", "세컨드 오피니언" 등의
  키워드가 있을 때 사용합니다. 계획 수립, 코드 리뷰, 중요 결정 시 활용하세요.
allowed-tools: Read, Bash, Glob
---

# AI Double Check

다른 AI 에이전트(Codex, Gemini)와 교차 검증하는 스킬입니다.

## 사용 조건

먼저 설정 파일을 확인합니다:
```bash
cat ~/.claude/skills/ai-doublecheck/config.json
```

`enabled: false`면 사용자에게 알리고 중단합니다.

## 검증 프로세스

### 1. 검증 대상 준비

검증할 내용을 200토큰 이내로 압축합니다:
- 계획: 핵심 목표와 주요 단계
- 코드: 핵심 로직과 의도
- 결정: 선택지와 선택 이유

### 2. Codex 검증

```bash
codex exec --skip-git-repo-check 'Think deeply. 다음 내용을 검증하고 문제점/개선점을 지적해줘:

[검증 대상 내용]

응답 형식:
- 문제점: (있으면)
- 개선 제안: (있으면)
- 동의: (동의하는 부분)
≤150 tokens로 압축.'
```

### 3. Gemini 검증

```bash
gemini -y -p "Think deeply. 다음 내용을 검증하고 문제점/개선점을 지적해줘:

[검증 대상 내용]

응답 형식:
- 문제점: (있으면)
- 개선 제안: (있으면)
- 동의: (동의하는 부분)
≤150 tokens로 압축."
```

### 4. 결과 종합

세 AI(Claude, Codex, Gemini)의 의견을 비교:

| 항목 | Claude | Codex | Gemini |
|-----|--------|-------|--------|
| 동의 | | | |
| 우려 | | | |
| 제안 | | | |

**합의점**: 모두 동의하는 부분
**이견**: 의견이 다른 부분 → 사용자에게 판단 요청

## 토글 명령

활성화/비활성화는 config.json 수정:
```bash
# 확인
cat ~/.claude/skills/ai-doublecheck/config.json

# 활성화
sed -i '' 's/"enabled": false/"enabled": true/' ~/.claude/skills/ai-doublecheck/config.json

# 비활성화
sed -i '' 's/"enabled": true/"enabled": false/' ~/.claude/skills/ai-doublecheck/config.json
```

## 사용 예시

사용자: "이 계획 더블체크해줘"
→ 이 스킬 자동 트리거

사용자: "코드 작성하고 다른 AI한테도 검증받아"
→ 코드 작성 후 이 스킬로 검증

## 주의사항

- 각 AI 호출에 시간이 걸립니다 (5-15초)
- 민감한 정보는 검증 대상에서 제외하세요
- 최종 판단은 항상 사용자가 합니다

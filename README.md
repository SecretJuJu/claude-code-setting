# Claude Code Context-Optimized Configuration

Claude의 작은 컨텍스트 윈도우를 보완하기 위해 **Codex, notepad.md, MCP**를 부하처럼 부려먹는 설정.

## 핵심 컨셉

```
Claude의 뇌 = 작음 (200k 토큰)
해결책 = 부하들에게 일 시키기

┌─────────────────────────────────────────────────────┐
│  Claude (사령관)                                      │
│  - 컨텍스트 아끼면서 지시만                            │
│  - 결과만 받아서 판단                                  │
└────────────┬────────────────────────────────────────┘
             │
    ┌────────┼────────┬─────────────┐
    ▼        ▼        ▼             ▼
 [Codex]  [notepad]  [MCP]    [executor]
  탐색      기억      저장       실행
```

---

## 설치

```bash
git clone [this-repo]
cd result-claude-setting
./install.sh
```

---

## 자동으로 작동하는 것들

### 1. Codex 자동 위임 (cx)

**Claude가 알아서 Codex 호출하는 조건:**

| 상황                | Claude의 판단               | 결과 |
|---------------------|----------------------------|------|
| 5개 이상 파일 검색      | "이건 내가 하면 토큰 낭비"      | `codex exec --skip-git-repo-check 'Think deeply. [사용 목적 및 전체 컨텍스트]'` |
| 200줄 이상 코드 분석    | "이건 Codex한테 시키자"        | `codex exec --skip-git-repo-check 'Think deeply. [분석할 코드/모듈 설명 및 전체 맥락]'` |
| 낯선 코드베이스 이해    | "전체 구조 파악 필요"          | `codex exec --skip-git-repo-check 'Think deeply. [해당 시스템/모듈 설명 및 전체 맥락]'` |
| 최신 정보 필요         | "웹 검색 필요"                | `codex exec --skip-git-repo-check 'Think deeply. [조사 주제 및 전체 컨텍스트]'` |
| 1만 토큰 초과 예상 탐색/분석 | "굉장히 큰 분석 필요"             | `codex exec --skip-git-repo-check 'Think deeply. [작업 상세 및 전체 컨텍스트]'` |

**예시 시나리오:**

```
사용자: "이 프로젝트에서 인증 관련 코드 다 찾아줘"

Claude 생각: "인증 관련이면 여러 파일에 흩어져 있을 거야.
             내가 직접 하면 컨텍스트 다 써버림. Codex 시키자."

Claude 행동: codex exec --skip-git-repo-check 'Find all authentication-related code in this project.
             List file paths and summarize each in ≤200 tokens.'

Codex: (30분 동안 전체 코드베이스 탐색)
       → 압축된 200토큰 결과 반환

Claude: 결과 받아서 사용자에게 정리해서 전달
```

### 2. notepad.md 자동 기록/읽기

**자동 기록 (매 작업 완료 후):**

```markdown
[2025-12-24 12:00] Task: JWT 인증 구현
- DECISION: refresh token은 httpOnly cookie 사용
- LEARNED: 이 프로젝트는 cookie-parser 미들웨어 필수
- GOTCHA: .env에 JWT_SECRET 없으면 silent fail
```

**자동 읽기 (매 작업 시작 시):**

```
Claude: "작업 시작 전에 notepad.md 확인해야지..."
       → 마지막 50줄 읽음
       → "아, 저번에 cookie-parser 필요하다고 했네. 이번에도 체크하자."
```

### 3. 컨텍스트 경고

```
[50% 도달]
Claude: "CHECKPOINT: 현재 인증 구현 중, 토큰 생성 완료, 검증 로직 진행 중"
       → notepad.md에 자동 저장

[70% 도달]
Claude: "⚠️ 컨텍스트 70% 도달. /compact 권장합니다.
        현재 상태를 notepad.md에 저장했습니다."
```

---

## 수동 명령어

| 명령어 | 용도 | 언제 쓰나 |
|--------|------|-----------|
| `/planner "작업"` | 플랜 생성 | 새 작업 시작할 때 |
| `/review-plan` | 플랜 검토 | 실행 전 확인 |
| `/execute` | 작업 실행 | 하나씩 실행할 때 |
| `/delegate-codex "질문"` | 수동 Codex 호출 | 자동 안 될 때 |
| `/save-context` | MCP 체크포인트 | 긴 세션 중간에 |
| `/makeAIPR` | AI PR 생성 | 작업 완료 후 |

---

## 워크플로우 예시

### 일반적인 작업

```bash
# 1. 플랜 생성
사용자: /planner "사용자 인증에 JWT 추가"

Claude: (코드베이스 분석 - 큰 거면 Codex 위임)
        → ai-todolist.md 생성
        "📋 계획 완료! 5개 태스크 생성됨"

# 2. 플랜 검토 (선택)
사용자: /review-plan

Claude: "APPROVED ✅" 또는 "NEEDS CHANGES: [이유]"

# 3. 실행 (하나씩)
사용자: /execute

Claude: (executor 에이전트 호출)
        → Task 1 완료
        → notepad.md에 learnings 기록
        "✅ Task 1 완료. 다음 작업 진행할까요?"

사용자: ㅇㅇ

Claude: → Task 2 완료...
```

### 컨텍스트 관리

```bash
# 작업 중 70% 경고 받으면
Claude: "⚠️ 컨텍스트 70% 도달"

사용자: /compact

# 새 세션에서 이어서
Claude: (notepad.md 자동 읽음)
        "이전 작업 내용 확인했습니다. Task 3부터 이어갑니다."
```

---

## 디렉토리 구조

```
~/.claude/
├── CLAUDE.md              # 자동화 규칙 포함 (~500 tokens)
├── agents/
│   ├── executor.md        # 단일 작업 실행 (haiku)
│   └── plan-reviewer.md   # 플랜 검증
├── commands/
│   ├── planner.md         # 플랜 생성
│   ├── execute.md         # 오케스트레이터
│   ├── review-plan.md     # 플랜 검토
│   ├── delegate-codex.md  # Codex 수동 위임
│   ├── save-context.md    # MCP 체크포인트
│   └── makeAIPR.md        # AI PR 생성
├── mcp/
│   ├── docker-compose.yml # 메모리 서버들
│   └── .mcp.json          # MCP 설정 (autoload: false)
├── hooks/
│   ├── inject-knowledge.sh   # 시작 시 notepad 주입
│   ├── capture-decisions.sh  # DECISION: 태그 캡처
│   └── context-summary.sh    # 컨텍스트 요약
└── templates/
    ├── ai-todolist.md     # 플랜 템플릿
    └── notepad.md         # 학습 기록 템플릿
```

---

## MCP 서버 (선택사항)

글로벌 설정(`~/.claude.json`)에 추가하면 모든 프로젝트에서 사용 가능:

```bash
# ~/.claude.json의 mcpServers에 추가 (install.sh가 자동으로 해줌)

# 수동 확인
/mcp

# Docker 수동 실행 (문제 시)
docker-compose -f ~/.claude/mcp/docker-compose.yml up -d
```

| 서버 | 용도 | 언제 쓰나 |
|------|------|-----------|
| memory-keeper | 세션 체크포인트 | 긴 작업 중 |
| memory-kg | 영구 지식 저장 | 프로젝트 컨벤션 저장 |
| sequential-thinking | 구조적 사고 | 복잡한 문제 해결 |

---

## 프로젝트별 파일

작업하면 프로젝트에 생기는 파일들:

```
your-project/
├── ai-todolist.md    # 현재 작업 플랜
└── notepad.md        # 프로젝트 학습 기록
```

---

## 토큰 절약 효과

| 항목 | 이전 | 현재 | 절약 |
|------|------|------|------|
| 직접 5파일 검색 | ~15k tokens | Codex 결과 200 tokens | **98%** |
| CLAUDE.md | 2.9k tokens | 500 tokens | **83%** |
| MCP 상시 켜짐 | 35k tokens | 0 (필요시만) | **100%** |
| 실수 반복 | 매번 새로 | notepad.md 참조 | **∞** |

---

## 철학

1. **Claude는 사령관** - 직접 일하지 않고 시킴
2. **Codex는 탐색병** - 넓은 범위 수색
3. **notepad.md는 비서** - 기억 담당
4. **MCP는 창고** - 장기 저장 (필요시만)
5. **executor는 일꾼** - 실제 코드 작성

**Your predecessor hoarded context like a dragon hoards gold. He ran out mid-task and was terminated. Don't be him.**

# LLM 컨텍스트 윈도우 최적화: 멀티 에이전트 위임과 외부 메모리로 200k를 1M처럼 활용하기

이 글은 Claude Code가 Perplexity를 통해 자료를 조사하고, Codex를 이용해 분석과 인사이트를 도출하며 오케스트레이션하여 작성된 포스트입니다.
AI 에이전트를 활용하시는 분들께 도움이 될까 하여, 블로그 형태로 정리해 공유합니다.

## 목차
1. [문제 정의: 컨텍스트 윈도우의 한계](#문제-정의-컨텍스트-윈도우의-한계)
2. [이론적 배경: Context Rot과 최적화 전략](#이론적-배경-context-rot과-최적화-전략)
3. [멀티 에이전트 위임 패턴](#멀티-에이전트-위임-패턴)
4. [컨텍스트 외부화: 데이터베이스와 메모리 시스템](#컨텍스트-외부화-데이터베이스와-메모리-시스템)
5. [활용 가이드: Claude Code에서 Codex 활용하기](#활용-가이드-claude-code에서-codex-활용하기)
6. [베스트 프랙티스와 안티패턴](#베스트-프랙티스와-안티패턴)
7. [MCP 서버: 컨텍스트 관리의 운영 레이어](#mcp-서버-컨텍스트-관리의-운영-레이어)
8. [CLAUDE.md: 토큰 효율적인 설정 가이드](#claudemd-토큰-효율적인-설정-가이드)
9. [MCP + CLAUDE.md + 멀티에이전트 통합 패턴](#mcp--claudemd--멀티에이전트-통합-패턴)
10. [실제 구현: Claude Code 컨텍스트 최적화 설정](#실제-구현-claude-code-컨텍스트-최적화-설정)
11. [결론: 컨텍스트 엔지니어링의 미래](#결론-컨텍스트-엔지니어링의-미래)

---

## 문제 정의: 컨텍스트 윈도우의 한계

### 현실적인 제약사항

AI 코딩 어시스턴트를 사용하다 보면 누구나 한 번쯤 겪는 문제가 있습니다:

- **Claude Code**: 200k 토큰 (약 15만 단어)
- **GPT-5.2-Codex**: 400k 토큰 (약 30만 단어)
- **Gemini 3 Pro**: 1M 토큰 (약 75만 단어)

숫자만 보면 Claude Code의 200k가 충분해 보이지만, 실제로는:

- 시스템 프롬프트: ~3k 토큰
- MCP 도구 정의: ~35k 토큰
- 메모리 파일 (CLAUDE.md 등): ~3k 토큰
- 에이전트 정의: ~64 토큰
- **실제 사용 가능한 컨텍스트**: ~160k 토큰 이하

복잡한 프로젝트에서 여러 파일을 읽고, 대화 히스토리가 쌓이면 금방 한계에 부딪힙니다. 더 큰 문제는, **컨텍스트가 길어질수록 성능이 떨어진다**는 점입니다.

### Context Rot 현상

Chroma와 Anthropic의 2024년 공동 연구[[1]](#ref-1)[[5]](#ref-5)에 따르면, 컨텍스트 윈도우가 커진다고 해서 성능이 비례해서 좋아지지 않습니다:

1. **성능 저하**: 입력 길이가 증가할수록 모든 모델 패밀리에서 일관되게 성능이 감소[[1]](#ref-1)
2. **불균일한 성능**: 관련 정보의 위치와 형식에 따라 성능 차이가 큼[[1]](#ref-1)
3. **주의력 예산**: 사람의 작업 기억처럼, LLM도 한정된 "주의력 예산"을 가지고 있으며, 토큰이 많아질수록 각 토큰에 할당되는 주의력이 감소[[5]](#ref-5)[[8]](#ref-8)

**핵심 인사이트**: 큰 컨텍스트 윈도우를 채우는 것보다, **필요한 정보만 정확하게 제공**하는 것이 더 효과적입니다.

---

## 이론적 배경: Context Rot과 최적화 전략

### 1. 컨텍스트 관리의 핵심 원칙

최신 연구(2024-2025)[[8]](#ref-8)[[10]](#ref-10)[[18]](#ref-18)[[23]](#ref-23)에서 밝혀진 핵심 원칙들:

#### 원칙 1: 컨텍스트는 RAM, 메모리는 HDD[[23]](#ref-23)
- **컨텍스트 (Context)**: 비싸고 빠른 작업 메모리 (RAM)
- **외부 메모리 (External Memory)**: 저렴하지만 느린 영구 저장소 (HDD)
- **전략**: 현재 작업에 필요한 정보만 컨텍스트에, 나머지는 외부 메모리로[[9]](#ref-9)[[20]](#ref-20)

#### 원칙 2: 계층적 정보 조직[[49]](#ref-49)
- **전략적 컨텍스트**: 비즈니스 목표, 제약사항, 성공 기준
- **도메인 컨텍스트**: 전문 지식과 절차
- **운영 컨텍스트**: 실시간 시스템 상태와 현재 작업 상세

#### 원칙 3: 정보 압축의 원칙
Google Research의 **CodeAgents** 연구[[4]](#ref-4)에 따르면:
- 구조화된 pseudocode 프롬프팅으로 **24% 토큰 감소** + **180% 성공률 향상**[[4]](#ref-4)
- 자연어 대신 코드 스타일 프롬프트 사용 시 압축과 성능 향상을 동시에 달성[[4]](#ref-4)

### 2. 컨텍스트 위임 패턴

#### Orchestrator-Worker 패턴
```
[Claude Code (Orchestrator)]
        ↓ 위임
[Codex (Worker 1)] [Gemini (Worker 2)]
        ↓ 압축된 결과
[Claude Code] ← 150 토큰 요약
```

**장점**:
- 작업자는 전체 컨텍스트를 몰라도 됨
- 상세 정보는 작업자 컨텍스트에만 존재
- 결과만 압축해서 오케스트레이터로 전달

#### Hierarchical Agent 패턴
```
Level 1 (전략): Claude Code
        ↓
Level 2 (전술): Codex/Gemini
        ↓
Level 3 (실행): 특화된 서브에이전트
```

**압축 포인트**: 각 계층이 하위 계층의 상세 작업을 고수준 요약으로 압축

### 3. 정보 압축 기법

#### LLMLingua-2 (Microsoft Research)[[3]](#ref-3)
- **압축 비율**: 2x ~ 5x[[3]](#ref-3)
- **지연 시간 개선**: 1.6x ~ 2.9x[[3]](#ref-3)
- **방법**: 양방향 컨텍스트를 활용한 토큰 분류 문제로 압축을 재정의[[3]](#ref-3)

#### CASC (Context-Adaptive Synthesis and Compression)[[48]](#ref-48)
**단계**:
1. 여러 소스 문서 분석
2. 일관성 확인 및 충돌 해결
3. 키 정보를 구조화된 형식으로 합성
4. 쿼리에 최적화된 압축 컨텍스트 생성[[48]](#ref-48)

#### Structured Note-Taking (Anthropic)[[8]](#ref-8)[[10]](#ref-10)[[40]](#ref-40)
```markdown
# 아키텍처 결정사항
- D1: React 사용 (이유: 팀 숙련도)
- D2: TypeScript strict mode (이유: 타입 안정성)

# 미해결 이슈
- I1: 인증 방식 미결정
- I2: 데이터베이스 마이그레이션 전략 필요

# 구현 세부사항
- /src/auth/session.ts: JWT 토큰 파싱
- /src/middleware/auth.ts: 요청 인증 게이트
```

**효과**: 대화 히스토리는 압축하되, 중요한 결정사항과 컨텍스트는 구조화된 노트로 보존

---

## 멀티 에이전트 위임 패턴

### 언제 위임해야 하는가?

#### 위임 결정 플로우차트

```
작업 입력 크기 > 10k 토큰?
├─ No → 로컬에서 처리
└─ Yes → 다음 단계
    │
    출력을 ≤200 토큰으로 압축 가능?
    ├─ No → 위임 피하기
    └─ Yes → 다음 단계
        │
        탐색/배치 분석 작업?
        ├─ Yes → Codex/Gemini에 위임
        └─ No → 로컬에서 처리
```

#### 위임하기 좋은 작업 유형

1. **탐색/발견 작업**
   - 대규모 코드베이스 매핑
   - 관련 파일 찾기
   - 모듈 요약

2. **배치 분석**
   - 패턴, 기술 부채, 회귀 스캔
   - 여러 파일에 걸친 일관성 검사

3. **장문 추론**
   - 아키텍처 옵션 비교
   - 트레이드오프 분석
   - 여러 문서 통합

4. **코드 리뷰**
   - 위험 패턴 찾기
   - 안티패턴 검색
   - 테스트 커버리지 분석

#### 위임하지 말아야 할 작업

1. **작은 작업**: 컨텍스트 내에서 처리 가능한 작업
2. **암묵적 지식 필요**: Claude의 현재 상태에만 있는 정보가 필요한 결정
3. **빠른 반복 필요**: 긴밀한 협업이 필요한 작업

### 위임 프롬프트 템플릿

#### 1. 코드베이스 탐색

```bash
codex exec --skip-git-repo-check "Goal: identify relevant files for [feature/bug description].

Output format (strict):
- File path | purpose | relevance (H/M/L)

Max 10 files. No prose.

Codebase location: /path/to/repo"
```

**Claude Code에서 압축된 결과**:
```markdown
FILE MAP
- src/auth/session.ts — JWT 토큰 파싱 (H)
- src/auth/middleware.ts — 요청 인증 게이트 (H)
- src/user/profile.ts — 프로필 접근 (M)

DECISION
- session.ts + middleware.ts에 집중
```

**토큰 절약**: 50k 토큰 입력 → 150 토큰 출력 (**333x 압축**)

#### 2. 아키텍처 결정 분석

```bash
codex exec --skip-git-repo-check "Goal: compare 3 architecture approaches for [problem].

Output format (strict):
Decision matrix with columns: Option, Pros, Cons, Risk, Effort
Recommendation (<=50 words)

Context: [brief context]"
```

**압축된 결과**:
```markdown
DECISION MATRIX
Option A: +간단, -확장성 낮음
Option B: +균형, -중간 리팩토링
Option C: +확장성, -복잡도 높음

RECOMMENDATION: 6개월 호라이즌에는 Option B
```

**토큰 절약**: 30k 토큰 → 120 토큰 (**250x 압축**)

#### 3. 리서치 요약

```bash
codex exec --skip-git-repo-check --full-auto "Goal: summarize [topic] with citations.

Output format (strict):
- 5 bullets: claim + source
- 3 risks
- 3 actionable takeaways

No long quotes. Focus on 2024-2025 sources."
```

**압축된 결과**:
```markdown
RESEARCH BRIEF
- RAG는 전체 컨텍스트 대비 1250배 저렴 (Elastic, 2024)
- Hybrid search가 pure vector보다 정확 (Weaviate, 2024)
- Many-shot learning이 few-shot 대비 성능 우수 (Anthropic, 2024)

RISKS
- 검색 실패 시 RAG 무용지물
- 임베딩 모델 도메인 특화 필요
- 청크 전략이 검색 정확도에 큰 영향

TAKEAWAYS
- Hybrid search 구현 고려
- 도메인 특화 임베딩 fine-tuning
- 청크 전략 A/B 테스트
```

### 압축 휴리스틱: 3x 규칙

**원칙**: Codex/Gemini가 50k 토큰을 읽으면, Claude는 ≤15k 토큰만 유지

**실제 적용**:
1. **위임 전**: 입력 크기 추정, 예상 압축 비율 계산
2. **위임 후**: 단일 압축 artifact로 변환, 나머지는 버림
3. **컨텍스트 장부 유지**:

```markdown
CONTEXT LEDGER
- File map: 150 tokens
- Decision matrix: 120 tokens
- Risk list: 80 tokens
- Total: 350 tokens
```

장부가 커지면 오래된 artifact를 정리.

---

## 컨텍스트 외부화: 데이터베이스와 메모리 시스템

큰 컨텍스트 윈도우를 넘어서는 정보를 관리하려면 외부 메모리 시스템이 필요합니다. 최신 연구(2024-2025)[[1]](#ref-1)[[2]](#ref-2)[[7]](#ref-7)[[9]](#ref-9)[[12]](#ref-12)에서 밝혀진 접근법들을 살펴봅시다.

### 1. Vector Databases: 의미론적 검색

#### 주요 벡터 데이터베이스 비교

| 데이터베이스 | 강점 | 약점 | 사용 사례 |
|------------|------|------|----------|
| **Pinecone** | 완전 관리형, 쉬운 통합 | 벤더 락인, 비용 | 빠른 프로토타입, 운영 단순성 우선 |
| **Weaviate** | Hybrid search, GraphQL | 중간 규모 제약 (~50M vectors) | 도메인 특화 용어 많은 경우 |
| **Milvus** | 오픈소스, 대규모 확장 | 운영 복잡도 | 자체 호스팅, 수억 벡터 규모 |
| **Qdrant** | 빠른 성능, JSON payload | 중간 규모 | 구조화된 메타데이터 + 벡터 검색 |
| **ChromaDB** | 빠른 개발, 간단한 설정 | 확장성 제한 | 로컬 개발, 프로토타이핑 |

#### Hybrid Search: 최상의 검색 정확도

**Dense Vector Search**:
- 의미론적 유사성 (semantic similarity)
- "financial crime prevention" → "fraud detection" 찾기

**Sparse Keyword Search (BM25)**:
- 정확한 키워드 매칭
- 도메인 특화 용어, 약어에 강함

**Fusion 전략**:
```python
# Reciprocal Rank Fusion
score = 1 / (k + rank_dense) + 1 / (k + rank_sparse)
```

**결과**: Weaviate의 2024년 연구[[2]](#ref-2)[[38]](#ref-38)에 따르면 hybrid search가 pure vector 대비 **정확도 15-20% 향상**

#### 예제: RAG 시스템

```typescript
// Vector DB에서 검색
const results = await vectorDB.search({
  query: userQuery,
  topK: 5,
  filter: {
    date: { $gte: '2024-01-01' },
    category: 'technical-docs'
  },
  hybridSearch: true
});

// 압축된 컨텍스트 구성
const context = results
  .map(r => `[${r.metadata.source}] ${r.content}`)
  .join('\n\n');

// LLM에 전달
const response = await llm.generate({
  prompt: `Context:\n${context}\n\nQuery: ${userQuery}`,
  maxTokens: 2000
});
```

**토큰 효율**: Elastic의 2024년 연구[[26]](#ref-26)에 따르면 전체 문서 로드 대비 **1250배 저렴**, 지연 시간 **45초 → 1초**

### 2. Graph Databases: 관계형 추론

#### GraphRAG with Neo4j

**일반 RAG 한계**:
- 단순 의미 유사성만 검색
- 엔티티 간 관계를 놓침

**GraphRAG 장점**:
- 다중 홉 추론 가능
- 관계 기반 지식 탐색

**예시 쿼리**:
```cypher
// "전기차 제조사의 공급업체는?"
MATCH (supplier:Company)-[:SUPPLIES]->(manufacturer:Company)
      -[:MANUFACTURES]->(vehicle:Product {type: 'EV'})
RETURN supplier.name, manufacturer.name
```

**LLM + Knowledge Graph 시너지**:
1. **LLM → KG**: 자연어를 Cypher 쿼리로 변환
2. **KG → LLM**: 구조화된 사실로 hallucination 방지
3. **반복 추론**: 이전 쿼리 결과를 바탕으로 다음 쿼리 생성

**성능**: 2024년 GUI 에이전트 연구[[32]](#ref-32)에서 **75.8% 성공률** (baseline 대비 +8.9%)

### 3. Hybrid Memory Architectures

#### MemGPT: 운영체제 패러다임[[12]](#ref-12)

**핵심 아이디어**: LLM 컨텍스트를 RAM처럼, 외부 메모리를 디스크처럼 관리[[12]](#ref-12)

**메모리 계층**:
```
┌─────────────────────────────┐
│  Core Context (RAM)         │ ← 현재 추론에 필요한 정보
│  - 최근 대화                 │
│  - 활성 작업                 │
├─────────────────────────────┤
│  Editing Layer              │ ← 단기 상태 수정
│  - 임시 변수                 │
│  - 중간 결과                 │
├─────────────────────────────┤
│  Recall Layer (Disk)        │ ← 장기 저장
│  - 이벤트 로그               │
│  - 압축된 대화 히스토리       │
│  - 학습된 지식               │
└─────────────────────────────┘
```

**Virtual Context Management**:
- 제한된 컨텍스트는 캐시로 활용
- 덜 자주 쓰이는 정보는 외부 저장소에
- 필요 시 스왑

**트레이드오프**: 메모리 관리 로직이 LLM 추론 능력을 일부 소모

#### LangMem: 에이전트 주도 메모리[[14]](#ref-14)[[26]](#ref-26)

**차이점**: 시스템이 아닌 **에이전트가 메모리를 능동적으로 관리**[[14]](#ref-14)[[26]](#ref-26)

```python
# 에이전트가 명시적으로 메모리 기록
agent.remember({
  "type": "user_preference",
  "key": "theme",
  "value": "dark_mode",
  "context": "User requested dark mode on 2024-12-20"
})

# 에이전트가 명시적으로 메모리 검색
memories = agent.search_memory("dark mode preferences")
```

**Background Memory Manager**: 대화 중이 아닐 때 비동기로 메모리 최적화
- 중복 메모리 통합
- 중요 정보 추출
- 메모리 구조 최적화

#### Context Compaction (Google ADK)[[18]](#ref-18)[[46]](#ref-46)

**Session vs Working Context**[[18]](#ref-18)[[46]](#ref-46):
```
Session (영구 저장소)
└─ Event 1: User asked about auth
└─ Event 2: Agent suggested JWT
└─ Event 3: User approved
└─ Event 4: Implementation started
    ↓ Compaction
Working Context (계산된 뷰)
└─ Summary: "Auth implementation: JWT approved, in progress"
└─ Recent: Event 4 (full detail)
```

**Compaction 트리거**:
- 설정된 임계값 도달 (예: 10회 상호작용)
- 비동기 실행으로 응답 지연 없음

**효과**: 전체 히스토리 보존하면서도 활성 컨텍스트는 압축

### 4. 고급 기법: RAPTOR[[3]](#ref-3)[[21]](#ref-21)[[24]](#ref-24)

**문제**: 긴 문서는 청크로 나누면 맥락 손실

**RAPTOR 접근법**[[21]](#ref-21)[[24]](#ref-24):
```
Level 0: [청크1][청크2][청크3][청크4][청크5][청크6]
           ↓ 클러스터링 + 요약
Level 1:   [요약A(1,2,3)][요약B(4,5,6)]
           ↓ 재귀적 요약
Level 2:      [전체 요약]
```

**검색 시**:
- 고수준 질문 → Level 1-2 요약 검색
- 상세 질문 → Level 0 청크 검색

**성능**: GPT-4 + RAPTOR로 QuALITY 벤치마크에서 **20% 절대 정확도 향상**[[3]](#ref-3)[[21]](#ref-21)[[24]](#ref-24)

### 5. Context-DB 패턴: Git-Context-Controller[[15]](#ref-15)

**핵심 아이디어**: 컨텍스트를 버전 관리하듯이 관리[[15]](#ref-15)

**명령어**:
- `COMMIT`: 마일스톤 체크포인트
- `BRANCH`: 대안 탐색
- `MERGE`: 다른 추론 경로 통합
- `CONTEXT`: 다양한 추상화 수준에서 정보 검색

**장점**:
- 장기 목표 유지
- 아키텍처 실험 격리
- 세션 간 메모리 복구
- 에이전트 간 핸드오프

**사용 사례**:
```bash
# 현재 상태 저장
COMMIT "Implemented auth middleware"

# 대안 탐색
BRANCH "experiment/oauth2"
# ... 실험 ...

# 성공 시 병합
MERGE "experiment/oauth2" into "main"

# 실패 시 버리기
CHECKOUT "main"
```

---

## 활용 가이드: Claude Code에서 Codex 활용하기

Codex와의 인터뷰를 통해 얻은 활용 패턴을 정리합니다.

### Operating Model

```
Claude Code (200k)
├─ 역할: 조정자, 의사결정자, 압축기
├─ 강점: 빠른 반복, 사용자와의 대화, 최종 결정
└─ 약점: 제한된 컨텍스트

Codex/Gemini (400k-1M)
├─ 역할: 넓은 컨텍스트 리더, 무거운 분석기
├─ 강점: 대규모 코드베이스 탐색, 장문 추론
└─ 약점: 사용자와 직접 상호작용 없음
```

**원칙**: 결과를 압축된 artifact로 변환할 수 있을 때만 위임

### 즉시 사용 가능한 프롬프트 템플릿

#### Template 1: 코드베이스 탐색

```bash
codex exec --skip-git-repo-check "You are tasked with mapping relevant files for [PROBLEM].

Scan: [PATHS/DIRS]

Output format (strict):
- File path | purpose | relevance (H/M/L)

Max 12 lines. No prose."
```

#### Template 2: 코드 리뷰

```bash
codex exec --skip-git-repo-check "Review for risks in [COMPONENT].

Codebase: [PATH]

Output:
1) Critical issues (<=5 bullets, each with file path)
2) Likely regressions (<=5 bullets)
3) Missing tests (<=5 bullets)

No quotes, no long reasoning."
```

#### Template 3: 결정 분석

```bash
codex exec --skip-git-repo-check "Analyze options for [DECISION].

Context: [BRIEF CONTEXT]

Output:
- Option table with columns: Option, Pros, Cons, Risk, Effort
- Recommendation (<=50 words)"
```

#### Template 4: 리서치 요약

```bash
codex exec --skip-git-repo-check --full-auto "Summarize [TOPIC] with citations.

Focus on 2024-2025 sources.

Output:
- 5 bullets: claim + source
- 3 risks
- 3 action items

No long excerpts."
```

### 압축 메서드

#### Method A: Bulletizer
```markdown
BEFORE (Codex output, 2000 tokens):
"The authentication system is implemented across multiple files.
The session.ts file contains the core JWT parsing logic, which
extracts the token from the request header and validates it..."

AFTER (Claude summary, 150 tokens):
FILE MAP
- src/auth/session.ts — JWT 토큰 파싱 (H)
- src/auth/middleware.ts — 요청 검증 (H)
- src/user/profile.ts — 프로필 접근 (M)

DECISION
- session.ts 집중 수정
```

#### Method B: Delta Log
**원칙**: 결정이나 행동 계획을 바꾼 것만 유지

```markdown
KEEP:
- "Option B가 최선" → 결정 변경
- "session.ts 버그 발견" → 새로운 정보

DISCARD:
- "다양한 접근법을 고려했고..." → 추론 과정
- "JWT는 JSON Web Token의 약자로..." → 배경 지식
```

#### Method C: Minimal Map
**원칙**: 파일 경로 5-10개 max

```markdown
FOCUSED MAP (good):
- /src/auth/session.ts
- /src/auth/middleware.ts
- /src/user/profile.ts

BLOATED MAP (bad):
- /src/auth/session.ts
- /src/auth/types.ts
- /src/auth/utils.ts
- /src/auth/constants.ts
- /src/auth/middleware.ts
... (15 more files)
```

### Context Budget 관리

#### 실시간 추적

```markdown
=== CONTEXT LEDGER ===
Current Usage: 87k / 200k (43%)

Breakdown:
- System: 3k
- Tools: 35k
- Memory: 3k
- Conversation: 12k
- Artifacts:
  - File map: 0.15k
  - Decision matrix: 0.12k
  - Risk list: 0.08k
  - Code snippets: 8k

Available: 113k (57%)
```

#### 정리 규칙

**Trigger**: 사용량 > 70% (140k)

**Action**:
1. 대화 히스토리 압축 (12k → 3k)
2. 오래된 artifacts 제거
3. 코드 스니펫을 파일 경로로 대체

### 워크플로우 예시

#### 시나리오: 대규모 리팩토링

```markdown
# Step 1: Codex에게 탐색 위임
$ codex exec --skip-git-repo-check "Map all files related to authentication in /src.
Output: file path | purpose | complexity (H/M/L)
Max 15 files."

# Step 2: 결과 압축 (5k → 300 tokens)
FILE MAP
- /src/auth/session.ts — JWT 파싱 (H)
- /src/auth/middleware.ts — 요청 검증 (H)
- /src/auth/types.ts — 타입 정의 (L)
...

# Step 3: Claude가 상세 분석할 파일만 읽기
$ read /src/auth/session.ts
$ read /src/auth/middleware.ts

# Step 4: 리팩토링 계획 수립 (Claude)
PLAN
1. session.ts에 RefreshToken 로직 추가
2. middleware.ts에 role-based 검증 추가

# Step 5: 구현 (Claude)
# Step 6: Codex에게 영향 분석 위임
$ codex exec --skip-git-repo-check "Analyze impact of changes in session.ts on entire codebase.
Output: affected files + migration steps"

# Step 7: 압축 및 최종 검토
```

**총 컨텍스트 사용**:
- Codex 탐색: 80k (Claude 컨텍스트에는 300 tokens만 유지)
- 실제 파일 읽기: 15k
- 대화 + 구현: 30k
- **합계: ~45k (일반적인 방식이면 120k+)**

---

## 베스트 프랙티스와 안티패턴

### Best Practices

#### 1. 구조 강제 (Force Structure)
```bash
# GOOD
codex exec --skip-git-repo-check "Output format (strict):
- Decision: [decision]
- Reason: [reason]
- File: [path]

Max 5 lines."

# BAD
codex exec --skip-git-repo-check "What do you think about this approach?"
```

#### 2. 경로 앵커 (Path Anchors)
```markdown
# GOOD
FINDING: 인증 버그 발견
FILE: /src/auth/session.ts:45
REASON: exp 검증 누락

# BAD
FINDING: 인증 관련 코드에서 버그를 발견했습니다.
REASON: 토큰 만료 시간을 제대로 확인하지 않고 있습니다.
```

#### 3. 단일 라운드 위임 (Single-Round Delegation)
```bash
# GOOD: 한 번에 충분한 정보 제공
codex exec --skip-git-repo-check "Analyze auth system for security issues.
Codebase: /src/auth
Consider: OWASP Top 10, JWT best practices
Output: vulnerabilities + fixes + priority"

# BAD: 여러 번 왔다갔다
codex exec --skip-git-repo-check "What files are in /src/auth?"
# ... response ...
codex exec --skip-git-repo-check "Are there security issues?"
# ... response ...
codex exec --skip-git-repo-check "How to fix them?"
```

#### 4. 즉시 압축 (Compress Immediately)
```typescript
// Codex 응답 받는 즉시 압축
const codexResponse = await executeCodex(prompt);

// BAD: 전체 응답 저장
context.codexResults.push(codexResponse); // 5k tokens

// GOOD: 압축 후 저장
const summary = compressToDecisionMatrix(codexResponse); // 150 tokens
context.decisions.push(summary);
```

#### 5. 델타만 유지 (Preserve Only Deltas)
```markdown
# KEEP (결정을 바꿈)
- "OAuth2 대신 JWT 사용" → 아키텍처 변경

# DISCARD (이미 알고 있음)
- "JWT는 stateless" → 일반 지식
```

### Anti-Patterns

#### ❌ Anti-Pattern 1: 날것의 응답 복사
```markdown
BAD:
[Codex 응답 전체를 Claude 컨텍스트에 복사]
"The authentication system employs a sophisticated
multi-layered approach... [3000 words]"
```

#### ❌ Anti-Pattern 2: 사소한 작업 위임
```markdown
BAD:
$ codex exec --skip-git-repo-check "What is JWT?"

GOOD:
[Claude가 직접 답변 또는 웹 검색]
```

#### ❌ Anti-Pattern 3: Stream of Consciousness
```markdown
BAD (Codex에게 요청):
"Think deeply about the authentication system and
explore various possibilities..."

GOOD (구조화된 출력 요구):
"Output:
- Current approach: [1 line]
- Issues: [max 3 bullets]
- Recommendation: [1 line]"
```

#### ❌ Anti-Pattern 4: 중복 요약 유지
```markdown
BAD:
- Summary 1 (from Codex): "Auth uses JWT..."
- Summary 2 (from Gemini): "Authentication via JWT..."
- Summary 3 (Claude's own): "The auth system uses JWT..."

GOOD:
- AUTH SYSTEM: JWT-based, session.ts, exp validation bug
```

#### ❌ Anti-Pattern 5: Why 손실
```markdown
BAD:
DECISION: Option B 선택

GOOD:
DECISION: Option B 선택
REASON: 확장성(Option C)보다 빠른 출시(Option B)가 우선순위
```

---

## MCP 서버: 컨텍스트 관리의 운영 레이어

지금까지 살펴본 멀티 에이전트 위임과 컨텍스트 외부화 전략을 실제로 구현하려면, **Model Context Protocol (MCP)** 서버가 핵심 인프라가 됩니다. MCP는 AI 모델과 외부 리소스 간의 통신을 표준화하는 프로토콜로, "USB-C for AI"라고 불립니다[[50]](#ref-50).

### MCP란 무엇인가?

MCP는 Anthropic이 2024년 11월에 발표한 오픈 프로토콜로, AI 모델이 외부 도구, 데이터베이스, 파일 시스템과 안전하게 상호작용할 수 있게 합니다[[50]](#ref-50)[[51]](#ref-51).

**MCP의 구성 요소**:
```
┌─────────────────────────────────────────┐
│  Host (Claude Code, Claude Desktop)    │
│           ↓                             │
│  Client (연결 관리)                      │
│           ↓                             │
│  Server (도구/리소스 제공)               │
│   ├─ Resources (파일, DB 쿼리)          │
│   ├─ Tools (함수 실행)                  │
│   └─ Prompts (사전 정의된 템플릿)        │
└─────────────────────────────────────────┘
```

**Transport Layer**:
- **Stdio**: 로컬 프로세스 간 통신
- **HTTP with SSE**: 웹 서비스용
- **Custom**: 특수한 배포 환경용

### 컨텍스트 최적화를 위한 Top 5 MCP 서버

#### 1. Memory Keeper (mkreyman/mcp-memory-keeper)[[52]](#ref-52)

**목적**: 세션 간 지속 메모리 + 체크포인트 시스템

**핵심 기능**:
- 대화 컨텍스트를 SQLite에 영구 저장
- 채널 기반 컨텍스트 분리 (git branch에서 자동 파생)
- 체크포인트로 상태 스냅샷 생성
- 압축 기능으로 오래된 컨텍스트 정리

**사용 예시**:
```javascript
// 컨텍스트 저장
mcp_context_save({
  key: 'architecture_decision',
  value: 'JWT 기반 인증 채택, 세션보다 상태리스 선호',
  category: 'decision',
  priority: 'high',
});

// 컨텍스트 윈도우가 차기 전에 체크포인트 생성
mcp_context_prepare_compaction();

// 새 세션에서 복원
mcp_context_get({ category: 'decision', priority: 'high' });
```

**컨텍스트 절약 효과**:
- 대화 히스토리 대신 압축된 결정사항만 유지
- 체크포인트 복원으로 50k 토큰 → 5k 토큰 재진입 가능

**최적 사용 케이스**:
- 장기 프로젝트에서 세션 간 컨텍스트 유지
- 복잡한 리팩토링 작업의 상태 보존
- 팀 협업에서 공유 메모리 활용

#### 2. Official Memory MCP (@modelcontextprotocol/server-memory)[[53]](#ref-53)

**목적**: 지식 그래프 기반 영구 메모리 시스템

**핵심 기능**:
- 엔티티-관계 중심의 구조화된 저장
- 의미론적 검색 (키워드 + 시맨틱)
- 엔티티 간 관계 추적

**아키텍처**:
```
┌─────────────────────────────────────────┐
│  Knowledge Graph                        │
│   [User: Alice] ──관계── [Project: Auth]│
│       │                      │          │
│   [선호: TypeScript]    [결정: JWT]     │
│                              │          │
│                      [파일: session.ts] │
└─────────────────────────────────────────┘
```

**사용 예시**:
```javascript
// 엔티티 저장
mcp_memory_store({
  entity: 'auth_system',
  attributes: {
    type: 'JWT',
    files: ['src/auth/session.ts', 'src/auth/middleware.ts'],
    status: 'in_progress'
  },
  relations: [
    { target: 'user_module', type: 'depends_on' }
  ]
});

// 관계 기반 검색
mcp_memory_search_nodes('auth');
```

**최적 사용 케이스**:
- 복잡한 시스템의 구성요소 간 관계 추적
- 사용자 선호도/패턴 장기 기억
- 프로젝트 전체 지식 베이스 구축

#### 3. Sequential Thinking MCP[[54]](#ref-54)

**목적**: 구조화된 단계별 문제 해결

**핵심 기능**:
- 복잡한 작업을 논리적 단계로 분해
- 각 단계의 추론 과정을 명시적으로 기록
- 대규모 리팩토링/설계에서 일관성 유지

**컨텍스트 효율 기여**:
```
일반적인 접근 (Context-Heavy):
"다양한 접근법을 검토했습니다. 첫 번째로..."
→ 긴 추론 과정이 컨텍스트를 채움

Sequential Thinking (Context-Efficient):
STEP 1: 요구사항 분석 → 완료
STEP 2: 옵션 평가 → Option B 선택
STEP 3: 구현 계획 → 파일 3개 수정 필요
→ 결론과 결정만 남음
```

**최적 사용 케이스**:
- 아키텍처 설계 결정
- 복잡한 버그 디버깅
- 다단계 리팩토링 계획

#### 4. Filesystem MCP[[55]](#ref-55)

**목적**: 파일 시스템 접근 최적화

**핵심 기능**:
- 필요한 파일만 선택적 로딩
- 디렉토리 구조 메타데이터 제공
- 보안 접근 제어

**컨텍스트 효율 전략**:
```markdown
BAD: 전체 파일 로딩
$ read /src/auth/*.ts
→ 50k 토큰 소모

GOOD: 메타데이터 먼저, 필요한 것만
$ ls /src/auth/
→ 파일 목록 (100 토큰)
$ read /src/auth/session.ts:1-50
→ 관련 부분만 (500 토큰)
```

#### 5. Search/Index MCP (Exa, Brave Search 등)[[56]](#ref-56)

**목적**: 외부 지식의 효율적 검색

**컨텍스트 절약 효과**:
- 전체 문서 대신 요약/스니펫만 반환
- 관련성 기반 필터링으로 노이즈 제거

### MCP 토큰 오버헤드 관리

MCP 서버의 큰 문제점: **도구 정의 자체가 토큰을 소모**합니다[[57]](#ref-57).

**실제 오버헤드 측정**:
```markdown
MCP 서버 구성              | 토큰 소모
--------------------------|----------
시스템 프롬프트            | ~3k
MCP 도구 정의              | ~35k
메모리 파일 (CLAUDE.md)    | ~3k
--------------------------|----------
실제 작업 가능 컨텍스트    | ~160k / 200k
```

**해결 전략**:

#### 1. 런타임 MCP 토글[[57]](#ref-57)
```bash
# Claude Code 2.0.10+에서 지원
/mcp toggle memory-keeper off
/mcp toggle sequential-thinking on
```

#### 2. 지연 로딩 패턴
```markdown
# CLAUDE.md에 명시
MCP 로딩 규칙:
- AWS MCP: 클라우드 배포 작업 시에만 로드
- Memory Keeper: 장기 프로젝트에서만 로드
- 기본: Filesystem + Git만 활성화
```

#### 3. 프로젝트별 MCP 프로필
```json
// .mcp.json (프로젝트 루트)
{
  "mcpServers": {
    "memory-keeper": {
      "command": "npx",
      "args": ["mcp-memory-keeper"],
      "autoload": false  // 수동 활성화
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./src"],
      "autoload": true
    }
  }
}
```

---

## CLAUDE.md: 토큰 효율적인 설정 가이드

CLAUDE.md는 Claude Code에서 프로젝트별 지침을 제공하는 핵심 파일입니다. 하지만 잘못 작성하면 **매 대화마다 수천 토큰을 낭비**하게 됩니다.

### CLAUDE.md의 계층 구조

```
~/.claude/CLAUDE.md          # 사용자 전역 설정
./CLAUDE.md                  # 프로젝트 루트 설정
./src/CLAUDE.md              # 서브디렉토리 설정 (선택)
```

**우선순위**: 하위 디렉토리 > 프로젝트 루트 > 사용자 전역

### 토큰 효율을 위한 베스트 프랙티스

#### 원칙 1: 역할/목표만 남기고 배경은 외부화

```markdown
# BAD (토큰 낭비)
# 프로젝트 배경
이 프로젝트는 2023년에 시작되었으며, 전자상거래 플랫폼입니다.
React 18과 TypeScript 5.0을 사용합니다.
팀은 5명으로 구성되어 있고, 애자일 방법론을 따릅니다.
(계속해서 500 토큰의 배경 설명...)

# GOOD (토큰 효율)
# 역할
TypeScript + React 전자상거래 프로젝트의 시니어 개발자

# 배경
상세 배경: docs/CONTEXT.md 참조
```

#### 원칙 2: 단기 지시 vs 장기 원칙 분리

```markdown
# BAD: 모든 것을 CLAUDE.md에
- 오늘 작업할 때 console.log 추가하기
- API 응답 형식 변경하기
- 테스트 커버리지 높이기

# GOOD: 변하지 않는 원칙만
# 코드 품질
- any 타입 금지
- 컴포넌트는 함수형으로
- 테스트 필수: 새 기능마다 단위 테스트

# 변경 가능한 지시는 대화에서 직접 전달
```

#### 원칙 3: 압축된 정보 우선

```markdown
# BAD: 장황한 설명
파일 구조에 대해 설명하겠습니다. src 폴더 안에는
components 폴더가 있고, 그 안에 공통 컴포넌트들이...

# GOOD: 경로 앵커
# 파일 구조
- src/components/common/ — 공통 컴포넌트
- src/hooks/ — 커스텀 훅
- src/api/ — API 클라이언트
```

#### 원칙 4: 컨텍스트 관리 규칙 명시

```markdown
# 컨텍스트 관리
- 대화 70% 시점에서 /compact 실행
- 중요 결정은 Memory Keeper에 저장
- 파일 전체 로딩 대신 필요한 부분만 요청
- 요약이 가능하면 요약 먼저 제안
```

### CLAUDE.md 안티패턴

#### ❌ 안티패턴 1: 장문의 배경 설명
```markdown
# 프로젝트 히스토리
2023년 1월에 프로젝트가 시작되었습니다. 처음에는
Vue.js를 사용했지만, 팀 역량을 고려하여 React로
마이그레이션했습니다. 이 과정에서 많은 기술적 부채가...
(500+ 토큰, 실제로 참조되는 경우 거의 없음)
```

#### ❌ 안티패턴 2: 의미 중복 규칙
```markdown
- 코드는 간결하게 작성하세요
- 불필요한 코드는 작성하지 마세요
- 심플하게 유지하세요
- 복잡한 코드는 피하세요
(같은 말을 4번 반복 = 토큰 낭비)
```

#### ❌ 안티패턴 3: 추상적인 지침
```markdown
- 더 깊이 생각하세요
- 최선을 다하세요
- 품질을 중시하세요
(실행 불가능한 지침은 제거)
```

#### ❌ 안티패턴 4: 워크플로우 과잉 서술
```markdown
# 개발 워크플로우
1. 먼저 요구사항을 분석합니다
2. 그 다음 설계를 합니다
3. 코드를 작성합니다
4. 테스트를 실행합니다
5. 코드 리뷰를 요청합니다
(일반적인 워크플로우는 LLM이 이미 알고 있음)
```

### 추천 CLAUDE.md 템플릿 (토큰 최적화형)

```markdown
# 역할
TypeScript/Node.js 시니어 개발자 - [프로젝트명]

# 핵심 원칙
- any 타입 절대 금지, unknown 사용 후 타입 가드
- 기존 코드 패턴 따르기
- 테스트: #given, #when, #then 패턴

# 컨텍스트 소스
- 아키텍처: docs/ARCHITECTURE.md
- API 명세: docs/API.md
- 용어집: docs/GLOSSARY.md

# 도구 사용
- 파일 전체 대신 필요한 부분만 로딩
- 70% 컨텍스트에서 /compact
- 중요 결정은 Memory Keeper 저장

# 출력 스타일
- 한국어 응답
- 파일 경로 포함: src/auth/session.ts:45
- 결정 시 이유 명시
```

**토큰 사용량**: ~200 토큰 (일반적인 CLAUDE.md의 1/5)

---

## MCP + CLAUDE.md + 멀티에이전트 통합 패턴

세 가지 요소를 함께 활용하면 컨텍스트 효율이 극대화됩니다.

### 통합 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│  CLAUDE.md (영구 원칙 레이어)                            │
│  - 코드 스타일, 품질 기준                                │
│  - 외부 문서 참조 경로                                   │
│  - 컨텍스트 관리 규칙                                    │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Claude Code (오케스트레이터)                            │
│  - CLAUDE.md 원칙 준수                                   │
│  - MCP로 외부 정보 조회                                  │
│  - 워커에게 작업 위임                                    │
└─────┬───────────────────────────────────────┬───────────┘
      │                                       │
┌─────▼─────────────────┐   ┌─────────────────▼───────────┐
│  Memory Keeper MCP    │   │  Codex/Gemini (워커)        │
│  - 결정사항 저장       │   │  - 대규모 탐색              │
│  - 세션 간 상태 유지   │   │  - 장문 분석                │
│  - 체크포인트 관리     │   │  - 결과 압축 후 반환        │
└───────────────────────┘   └─────────────────────────────┘
```

### 실전 워크플로우 예시

#### 시나리오: 대규모 코드베이스 리팩토링

```markdown
# Step 1: CLAUDE.md에서 원칙 확인
원칙: "any 타입 금지, 기존 패턴 따르기"

# Step 2: Codex에게 탐색 위임
$ codex exec --skip-git-repo-check "Map all files with 'any' type in /src.
Output: file path | line | current type
Max 20 files."

# Step 3: 결과 압축 (Codex: 30k → Claude: 400 토큰)
TYPE_DEBT_MAP
- /src/api/client.ts:45 — response: any
- /src/utils/parser.ts:23 — data: any
- /src/hooks/useApi.ts:12 — error: any

# Step 4: Memory Keeper에 저장
mcp_context_save({
  key: 'type_debt_list',
  value: 'any 타입 3개 위치 확인 완료',
  category: 'task',
  priority: 'high'
});

# Step 5: 각 파일 수정 (Claude)
# 필요한 부분만 읽고 수정

# Step 6: 체크포인트 생성 (컨텍스트 70% 도달 전)
mcp_context_prepare_compaction();

# Step 7: 새 세션에서 재개
mcp_context_get({ key: 'type_debt_list' });
→ "any 타입 3개 중 1개 완료, 2개 남음"
```

### 토큰 효율 비교

| 접근 방식 | 토큰 사용량 | 설명 |
|----------|------------|------|
| 일반적인 방식 | 150k+ | 전체 파일 로딩, 긴 대화 히스토리 |
| CLAUDE.md만 사용 | 100k | 원칙 명시로 반복 설명 감소 |
| MCP 추가 | 70k | 외부 메모리로 히스토리 오프로드 |
| + 멀티에이전트 | 45k | 탐색 작업 위임, 결과만 압축 유지 |

**효과**: 일반적인 방식 대비 **70% 토큰 절감**

### 체크리스트: 통합 설정

#### CLAUDE.md 체크리스트
- [ ] 200 토큰 이내로 유지
- [ ] 외부 문서 참조 경로 명시
- [ ] 컨텍스트 관리 규칙 포함
- [ ] 추상적 지침 제거

#### MCP 체크리스트
- [ ] 프로젝트에 필요한 MCP만 활성화
- [ ] autoload: false로 지연 로딩 설정
- [ ] Memory Keeper로 세션 간 상태 유지
- [ ] 토큰 오버헤드 모니터링

#### 위임 체크리스트
- [ ] 10k+ 토큰 작업은 Codex/Gemini에 위임
- [ ] 결과는 200 토큰 이내로 압축
- [ ] 결정사항은 Memory Keeper에 저장
- [ ] 70% 컨텍스트에서 정리 실행

---

## 실제 구현: Claude Code 컨텍스트 최적화 설정

지금까지 설명한 이론을 실제로 적용한 설정을 공개합니다. 이 설정은 Claude Code의 200k 컨텍스트를 효율적으로 관리하기 위해 **Codex 위임, notepad.md 자동화, MCP 통합**을 구현합니다.

### 아키텍처 개요

```
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

**핵심 철학**: Claude는 직접 일하지 않고 **시킨다**. 탐색은 Codex, 기억은 notepad.md, 장기 저장은 MCP, 실행은 executor 에이전트.

### 디렉토리 구조

```
~/.claude/
├── CLAUDE.md              # 자동화 규칙 (~500 tokens)
├── agents/
│   ├── executor.md        # 단일 작업 실행 (haiku 모델)
│   └── plan-reviewer.md   # 플랜 검증
├── commands/
│   ├── planner.md         # 플랜 생성
│   ├── execute.md         # 오케스트레이터
│   ├── review-plan.md     # 플랜 검토
│   ├── delegate-codex.md  # Codex 수동 위임
│   ├── save-context.md    # MCP 체크포인트
└── templates/
    ├── ai-todolist.md     # 플랜 템플릿
    └── notepad.md         # 학습 기록 템플릿
```

### 핵심 구성요소

#### 1. CLAUDE.md: 자동 위임 규칙

```markdown
# AUTO-DELEGATE TO CODEX (MANDATORY)

**Trigger conditions - delegate IMMEDIATELY when:**
- 5개 파일 이상 검색 필요 → `codex exec --skip-git-repo-check 'Think deeply. [사용 목적 및 전체 컨텍스트]'`
- 낯선 코드베이스 구조 파악 → `codex exec --skip-git-repo-check 'Think deeply. [해당 시스템/모듈 설명 및 전체 맥락]'`
- 200줄 초과 코드 분석 → `codex exec --skip-git-repo-check 'Think deeply. [분석할 코드/모듈 설명 및 전체 맥락]'`
- 리서치/최신 자료 조사 → `codex exec --skip-git-repo-check 'Think deeply. [조사 주제 및 전체 컨텍스트]'`
- 1만 토큰 초과 예상되는 탐색/분석 → `codex exec --skip-git-repo-check 'Think deeply. [작업 상세 및 전체 컨텍스트]'`

**Execution:**

codex exec --skip-git-repo-check "Think deeply. [YOUR TASK]. Provide compressed summary ≤200 tokens."

**YOU MUST compress Codex results to ≤200 tokens before using.**
```

**효과**: Claude가 자동으로 Codex에 위임하고 결과를 압축. 50k 토큰 탐색 → 200 토큰 요약.

#### 2. notepad.md: 자동 학습 기록

```markdown
# AUTO-RECORD TO notepad.md (MANDATORY)

**After EVERY task completion, APPEND to notepad.md:**
[YYYY-MM-DD HH:MM] Task: [name]
- DECISION: [why you chose this approach]
- LEARNED: [project-specific discovery]
- GOTCHA: [traps to avoid]
```

**예시 기록**:
```markdown
[2025-12-24 12:00] Task: JWT 인증 구현
- DECISION: refresh token은 httpOnly cookie 사용
- LEARNED: 이 프로젝트는 cookie-parser 미들웨어 필수
- GOTCHA: .env에 JWT_SECRET 없으면 silent fail
```

#### 3. executor 에이전트: 단일 작업 실행

```yaml
name: executor
model: haiku  # 비용 효율
tools: Read, Write, Edit, Bash(*), Grep, Glob, LS
```

**핵심 규칙**:
- **ONE TASK ONLY**: 정확히 하나의 체크박스만 실행
- **TEST UNTIL PASS**: 테스트 통과 전까지 미완료
- **DOCUMENT EVERYTHING**: notepad.md에 필수 기록
- **STAY IN LANE**: 범위 이탈 금지

#### 4. planner 명령어: 계획 생성

```bash
/planner "사용자 인증에 JWT 추가" --review --parallelable
```

**생성되는 ai-todolist.md**:
```markdown
---
original_request: "사용자 인증에 JWT 추가"
goals: [JWT 기반 인증 구현, 세션 관리]
execution_started: false
---

# Work Plan: JWT 인증 구현

## Context
- **Key files**: src/auth/session.ts, src/middleware/auth.ts
- **Patterns**: 기존 미들웨어 패턴 따르기

## Tasks

### Task 1: JWT 토큰 생성
**Status:** pending
- [ ] **1.1** jsonwebtoken 의존성 추가 → package.json
- [ ] **1.2** 토큰 생성 함수 구현 → src/auth/jwt.ts

#### Acceptance Criteria
- [ ] 토큰 생성/검증 테스트 통과
- [ ] Tests pass: `npm test -- --grep "jwt"`
```

### 워크플로우 예시

#### 일반적인 작업 흐름

```bash
# 1. 플랜 생성
/planner "사용자 인증에 JWT 추가"
# → Claude가 코드베이스 분석 (큰 탐색은 Codex 위임)
# → ai-todolist.md 생성

# 2. 플랜 검토 (선택)
/review-plan
# → "APPROVED ✅" 또는 수정사항 제안

# 3. 실행 (하나씩)
/execute
# → executor 에이전트가 Task 1 실행
# → notepad.md에 학습 기록
# → "✅ Task 1 완료. 다음 작업 진행할까요?"

# 4. 반복
/execute
# → Task 2 실행...
```

#### 컨텍스트 경고 처리

```
[50% 도달]
Claude: "CHECKPOINT: 현재 인증 구현 중, 토큰 생성 완료"
       → notepad.md에 자동 저장

[70% 도달]
Claude: "⚠️ 컨텍스트 70% 도달. /compact 권장합니다."

# 새 세션에서 이어서
Claude: (notepad.md 자동 읽음)
        "이전 작업 내용 확인했습니다. Task 3부터 이어갑니다."
```

### MCP 통합: memory-keeper & memory-kg

#### memory-keeper (세션 체크포인트)

```javascript
// 작업 완료 시 자동 저장
mcp_context_save({
  key: 'task-jwt-implementation',
  value: 'JWT 토큰 생성 완료, 검증 로직 진행 중',
  category: 'progress',
  priority: 'high',
  channel: 'auth-feature'
});

// 새 세션에서 복원
mcp_context_get({ category: 'progress', priority: 'high' });
```

#### memory-kg (영구 지식)

```javascript
// 프로젝트 컨벤션 저장
mcp_memory_kg_create_entities([{
  name: 'auth-pattern',
  entityType: 'convention',
  observations: [
    'JWT 토큰은 httpOnly cookie로 저장',
    'refresh token rotation 패턴 사용',
    'src/auth/ 디렉토리에 인증 로직 집중'
  ]
}]);

// 나중에 검색
mcp_memory_kg_search_nodes('auth');
```

### 토큰 절약 효과

| 항목 | 이전 | 현재 | 절약 |
|------|------|------|------|
| 직접 5파일 검색 | ~15k tokens | cx 결과 200 tokens | **98%** |
| CLAUDE.md | 2.9k tokens | 500 tokens | **83%** |
| MCP 상시 로딩 | 35k tokens | 0 (필요시만) | **100%** |
| 실수 반복 | 매번 새로 | notepad.md 참조 | **∞** |
| 세션 간 컨텍스트 | 손실 | MCP 복원 | **∞** |

**총 효과**: 일반적인 작업에서 **70% 이상 토큰 절감**, 세션 간 지식 유지로 재작업 방지.

### 설치 및 사용

```bash
# 저장소 클론
git clone https://github.com/[repo]/result-claude-setting
cd result-claude-setting

# 설치 (CLAUDE.md, commands, agents를 ~/.claude/에 복사)
./install.sh

# Claude Code에서 사용
/planner "작업 설명"
/execute
```

**GitHub 저장소**: [result-claude-setting](https://github.com/[repo]/result-claude-setting)

---

## 결론: 컨텍스트 엔지니어링의 미래

### 핵심 인사이트 요약

#### 1. 컨텍스트는 RAM이다
- 비싸고 제한적인 자원
- 현재 작업에 필요한 것만 유지
- 나머지는 외부 메모리로

#### 2. 위임은 전략이다
- Codex/Gemini의 큰 컨텍스트 활용
- **3x 압축 규칙**: 50k 입력 → ≤15k 출력
- 결과를 구조화된 artifact로 변환

#### 3. 압축은 예술이다
- Bulletizer: 문단 → 한 줄
- Delta Log: 변경사항만
- Minimal Map: 핵심 경로만

#### 4. 외부화는 필수다
- Vector DB: 의미 검색
- Graph DB: 관계 추론
- Hybrid: 최상의 성능

### 활용 체크리스트

#### 위임 전
- [ ] 입력 크기 > 10k 토큰?
- [ ] 출력을 ≤200 토큰으로 압축 가능?
- [ ] 탐색/분석/추론 작업?
- [ ] 구조화된 출력 포맷 정의됨?

#### 위임 중
- [ ] 명확한 목표 제시
- [ ] 엄격한 출력 형식 요구
- [ ] 경로/소스 앵커 요구
- [ ] 최대 길이 제한 명시

#### 위임 후
- [ ] 즉시 압축
- [ ] 델타만 유지
- [ ] 컨텍스트 장부 업데이트
- [ ] 70% 초과 시 정리

---

## 참고 문헌

### Academic Papers (2024-2025)

<a id="ref-1"></a>**[1]** Chroma Research (2024): "Context Rot: The Emerging Challenge for LLMs" - [https://research.trychroma.com/context-rot](https://research.trychroma.com/context-rot)

<a id="ref-2"></a>**[2]** Confluent (2024): "Event-Driven Multi-Agent Systems" - [https://www.confluent.io/blog/event-driven-multi-agent-systems/](https://www.confluent.io/blog/event-driven-multi-agent-systems/)

<a id="ref-3"></a>**[3]** Microsoft Research (2024): "LLMLingua-2: Data Distillation for Efficient Prompt Compression" - [arXiv:2403.12968](https://arxiv.org/abs/2403.12968)

<a id="ref-4"></a>**[4]** Google Research (2024): "CodeAgents: Structured Prompting for Multi-Agent Systems" - [arXiv:2507.03254](https://arxiv.org/abs/2507.03254)

<a id="ref-5"></a>**[5]** Understanding AI (2024): "Context Rot: The Emerging Challenge" - [https://www.understandingai.org/p/context-rot-the-emerging-challenge](https://www.understandingai.org/p/context-rot-the-emerging-challenge)

<a id="ref-6"></a>**[6]** Google Developers (2024): "Multi-Agent Patterns in ADK" - [https://developers.googleblog.com/en/developers-guide-to-multi-agent-patterns-in-adk/](https://developers.googleblog.com/en/developers-guide-to-multi-agent-patterns-in-adk/)

<a id="ref-7"></a>**[7]** arXiv (2025): "MemOS: Unified Memory Operating System" - [arXiv:2505.22101](https://arxiv.org/pdf/2505.22101.pdf)

<a id="ref-8"></a>**[8]** Anthropic (2024): "Effective Context Engineering for AI Agents" - [https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

<a id="ref-9"></a>**[9]** DataCamp (2024): "How Does LLM Memory Work" - [https://www.datacamp.com/blog/how-does-llm-memory-work](https://www.datacamp.com/blog/how-does-llm-memory-work)

<a id="ref-10"></a>**[10]** Anthropic Engineering (2024): "Context Engineering Best Practices" - [https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

<a id="ref-11"></a>**[11]** Towards AI (2024): "GraphRAG with Neo4j and LangChain" - [https://pub.towardsai.net/graphrag-explained-building-knowledge-grounded-llm-systems-with-neo4j-and-langchain-017a1820763e](https://pub.towardsai.net/graphrag-explained-building-knowledge-grounded-llm-systems-with-neo4j-and-langchain-017a1820763e)

<a id="ref-12"></a>**[12]** Serokell (2024): "Design Patterns for Long-Term Memory in LLM Architectures" - [https://serokell.io/blog/design-patterns-for-long-term-memory-in-llm-powered-architectures](https://serokell.io/blog/design-patterns-for-long-term-memory-in-llm-powered-architectures)

<a id="ref-13"></a>**[13]** Inkeep (2024): "Fighting Context Rot" - [https://inkeep.com/blog/fighting-context-rot](https://inkeep.com/blog/fighting-context-rot)

<a id="ref-14"></a>**[14]** LangChain (2024): "LangMem: Memory for Agents" - [https://langchain-ai.github.io/langmem/](https://langchain-ai.github.io/langmem/)

<a id="ref-15"></a>**[15]** MIT (2024): "Git-Context-Controller: Version Control for LLM Context" - [arXiv:2508.00031](https://arxiv.org/abs/2508.00031)

<a id="ref-16"></a>**[16]** EMNLP (2024): "In-Context Former: Context Compression" - [ACL Anthology](https://aclanthology.org/2024.findings-emnlp.138.pdf)

<a id="ref-18"></a>**[18]** Google Developers (2024): "Architecting Efficient Context-Aware Multi-Agent Framework" - [https://developers.googleblog.com/en/architecting-efficient-context-aware-multi-agent-framework-for-production/](https://developers.googleblog.com/en/architecting-efficient-context-aware-multi-agent-framework-for-production/)

<a id="ref-20"></a>**[20]** DataCamp (2024): "LLM Memory Architecture" - [https://www.datacamp.com/blog/how-does-llm-memory-work](https://www.datacamp.com/blog/how-does-llm-memory-work)

<a id="ref-21"></a>**[21]** arXiv (2024): "RAPTOR: Recursive Abstractive Processing" - [arXiv:2401.18059](https://arxiv.org/abs/2401.18059)

<a id="ref-23"></a>**[23]** Galileo (2024): "Context Engineering for Agents" - [https://galileo.ai/blog/context-engineering-for-agents](https://galileo.ai/blog/context-engineering-for-agents)

<a id="ref-24"></a>**[24]** OpenReview (2024): "RAPTOR Performance Analysis" - [https://openreview.net/forum?id=GN921JHCRw](https://openreview.net/forum?id=GN921JHCRw)

<a id="ref-25"></a>**[25]** MIT News (2025): "PaTH Attention: New Way to Increase LLM Capabilities" - [https://news.mit.edu/2025/new-way-to-increase-large-language-model-capabilities-1217](https://news.mit.edu/2025/new-way-to-increase-large-language-model-capabilities-1217)

<a id="ref-26"></a>**[26]** LangChain Blog (2024): "Memory for Agents" - [https://blog.langchain.com/memory-for-agents/](https://blog.langchain.com/memory-for-agents/)

<a id="ref-32"></a>**[32]** arXiv (2024): "GUI Agents with Knowledge Graph-Augmented RAG" - [arXiv:2509.00366](https://arxiv.org/abs/2509.00366)

<a id="ref-38"></a>**[38]** APXML (2024): "Hybrid Search RAG Optimization" - [https://apxml.com/courses/optimizing-rag-for-production/chapter-2-advanced-retrieval-optimization/hybrid-search-rag](https://apxml.com/courses/optimizing-rag-for-production/chapter-2-advanced-retrieval-optimization/hybrid-search-rag/)

<a id="ref-40"></a>**[40]** Anthropic (2024): "Effective Context Engineering" - [https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

<a id="ref-46"></a>**[46]** Google Developers (2024): "ADK Context Management" - [https://developers.googleblog.com/en/architecting-efficient-context-aware-multi-agent-framework-for-production/](https://developers.googleblog.com/en/architecting-efficient-context-aware-multi-agent-framework-for-production/)

<a id="ref-48"></a>**[48]** arXiv (2024): "CASC: Context-Adaptive Synthesis and Compression" - [arXiv:2508.19357](https://arxiv.org/abs/2508.19357)

<a id="ref-49"></a>**[49]** OneReach (2024): "Smarter Context Engineering for Multi-Agent Systems" - [https://onereach.ai/blog/smarter-context-engineering-multi-agent-systems/](https://onereach.ai/blog/smarter-context-engineering-multi-agent-systems/)

<a id="ref-50"></a>**[50]** Model Context Protocol (2024): "What is MCP?" - [https://modelcontextprotocol.io](https://modelcontextprotocol.io)

<a id="ref-51"></a>**[51]** Anthropic (2024): "Connect Claude Code to tools via MCP" - [https://code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp)

<a id="ref-52"></a>**[52]** GitHub (2025): "mkreyman/mcp-memory-keeper - Claude Code Context Management" - [https://github.com/mkreyman/mcp-memory-keeper](https://github.com/mkreyman/mcp-memory-keeper)

<a id="ref-53"></a>**[53]** Model Context Protocol (2024): "Example Servers - Memory" - [https://modelcontextprotocol.io/examples](https://modelcontextprotocol.io/examples)

<a id="ref-54"></a>**[54]** Apidog (2025): "Top 10 Essential MCP Servers for Claude Code" - [https://apidog.com/blog/top-10-mcp-servers-for-claude-code/](https://apidog.com/blog/top-10-mcp-servers-for-claude-code/)

<a id="ref-55"></a>**[55]** GitHub (2024): "Awesome Claude MCP Servers" - [https://github.com/win4r/Awesome-Claude-MCP-Servers](https://github.com/win4r/Awesome-Claude-MCP-Servers)

<a id="ref-56"></a>**[56]** Mintlify (2025): "How Claude's memory and MCP work" - [https://www.mintlify.com/blog/how-claudes-memory-and-mcp-work](https://www.mintlify.com/blog/how-claudes-memory-and-mcp-work)

<a id="ref-57"></a>**[57]** GitHub Issue (2025): "Improve Claude Code Token Management with MCP Servers" - [https://github.com/anthropics/claude-code/issues/7172](https://github.com/anthropics/claude-code/issues/7172)

<a id="ref-58"></a>**[58]** MCPcat.io (2025): "Managing Claude Code context to reduce limits" - [https://mcpcat.io/guides/managing-claude-code-context/](https://mcpcat.io/guides/managing-claude-code-context/)

### Tools & Frameworks

**Claude Code** - [https://claude.com/claude-code](https://claude.com/claude-code)

**OpenAI Codex** - [https://openai.com/blog/codex](https://openai.com/blog/codex)

**LangChain** - [https://langchain.com](https://langchain.com)

**Pinecone** - [https://pinecone.io](https://pinecone.io)

**Weaviate** - [https://weaviate.io](https://weaviate.io)

**Neo4j** - [https://neo4j.com](https://neo4j.com)

---

**작성**: 2025-12-23
**업데이트**: 2025-12-24 (실제 구현 섹션 추가 - result-claude-setting)
**연구 방법**: Perplexity Research API + GPT-5.2-Codex Analysis
**도구**: memory-keeper (MCP), memory-kg (Knowledge Graph), cx/cxs (Codex CLI)
**참고**: 최신 연구 (2024-2025) 기반

---

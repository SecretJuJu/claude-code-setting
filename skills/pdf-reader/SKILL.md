---
name: pdf-reader
description: PDF 파일 읽기, 텍스트 추출, 테이블 추출, 이미지 추출, 메타데이터 확인. PDF 파일을 읽거나, PDF에서 텍스트를 추출하거나, PDF 문서 분석이 필요할 때 사용합니다. pdfplumber, pypdf, pdftotext 도구 활용.
allowed-tools: Read, Bash, Glob, Grep
---

# PDF Reader Skill

PDF 파일을 읽고 분석하는 스킬입니다.

## 사용 가능한 도구들

### 1. pdftotext (권장 - 빠르고 정확)
macOS에 기본 설치된 도구입니다.

```bash
# 기본 텍스트 추출
pdftotext input.pdf -

# 레이아웃 유지
pdftotext -layout input.pdf -

# 특정 페이지만 추출 (1-3 페이지)
pdftotext -f 1 -l 3 input.pdf -

# 파일로 저장
pdftotext input.pdf output.txt
```

### 2. pdfplumber (Python - 테이블 추출에 강함)

```bash
# 설치
uv pip install pdfplumber

# 텍스트 추출
uv run --with pdfplumber python -c "
import pdfplumber
import sys

with pdfplumber.open('$PDF_PATH') as pdf:
    for i, page in enumerate(pdf.pages):
        print(f'=== Page {i+1} ===')
        print(page.extract_text() or '[No text found]')
        print()
"

# 테이블 추출
uv run --with pdfplumber python -c "
import pdfplumber
import json

with pdfplumber.open('$PDF_PATH') as pdf:
    for i, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        if tables:
            print(f'=== Page {i+1} Tables ===')
            for j, table in enumerate(tables):
                print(f'Table {j+1}:')
                for row in table:
                    print(row)
                print()
"
```

### 3. pypdf (Python - 메타데이터, 분할, 병합)

```bash
# 설치
uv pip install pypdf

# 메타데이터 확인
uv run --with pypdf python -c "
from pypdf import PdfReader

reader = PdfReader('$PDF_PATH')
print(f'Pages: {len(reader.pages)}')
print(f'Metadata: {reader.metadata}')
"

# 텍스트 추출
uv run --with pypdf python -c "
from pypdf import PdfReader

reader = PdfReader('$PDF_PATH')
for i, page in enumerate(reader.pages):
    print(f'=== Page {i+1} ===')
    print(page.extract_text())
"
```

### 4. Claude의 내장 Read 도구
Claude Code는 PDF 파일을 직접 읽을 수 있습니다.

```
Read tool로 PDF 파일 경로를 직접 전달하면 Claude가 PDF 내용을 시각적으로 분석합니다.
```

## 사용 시나리오

### 시나리오 1: 빠른 텍스트 추출
```bash
pdftotext document.pdf -
```

### 시나리오 2: 테이블 데이터 추출
```bash
uv run --with pdfplumber python extract_tables.py document.pdf
```

### 시나리오 3: PDF 정보 확인
```bash
uv run --with pypdf python -c "
from pypdf import PdfReader
r = PdfReader('document.pdf')
print(f'Pages: {len(r.pages)}, Title: {r.metadata.title if r.metadata else \"N/A\"}')"
```

### 시나리오 4: 특정 페이지만 추출
```bash
pdftotext -f 5 -l 10 document.pdf -  # 5~10 페이지만
```

## 베스트 프랙티스

1. **간단한 텍스트 추출**: `pdftotext` 사용 (가장 빠름)
2. **테이블이 있는 PDF**: `pdfplumber` 사용
3. **메타데이터/분할/병합**: `pypdf` 사용
4. **시각적 분석 필요**: Claude의 `Read` 도구 사용
5. **큰 PDF**: 페이지 범위 지정하여 처리

## 주의사항

- 스캔된 PDF (이미지 기반)는 OCR이 필요할 수 있음
- 암호화된 PDF는 비밀번호가 필요함
- 대용량 PDF는 메모리 사용에 주의

---
name: pdf-reader
description: >-
  Read, extract text from, and analyze PDF files using pdfplumber, pypdf, pdftotext, or the
  bundled extract.py script. Use this skill whenever the user mentions a PDF file, wants to read
  a .pdf document, extract text or tables from a PDF, check PDF metadata, split or merge PDFs,
  or analyze any document that is in PDF format. Also use when the user references a file path
  ending in .pdf, says "이 PDF 읽어줘", "PDF에서 텍스트 뽑아줘", "테이블 추출", or any phrase
  involving PDF document processing, even if they just say "이 파일 좀 봐줘" about a .pdf file.
allowed-tools: Read, Bash, Glob, Grep
---

# PDF Reader

Read and analyze PDF files. Choose the right tool based on what you need — there's a bundled script for convenience, plus individual tools for specific needs.

## Bundled script (recommended)

The `scripts/extract.py` script handles most PDF tasks. It auto-selects the best engine and supports text, tables, metadata, and per-page extraction.

```bash
# Basic text extraction
uv run --with pdfplumber --with pypdf python3 ${CLAUDE_SKILL_DIR}/scripts/extract.py document.pdf

# Extract tables too
uv run --with pdfplumber --with pypdf python3 ${CLAUDE_SKILL_DIR}/scripts/extract.py document.pdf --tables

# JSON output (useful for programmatic processing)
uv run --with pdfplumber --with pypdf python3 ${CLAUDE_SKILL_DIR}/scripts/extract.py document.pdf --json

# Specific page only
uv run --with pdfplumber --with pypdf python3 ${CLAUDE_SKILL_DIR}/scripts/extract.py document.pdf --page 3

# Use pypdf engine (better for metadata)
uv run --with pdfplumber --with pypdf python3 ${CLAUDE_SKILL_DIR}/scripts/extract.py document.pdf --engine pypdf
```

## Individual tools

Use these when the bundled script is overkill or you need a specific capability.

### pdftotext — fast plain text
```bash
pdftotext input.pdf -              # basic extraction
pdftotext -layout input.pdf -      # preserve layout
pdftotext -f 1 -l 3 input.pdf -   # pages 1-3 only
```

### pdfplumber — tables and structured data
```bash
uv run --with pdfplumber python3 -c "
import pdfplumber
with pdfplumber.open('$PDF_PATH') as pdf:
    for i, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        if tables:
            print(f'=== Page {i+1} Tables ===')
            for j, table in enumerate(tables):
                for row in table: print(row)
"
```

### pypdf — metadata, split, merge
```bash
uv run --with pypdf python3 -c "
from pypdf import PdfReader
r = PdfReader('$PDF_PATH')
print(f'Pages: {len(r.pages)}')
print(f'Metadata: {r.metadata}')
"
```

### Claude's built-in Read tool
Claude Code can read PDFs directly via the Read tool — useful for visual analysis of scanned documents or complex layouts.

## Tool selection guide

| Need | Best tool | Why |
|------|-----------|-----|
| Quick text extraction | `pdftotext` | Fastest, no dependencies |
| Tables / structured data | `pdfplumber` or bundled script | Best table detection |
| Metadata / split / merge | `pypdf` | PDF manipulation features |
| Visual analysis | Claude `Read` tool | Handles images and layout |
| Large PDFs | `pdftotext` with page range | Memory efficient |
| Everything at once | Bundled `extract.py` | One command, multiple features |

## Notes

- Scanned (image-based) PDFs may need OCR — consider `ocrmypdf` if text extraction returns empty
- Encrypted PDFs require the password
- For very large PDFs, always specify a page range to avoid memory issues

#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Any

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False

try:
    from pypdf import PdfReader
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False


def extract_with_pdfplumber(pdf_path: str, extract_tables: bool = False) -> dict[str, Any]:
    if not HAS_PDFPLUMBER:
        print("pdfplumber가 설치되지 않았습니다. 설치: uv pip install pdfplumber", file=sys.stderr)
        sys.exit(1)

    result: dict[str, Any] = {
        "file": pdf_path,
        "total_pages": 0,
        "pages": []
    }

    with pdfplumber.open(pdf_path) as pdf:
        result["total_pages"] = len(pdf.pages)

        for i, page in enumerate(pdf.pages):
            page_data: dict[str, Any] = {
                "page": i + 1,
                "text": page.extract_text() or "",
            }

            if extract_tables:
                tables = page.extract_tables()
                if tables:
                    page_data["tables"] = tables

            result["pages"].append(page_data)

    return result


def extract_with_pypdf(pdf_path: str) -> dict[str, Any]:
    if not HAS_PYPDF:
        print("pypdf가 설치되지 않았습니다. 설치: uv pip install pypdf", file=sys.stderr)
        sys.exit(1)

    reader = PdfReader(pdf_path)

    result: dict[str, Any] = {
        "file": pdf_path,
        "total_pages": len(reader.pages),
        "metadata": {
            "title": reader.metadata.title if reader.metadata else None,
            "author": reader.metadata.author if reader.metadata else None,
            "subject": reader.metadata.subject if reader.metadata else None,
            "creator": reader.metadata.creator if reader.metadata else None,
        },
        "pages": []
    }

    for i, page in enumerate(reader.pages):
        result["pages"].append({
            "page": i + 1,
            "text": page.extract_text() or ""
        })

    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="PDF 텍스트 추출")
    parser.add_argument("pdf_path", help="PDF 파일 경로")
    parser.add_argument("--tables", "-t", action="store_true", help="테이블도 추출")
    parser.add_argument("--engine", "-e", choices=["pdfplumber", "pypdf"], default="pdfplumber",
                        help="추출 엔진 선택 (기본: pdfplumber)")
    parser.add_argument("--json", "-j", action="store_true", help="JSON 형식으로 출력")
    parser.add_argument("--page", "-p", type=int, help="특정 페이지만 추출")

    args = parser.parse_args()

    if not Path(args.pdf_path).exists():
        print(f"파일을 찾을 수 없습니다: {args.pdf_path}", file=sys.stderr)
        sys.exit(1)

    if args.engine == "pdfplumber":
        result = extract_with_pdfplumber(args.pdf_path, args.tables)
    else:
        result = extract_with_pypdf(args.pdf_path)

    if args.page:
        result["pages"] = [p for p in result["pages"] if p["page"] == args.page]

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"File: {result['file']}")
        print(f"Total Pages: {result['total_pages']}")
        print("=" * 50)

        for page in result["pages"]:
            print(f"\n=== Page {page['page']} ===\n")
            print(page["text"])

            if "tables" in page and page["tables"]:
                print(f"\n--- Tables on Page {page['page']} ---")
                for i, table in enumerate(page["tables"]):
                    print(f"\nTable {i + 1}:")
                    for row in table:
                        print(" | ".join(str(cell) if cell else "" for cell in row))


if __name__ == "__main__":
    main()

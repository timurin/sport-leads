from dataclasses import dataclass
from pathlib import Path

import fitz


@dataclass(slots=True)
class ParsedPdfDocument:
    path: Path
    page_count: int
    text: str


class PdfDocumentParser:
    def parse(
        self,
        path: str | Path,
        max_pages: int | None = None,
    ) -> ParsedPdfDocument:
        document_path = Path(path)

        if not document_path.exists():
            raise FileNotFoundError(
                f"PDF-файл не найден: {document_path}"
            )

        text_parts: list[str] = []

        with fitz.open(document_path) as document:
            page_count = len(document)

            limit = (
                min(page_count, max_pages)
                if max_pages is not None
                else page_count
            )

            for page_number in range(limit):
                page = document.load_page(page_number)
                page_text = page.get_text("text").strip()

                if page_text:
                    text_parts.append(page_text)

        return ParsedPdfDocument(
            path=document_path,
            page_count=page_count,
            text="\n".join(text_parts),
        )
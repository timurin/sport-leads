from app.parsers.ekp_pdf import EkpPdfParser
from app.parsers.pdf_document import PdfDocumentParser


def main() -> None:
    pdf_result = PdfDocumentParser().parse(
        "storage/documents/EKP_2023_13_10_2023_cde514d876.pdf",
        max_pages=10,
    )

    parser = EkpPdfParser()
    events = parser.parse(pdf_result.text)

    print(f"Найдено мероприятий: {len(events)}")

    for event in events[:10]:
        print("-" * 80)
        print(event)


if __name__ == "__main__":
    main()
import pymupdf
from ..schemas.scholarship import Block


def parse_pdf(content, url, max_pages=35):
    if not content.startswith(b"%PDF"):
        raise ValueError("Response does not have a PDF signature")
    blocks = []
    with pymupdf.open(stream=content, filetype="pdf") as document:
        if document.is_encrypted:
            raise ValueError("Encrypted PDF is not readable")
        for n, page in enumerate(document):
            if n >= max_pages:
                break
            for paragraph in page.get_text("blocks"):
                text = " ".join(paragraph[4].split())
                if text:
                    blocks.append(Block(section="Linked PDF", heading_path=["Linked PDF", f"Page {n+1}"],
                        kind="pdf_paragraph", text=text, source_url=f"{url}#page={n+1}", order=len(blocks)))
    return blocks

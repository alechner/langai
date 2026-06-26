# split_language_pdf.py
import re
import pdfplumber
from pypdf import PdfReader, PdfWriter
from pathlib import Path
import sys


def split_language_book(input_pdf: str, output_dir: str = "language_chunks", chunk_size_pages: int = 10):
    out_path = Path(output_dir)
    out_path.mkdir(exist_ok=True)

    reader = pdfplumber.open(input_pdf)
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        # Normaliza espaços mantendo quebras de linha importantes
        clean_text = re.sub(r"[ \t]+", " ", text).strip()
        pages.append({"page": i + 1, "text": clean_text})

    # 🎯 Padrões comuns em livros de idiomas (ajuste conforme seu material)
    boundary_patterns = [
        r"(?i)\bUnit\s+\d+\b",
        r"(?i)\bLesson\s+[A-Z]\b",
        r"(?i)\bPart\s+[A-Za-z0-9]+\b",
        r"(?i)\bModule\s+\d+\b",
        r"(?i)\bSection\s+\w+\b",
        r"(?i)^\s*\d+\s+[-•·]\s+\w+"  # Ex: "3. Vocabulary" ou "2 - Grammar"
    ]
    pattern = "|".join(boundary_patterns)

    chunks = []
    current_chunk = []

    for p in pages:
        # Se já temos chunk e esta página inicia novo limite (e chunk tem >= 3 págs), finaliza o anterior
        if chunks and re.search(pattern, p["text"]) and len(current_chunk) >= 3:
            chunks.append(current_chunk)
            current_chunk = []
        current_chunk.append(p)

    if current_chunk:
        chunks.append(current_chunk)

    # 🔪 Cria PDFs e Markdown por chunk
    base_reader = PdfReader(input_pdf)
    for i, chunk in enumerate(chunks):
        pdf_writer = PdfWriter()
        md_lines = [
            f"---\nchunk_id: {i + 1}\ntitle: \"Chunk {i + 1} (págs {chunk[0]['page']}-{chunk[-1]['page']})\"\n---\n\n"]

        for p in chunk:
            # Adiciona ao PDF final
            pdf_writer.add_page(base_reader.pages[p["page"] - 1])
            # Preserva estrutura textual para a LLM
            md_lines.append(f"[PÁGINA {p['page']}]\n{p['text']}\n\n---\n")

        # Salva PDF
        chunk_pdf = out_path / f"chunk_{i + 1}.pdf"
        with open(chunk_pdf, "wb") as f:
            pdf_writer.write(f)

        # Salva Markdown (recomendado para LLMs de texto)
        chunk_md = out_path / f"chunk_{i + 1}.md"
        chunk_md.write_text("".join(md_lines), encoding="utf-8")

    print(f"✅ Dividido em {len(chunks)} chunks salvos em {out_path}")
    print("💡 Use os arquivos .md para processar na LLM. Eles preservam numeração de exercícios, diálogos e cabeçalhos.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python split_language_pdf.py <caminho_do_livro.pdf>")
        sys.exit(1)
    split_language_book(sys.argv[1])

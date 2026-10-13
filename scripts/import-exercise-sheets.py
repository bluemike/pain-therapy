#!/usr/bin/env python3
"""
Digitalisiert die Übungsblätter der L&B-Sammelmappe (exercise-library, design D1).

Liest das PDF der Sammelmappe und `prisma/catalog/exercise-sheets.json` (Seite, Dateinamen und Schritt-Bezeichnungen
pro Übung) und schreibt in einen Ausgabeordner ausserhalb des Repositorys:

  <code>.jpg              Hauptbild: das grösste Bild der Seite, 200 dpi
  <code>-blatt.png        ganzes Blatt, 110 dpi
  exercises-content.json  Texte der Abschnitte im Format, das prisma/catalog/sync.mjs liest
  uebersicht-hauptbilder.png  alle Hauptbilder auf einen Blick, zur Kontrolle

Die Inhalte gehören Liebscher & Bracht: den Ausgabeordner nie ins Repository legen, sondern nach OneDrive
(`pain-therapy/exercises/digitalisiert/`) und von dort in den Container `exercise-media` (docs/deployment.md).
Die Texterkennung arbeitet mit den Überschriften der Blätter; das Ergebnis vor dem Upload durchsehen.

  pip install pymupdf
  python3 scripts/import-exercise-sheets.py <sammelmappe.pdf> <ausgabeordner> [--catalog prisma/catalog/exercise-sheets.json]
"""

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import pymupdf as fitz
except ImportError:  # pragma: no cover
    sys.exit("PyMuPDF fehlt: pip install pymupdf")

MAIN_DPI = 200
SHEET_DPI = 110

# Überschriften der Abschnitte auf den Blättern (Kleinschreibung, ohne Bindestriche verglichen)
HEADINGS = {
    "rolling": ("faszienrollmassage", "faszien rollmassage", "rollmassage"),
    "stretch": ("engpassdehnung", "dehnung"),
    "variants": ("varianten", "variante"),
}
STEP_RE = re.compile(r"^\s*(schritt\s*\d|\d\s*[.)])", re.IGNORECASE)


def norm(text):
    return re.sub(r"[\s\-–]+", " ", text).strip().lower()


def section_of(line):
    n = norm(line).rstrip(":")
    for key, names in HEADINGS.items():
        if any(n == name or n.startswith(name + " ") for name in names) and len(n) < 40:
            return key
    return None


def page_lines(page):
    """Text lines of the page in reading order (top to bottom, left to right)."""
    lines = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(span["text"] for span in line["spans"]).strip()
            if text:
                lines.append((round(line["bbox"][1]), line["bbox"][0], text))
    return [t for _, _, t in sorted(lines)]


def extract_texts(page, step_labels):
    sections = {"rolling": [], "stretch": [], "variants": []}
    current = None
    for line in page_lines(page):
        heading = section_of(line)
        if heading:
            current = heading
            continue
        if current:
            sections[current].append(line)

    steps = []
    for line in sections["stretch"]:
        if STEP_RE.match(line) or not steps:
            steps.append([line])
        else:
            steps[-1].append(line)
    step_rows = []
    for i, parts in enumerate(steps):
        text = " ".join(parts)
        label = step_labels[i] if i < len(step_labels) else f"Schritt {i + 1}"
        text = re.sub(r"^\s*(schritt\s*\d+|\d+\s*[.)])\s*:?\s*", "", text, flags=re.IGNORECASE)
        step_rows.append({"label": label, "text": text.strip()})

    join = lambda rows: " ".join(rows).strip() or None  # noqa: E731
    return {"rolling": join(sections["rolling"]), "steps": step_rows, "variants": join(sections["variants"])}


def largest_image_rect(page):
    best = None
    for info in page.get_image_info():
        rect = fitz.Rect(info["bbox"])
        if rect.is_empty:
            continue
        if best is None or rect.get_area() > best.get_area():
            best = rect
    return best


def overview(out, codes):
    """Contact sheet of all main images, 6 per row."""
    cols, w, h, pad = 6, 240, 180, 8
    rows = (len(codes) + cols - 1) // cols
    doc = fitz.open()
    page = doc.new_page(width=cols * (w + pad) + pad, height=rows * (h + pad + 16) + pad)
    for i, code in enumerate(codes):
        x = pad + (i % cols) * (w + pad)
        y = pad + (i // cols) * (h + pad + 16)
        img = out / f"{code}.jpg"
        if img.exists():
            page.insert_image(fitz.Rect(x, y, x + w, y + h), filename=str(img), keep_proportion=True)
        page.insert_text((x, y + h + 12), code, fontsize=11)
    page.get_pixmap(dpi=72).save(out / "uebersicht-hauptbilder.png")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--catalog", type=Path, default=Path(__file__).resolve().parent.parent / "prisma/catalog/exercise-sheets.json")
    args = ap.parse_args()

    repo = Path(__file__).resolve().parent.parent
    if args.out.resolve().is_relative_to(repo):
        sys.exit("Ausgabeordner liegt im Repository: L&B-Inhalte gehören nicht ins Repository.")
    args.out.mkdir(parents=True, exist_ok=True)

    sheets = json.loads(args.catalog.read_text(encoding="utf-8"))
    pdf = fitz.open(args.pdf)
    content, warnings = [], []
    for sheet in sheets:
        code, number = sheet["code"], sheet["sheetPage"]
        if number < 1 or number > pdf.page_count:
            warnings.append(f"{code}: Seite {number} fehlt im PDF")
            continue
        page = pdf[number - 1]
        page.get_pixmap(dpi=SHEET_DPI).save(args.out / sheet["sheetImage"])
        rect = largest_image_rect(page)
        if rect is None:
            warnings.append(f"{code}: kein Bild auf Seite {number}, Hauptbild fehlt")
        else:
            page.get_pixmap(dpi=MAIN_DPI, clip=rect).save(args.out / sheet["mainImage"], jpg_quality=88)
        texts = extract_texts(page, sheet.get("stretchStepLabels", []))
        if not (texts["rolling"] and texts["steps"]):
            warnings.append(f"{code}: Abschnitte unvollständig erkannt, bitte prüfen")
        content.append({"code": code, **texts})

    (args.out / "exercises-content.json").write_text(
        json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    overview(args.out, [s["code"] for s in sheets])
    print(f"{len(content)} Blätter nach {args.out} geschrieben")
    for w in warnings:
        print("Warnung:", w, file=sys.stderr)


if __name__ == "__main__":
    main()

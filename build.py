#!/usr/bin/env python3
"""
AU0009 resources page builder.

Scans weeks/week-01 ... weeks/week-12 for files, combines them with the
week titles, dates and labels in weeks.json, and writes assets/resources.js,
which index.html reads to draw the 12 week drop-downs.

Run it after you drop new files into a week folder:
    python build.py          (or double-click "Update page.bat" on Windows)

Rules:
  * A PowerPoint, Word or Excel file with a PDF of the SAME name becomes one
    row: "View" opens the PDF, the second button downloads the original.
  * A PDF on its own becomes a "View" row.
  * Anything else (images, zip, txt, etc.) becomes a "Download" row.
  * Start a filename with a number, e.g. "01-slides.pptx", to set the order.
    The number is not shown on the page.
  * Labels come from the filename unless weeks.json gives one.
"""
import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WEEKS_DIR = ROOT / "weeks"
CONFIG = ROOT / "weeks.json"
OUT = ROOT / "assets" / "resources.js"

IGNORE = {"readme.txt", "desktop.ini", "thumbs.db", ".ds_store", ".gitkeep"}

# extension -> (kind label, sort group, download button text)
KINDS = {
    ".pptx": ("PowerPoint", 1, "PowerPoint"), ".ppt": ("PowerPoint", 1, "PowerPoint"),
    ".docx": ("Word", 2, "Word"), ".doc": ("Word", 2, "Word"),
    ".xlsx": ("Excel", 3, "Excel"), ".xls": ("Excel", 3, "Excel"), ".csv": ("Excel", 3, "CSV"),
    ".pdf": ("PDF", 4, "PDF"),
    ".png": ("Image", 5, "Image"), ".jpg": ("Image", 5, "Image"), ".jpeg": ("Image", 5, "Image"),
    ".gif": ("Image", 5, "Image"), ".svg": ("Image", 5, "Image"), ".webp": ("Image", 5, "Image"),
    ".mp4": ("Video", 6, "Video"), ".mp3": ("Audio", 6, "Audio"),
    ".zip": ("Zip", 7, "Zip"),
}
SMALL = {"and", "or", "of", "the", "a", "an", "to", "in", "on", "for", "with", "at", "by"}
UPPER = {"ai", "pdf", "otj", "kpi", "swot", "pestle", "gdpr", "uk", "it", "ml", "llm", "faq"}


def human_size(n):
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit in ("B", "KB") else f"{n:.1f} {unit}"
        n /= 1024


def split_order(stem):
    m = re.match(r"^(\d+)[\s._-]+(.*)$", stem)
    return (int(m.group(1)), m.group(2)) if m else (9999, stem)


def nice_label(stem):
    words = re.split(r"[\s_-]+", stem.strip())
    out = []
    for i, w in enumerate(words):
        lw = w.lower()
        if not w:
            continue
        if re.fullmatch(r"[a-z]{2}\d{3,}", lw):          # course codes, e.g. au0009
            out.append(w.upper())
        elif lw in UPPER:
            out.append(lw.upper())
        elif w != lw:                                     # already has capitals, keep as typed
            out.append(w)
        elif i > 0 and lw in SMALL:
            out.append(lw)
        else:
            out.append(lw[:1].upper() + lw[1:])
    return " ".join(out)


def scan_week(folder, overrides, wk):
    if not folder.is_dir():
        return []
    groups = {}
    for f in sorted(folder.iterdir()):
        if not f.is_file() or f.name.startswith(".") or f.name.startswith("~$") or f.name.lower() in IGNORE:
            continue
        groups.setdefault(f.stem.lower(), []).append(f)

    items = []
    for key, files in groups.items():
        pdf = next((f for f in files if f.suffix.lower() == ".pdf"), None)
        others = sorted((f for f in files if f.suffix.lower() != ".pdf"),
                        key=lambda f: KINDS.get(f.suffix.lower(), ("File", 8, "Download"))[1])
        main = others[0] if others else pdf
        order, bare = split_order(main.stem)
        ov = overrides.get(main.stem) or overrides.get(bare) or overrides.get(main.name) or {}
        kind, group, btn = KINDS.get(main.suffix.lower(), ("File", 8, "Download"))
        label = ov.get("label") or nice_label(bare)
        href = lambda f: f"weeks/{folder.name}/{f.name}"
        actions = []
        if pdf:
            actions.append({"text": "View", "href": href(pdf), "view": True})
        if main is not pdf:
            actions.append({"text": btn, "href": href(main), "size": human_size(main.stat().st_size),
                            "download": f"{label}{main.suffix.lower()}"})
        elif pdf:
            actions.append({"text": "PDF", "href": href(pdf), "size": human_size(pdf.stat().st_size),
                            "download": f"{label}.pdf"})
        for extra in others[1:]:
            ek, _, eb = KINDS.get(extra.suffix.lower(), ("File", 8, "Download"))
            actions.append({"text": eb, "href": href(extra), "size": human_size(extra.stat().st_size),
                            "download": f"{label}{extra.suffix.lower()}"})
        items.append({"order": order, "group": group, "kind": kind, "label": label,
                      "description": ov.get("description", ""), "actions": actions})
        if not ov:
            print(f"  week {wk}: added '{label}' (label from filename)")
    items.sort(key=lambda i: (i["order"], i["group"], i["label"].lower()))
    for i in items:
        i.pop("order"); i.pop("group")
    return items


def main():
    try:
        config = json.loads(CONFIG.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        sys.exit(f"weeks.json has a mistake on line {e.lineno}: {e.msg}. Check for a missing comma or quote.")

    total = 0
    weeks_out = []
    for w in config["weeks"]:
        n = int(w["week"])
        folder = WEEKS_DIR / f"week-{n:02d}"
        items = scan_week(folder, w.get("files", {}), n)
        for link in w.get("links", []):
            items.append({"kind": "Link", "label": link.get("label", link["url"]),
                          "description": link.get("description", ""),
                          "actions": [{"text": link.get("button", "Open"), "href": link["url"], "external": True}]})
        total += len(items)
        weeks_out.append({k: w.get(k, "") for k in ("week", "date", "title", "summary")} | {"items": items})

    data = {"course": config["course"], "weeks": weeks_out,
            "built": datetime.now().strftime("%d %B %Y, %H:%M")}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("/* Generated by build.py. Do not edit by hand: edit weeks.json or the week folders, then run build.py. */\n"
                   "window.AU0009_DATA = " + json.dumps(data, indent=2, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(f"Done. {total} resources across {len(weeks_out)} weeks written to assets/resources.js")


if __name__ == "__main__":
    main()

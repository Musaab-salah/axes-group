# -*- coding: utf-8 -*-
"""Attach data-cms keys to all bilingual text nodes missing them, and export seed blocks."""
from pathlib import Path
import re
import json

ROOT = Path(r"C:\Users\Musaab\Downloads\AXES-GROUP-Office-Website\site")
PAGE_MAP = {
    "index.html": "home",
    "about.html": "about",
    "services.html": "services",
    "projects.html": "projects",
    "quality.html": "quality",
    "contact.html": "contact",
}

blocks = []

for name, slug in PAGE_MAP.items():
    path = ROOT / name
    html = path.read_text(encoding="utf-8")
    counter = {"n": 0}

    def repl(m, slug=slug, counter=counter):
        tag = m.group(0)
        # skip if already has data-cms
        if re.search(r'\bdata-cms=', tag):
            # still collect existing text cms for seed if data-ar/en present
            key_m = re.search(r'data-cms="([^"]+)"', tag)
            ar_m = re.search(r'data-ar="([^"]*)"', tag)
            en_m = re.search(r'data-en="([^"]*)"', tag)
            if key_m and ar_m and en_m and not re.search(r'\.(image|video|poster)\.\d+', key_m.group(1)):
                blocks.append({
                    "page": slug,
                    "key": key_m.group(1),
                    "type": "text",
                    "valueAr": ar_m.group(1),
                    "valueEn": en_m.group(1),
                })
            return tag
        # must have both ar and en
        ar_m = re.search(r'data-ar="([^"]*)"', tag)
        en_m = re.search(r'data-en="([^"]*)"', tag)
        if not ar_m or not en_m:
            return tag
        # skip empty
        if not ar_m.group(1).strip() and not en_m.group(1).strip():
            return tag
        key = f"{slug}.text.{counter['n']}"
        counter["n"] += 1
        blocks.append({
            "page": slug,
            "key": key,
            "type": "text",
            "valueAr": ar_m.group(1),
            "valueEn": en_m.group(1),
        })
        # insert data-cms after tag name
        return re.sub(r"^<(\w+)", rf'<\1 data-cms="{key}"', tag, count=1)

    # Match opening tags that contain data-ar (self-contained attrs on one tag)
    html2 = re.sub(r"<[^>]*\bdata-ar=\"[^\"]*\"[^>]*>", repl, html)
    path.write_text(html2, encoding="utf-8")
    print(f"{name}: new/kept text keys processed, counter={counter['n']}")

out = Path(r"C:\Users\Musaab\Downloads\AXES-GROUP-Office-Website\cms\text-blocks.json")
# dedupe by page+key
uniq = {}
for b in blocks:
    uniq[(b["page"], b["key"])] = b
out.write_text(json.dumps(list(uniq.values()), ensure_ascii=False, indent=2), encoding="utf-8")
print("text blocks", len(uniq))

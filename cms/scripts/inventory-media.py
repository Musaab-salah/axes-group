# -*- coding: utf-8 -*-
from pathlib import Path
import re
import json

root = Path(r"C:\Users\Musaab\Downloads\AXES-GROUP-Office-Website\site")
inventory = []

PAGE_MAP = {
    "index.html": "home",
    "about.html": "about",
    "services.html": "services",
    "projects.html": "projects",
    "quality.html": "quality",
    "contact.html": "contact",
}

for html_name, slug in PAGE_MAP.items():
    f = root / html_name
    t = f.read_text(encoding="utf-8")
    for i, m in enumerate(re.finditer(r'<img\b[^>]*src=["\']([^"\']+)["\']', t, re.I)):
        src = m.group(1)
        inventory.append({"page": slug, "type": "image", "src": src, "index": i, "key": f"{slug}.image.{i}"})
    for i, m in enumerate(re.finditer(r'<video\b[^>]*>[\s\S]*?<source[^>]*src=["\']([^"\']+)["\']', t, re.I)):
        src = m.group(1)
        inventory.append({"page": slug, "type": "video", "src": src, "index": i, "key": f"{slug}.video.{i}"})
    for i, m in enumerate(re.finditer(r'\bposter=["\']([^"\']+)["\']', t, re.I)):
        inventory.append({"page": slug, "type": "poster", "src": m.group(1), "index": i, "key": f"{slug}.poster.{i}"})

out = Path(r"C:\Users\Musaab\Downloads\AXES-GROUP-Office-Website\cms\media-inventory.json")
out.write_text(json.dumps(inventory, ensure_ascii=False, indent=2), encoding="utf-8")
print("items", len(inventory))
for row in inventory[:20]:
    print(row["page"], row["type"], row["src"][:60])

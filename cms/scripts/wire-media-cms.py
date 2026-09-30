# -*- coding: utf-8 -*-
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

blocks_seed = []

for name, slug in PAGE_MAP.items():
    path = ROOT / name
    html = path.read_text(encoding="utf-8")

    html = re.sub(r'\sdata-cms-page="[^"]*"', "", html)
    m = re.search(r"<body([^>]*)>", html, flags=re.I)
    if m:
        attrs = m.group(1)
        html = html[: m.start()] + f'<body data-cms-page="{slug}"{attrs}>' + html[m.end() :]

    html = re.sub(
        r'\sdata-cms="(?:home|about|services|projects|quality|contact)\.(?:image|video|poster)\.\d+"',
        "",
        html,
    )
    html = re.sub(
        r'\sdata-cms-poster="(?:home|about|services|projects|quality|contact)\.poster\.\d+"',
        "",
        html,
    )

    counters = {"img": 0, "vid": 0, "poster": 0}

    def img_repl(match, slug=slug, counters=counters):
        tag = match.group(0)
        src_m = re.search(r'src=["\']([^"\']+)["\']', tag, re.I)
        src = src_m.group(1) if src_m else ""
        key = f"{slug}.image.{counters['img']}"
        counters["img"] += 1
        blocks_seed.append({"page": slug, "key": key, "type": "image", "value": src})
        if re.search(r'data-cms="', tag):
            tag = re.sub(r'\sdata-cms="[^"]*"', "", tag)
        return tag.replace("<img", f'<img data-cms="{key}"', 1)

    def video_open_repl(match, slug=slug, counters=counters):
        tag = match.group(0)
        poster_m = re.search(r'poster=["\']([^"\']+)["\']', tag, re.I)
        if poster_m:
            key = f"{slug}.poster.{counters['poster']}"
            counters["poster"] += 1
            blocks_seed.append({"page": slug, "key": key, "type": "poster", "value": poster_m.group(1)})
            tag = re.sub(r'\sdata-cms-poster="[^"]*"', "", tag)
            tag = tag.replace("poster=", f'data-cms-poster="{key}" poster=', 1)
        return tag

    def source_repl(match, slug=slug, counters=counters):
        tag = match.group(0)
        src_m = re.search(r'src=["\']([^"\']+)["\']', tag, re.I)
        src = src_m.group(1) if src_m else ""
        if not re.search(r"\.(mp4|webm)([\"'\?#]|$)", src, re.I):
            return tag
        key = f"{slug}.video.{counters['vid']}"
        counters["vid"] += 1
        blocks_seed.append({"page": slug, "key": key, "type": "video", "value": src})
        tag = re.sub(r'\sdata-cms="[^"]*"', "", tag)
        return tag.replace("<source", f'<source data-cms="{key}"', 1)

    html = re.sub(r"<img\b[^>]*>", img_repl, html, flags=re.I)
    html = re.sub(r"<video\b[^>]*>", video_open_repl, html, flags=re.I)
    html = re.sub(r"<source\b[^>]*>", source_repl, html, flags=re.I)

    path.write_text(html, encoding="utf-8")
    print(f"{name}: images={counters['img']} videos={counters['vid']} posters={counters['poster']}")

out = Path(r"C:\Users\Musaab\Downloads\AXES-GROUP-Office-Website\cms\media-blocks.json")
out.write_text(json.dumps(blocks_seed, ensure_ascii=False, indent=2), encoding="utf-8")
print("seed blocks", len(blocks_seed))

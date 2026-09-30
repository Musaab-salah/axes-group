"""Serve the packaged AXES GROUP site locally, including video byte ranges."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
import os


ROOT = Path(__file__).resolve().parent / "site"


class SiteHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self._redirect_html_extension():
            return
        self._rewrite_clean_path()
        return super().do_GET()

    def do_HEAD(self):
        if self._redirect_html_extension():
            return
        self._rewrite_clean_path()
        return super().do_HEAD()

    def _redirect_html_extension(self):
        parts = urlsplit(self.path)
        path = parts.path
        if path.endswith(".html"):
            name = Path(path).name[:-5]
            clean = "/" if name == "index" else f"/{name}"
            location = urlunsplit(("", "", clean, parts.query, parts.fragment))
            self.send_response(301)
            self.send_header("Location", location)
            self.end_headers()
            return True
        return False

    def _rewrite_clean_path(self):
        parts = urlsplit(self.path)
        path = parts.path.rstrip("/") or "/"
        if path == "/":
            return
        candidate = ROOT / f"{path.lstrip('/')}.html"
        if candidate.is_file():
            self.path = urlunsplit(("", "", f"/{candidate.name}", parts.query, parts.fragment))

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        try:
            file = open(path, "rb")
        except OSError:
            return super().send_head()
        size = os.fstat(file.fileno()).st_size
        start, end = 0, size - 1
        range_header = self.headers.get("Range")
        if range_header:
            try:
                unit, value = range_header.split("=", 1)
                if unit != "bytes" or "," in value:
                    raise ValueError
                first, last = value.split("-", 1)
                if not first:
                    length = int(last)
                    if length <= 0:
                        raise ValueError
                    start = max(0, size - length)
                else:
                    start = int(first)
                    if last:
                        end = min(int(last), end)
                if start < 0 or start >= size or end < start:
                    raise ValueError
            except ValueError:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                file.close()
                return None
        self.send_response(206 if range_header else 200)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Accept-Ranges", "bytes")
        if range_header:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        file.seek(start)
        self.range_remaining = end - start + 1
        return file

    def copyfile(self, source, outputfile):
        remaining = getattr(self, "range_remaining", None)
        if remaining is None:
            return super().copyfile(source, outputfile)
        while remaining:
            chunk = source.read(min(64 * 1024, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)


if __name__ == "__main__":
    print("AXES GROUP listening on 0.0.0.0:8765", flush=True)
    ThreadingHTTPServer(("0.0.0.0", 8765), SiteHandler).serve_forever()

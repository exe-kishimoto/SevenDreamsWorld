#!/usr/bin/env python3
"""Seven Dreams World 用ローカルサーバー（Range リクエスト対応 / HTTP/1.1）。

標準の `python -m http.server` は Range 非対応で、動画(mp4)が
ブラウザで「再生できません」になることがある。これは Range(206) に対応し、
動画・音声のシークとプログレッシブ再生を正しく行う。

  python serve.py 8000
"""
import http.server, socketserver, os, sys


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        # 差し替えた素材が確実に反映されるようキャッシュさせない
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self):
        raw = self.path.split("?", 1)[0].split("#", 1)[0]
        path = self.translate_path(raw)
        if os.path.isdir(path):
            return super().send_head()
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None
        try:
            size = os.fstat(f.fileno()).st_size
            ctype = self.guess_type(path)
            rng = self.headers.get("Range")
            if rng and rng.startswith("bytes="):
                try:
                    s, e = rng[6:].split("-", 1)
                    start = int(s) if s else 0
                    end = int(e) if e else size - 1
                except ValueError:
                    self.send_error(400, "Bad Range")
                    f.close(); return None
                if start >= size or start > end:
                    self.send_response(416)
                    self.send_header("Content-Range", "bytes */%d" % size)
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    f.close(); return None
                end = min(end, size - 1)
                length = end - start + 1
                self.send_response(206)
                self.send_header("Content-Type", ctype)
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
                self.send_header("Content-Length", str(length))
                self.end_headers()
                f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = f.read(min(65536, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
                f.close(); return None
            # 通常（Range なし）
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(size))
            self.end_headers()
            return f
        except Exception:
            f.close()
            raise


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with Server(("", port), Handler) as httpd:
        print("Serving Seven Dreams World: http://localhost:%d/index.html" % port)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass

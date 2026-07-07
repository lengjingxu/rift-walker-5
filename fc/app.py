#!/usr/bin/env python3
"""暗黑出装系统 - FC 静态托管服务"""
import http.server
import socketserver
import os
import sys

PORT = 9000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
# FC 自定义域名路径前缀，请求到达时会带此前缀，需要剥离
PATH_PREFIX = os.environ.get("PATH_PREFIX", "/ai/diablo-build")


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), format % args))

    def translate_path(self, path):
        """剥离 PATH_PREFIX，让 SimpleHTTPRequestHandler 正确定位文件"""
        if PATH_PREFIX and path.startswith(PATH_PREFIX):
            path = path[len(PATH_PREFIX):]
            if not path.startswith("/"):
                path = "/" + path
        return super().translate_path(path)

    def end_headers(self):
        # 防止缓存，方便开发调试
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()


if __name__ == '__main__':
    print(f"⚔  Diablo Build System serving at port {PORT}", flush=True)
    print(f"📁  Directory: {DIRECTORY}", flush=True)
    print(f"🛤  PATH_PREFIX: {PATH_PREFIX}", flush=True)
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        httpd.serve_forever()

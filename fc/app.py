#!/usr/bin/env python3
"""Rift Walker static host plus Feishu Bitable leaderboard API."""

import http.server
import json
import math
import os
import socketserver
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from urllib.parse import urlsplit

PORT = 9000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
PATH_PREFIX = os.environ.get("PATH_PREFIX", "/ai/diablo-build").rstrip("/")

FEISHU_APP_ID = os.environ.get("FEISHU_APP_ID", "")
FEISHU_APP_SECRET = os.environ.get("FEISHU_APP_SECRET", "")
BITABLE_APP_TOKEN = os.environ.get("BITABLE_APP_TOKEN", "LPdqb0BZ3aUjyVsF3Yucb1WFnnc")
BITABLE_TABLE_ID = os.environ.get("BITABLE_TABLE_ID", "tblVBRK5aGowuJsw")
FEISHU_OPEN_BASE = "https://open.feishu.cn/open-apis"
MAX_BODY_BYTES = 64 * 1024
ALLOWED_ENDINGS = {"A_Rebel", "B_Inheritor", "C_Glitched", "died", "retreated"}
ALLOWED_CLASSES = {"paladin", "barbarian", "sorceress", "necromancer", "druid", "assassin"}

_token_cache = {"token": "", "expires_at": 0.0}
_token_lock = threading.Lock()


def get_tenant_access_token():
    """Return a cached tenant token, refreshing it before expiry."""
    with _token_lock:
        now = time.time()
        if _token_cache["token"] and _token_cache["expires_at"] > now + 60:
            return _token_cache["token"]
        if not FEISHU_APP_ID or not FEISHU_APP_SECRET:
            return None

        body = json.dumps({
            "app_id": FEISHU_APP_ID,
            "app_secret": FEISHU_APP_SECRET,
        }).encode("utf-8")
        req = urllib.request.Request(
            FEISHU_OPEN_BASE + "/auth/v3/tenant_access_token/internal",
            data=body,
            method="POST",
            headers={"Content-Type": "application/json; charset=utf-8"},
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            if data.get("code") != 0 or not data.get("tenant_access_token"):
                print("[Bitable] tenant token rejected: code={}".format(data.get("code")), flush=True)
                return None
            _token_cache["token"] = data["tenant_access_token"]
            _token_cache["expires_at"] = now + int(data.get("expire", 7200))
            return _token_cache["token"]
        except Exception as exc:
            print("[Bitable] tenant token request failed: {}".format(type(exc).__name__), flush=True)
            return None


def bitable_create_record(fields):
    """Create one leaderboard record and return a safe public result."""
    token = get_tenant_access_token()
    if not token:
        return {"ok": False, "error": "bitable_auth_unavailable"}

    url = "{}/bitable/v1/apps/{}/tables/{}/records".format(
        FEISHU_OPEN_BASE, BITABLE_APP_TOKEN, BITABLE_TABLE_ID
    )
    req = urllib.request.Request(
        url,
        data=json.dumps({"fields": fields}, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json; charset=utf-8",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if data.get("code") != 0:
            print("[Bitable] create rejected: code={}".format(data.get("code")), flush=True)
            return {"ok": False, "error": "bitable_write_failed"}
        record_id = data.get("data", {}).get("record", {}).get("record_id", "")
        print("[Bitable] record created: {}".format(record_id or "unknown"), flush=True)
        return {"ok": True, "recordId": record_id}
    except urllib.error.HTTPError as exc:
        print("[Bitable] create HTTP status={}".format(exc.code), flush=True)
        return {"ok": False, "error": "bitable_write_failed"}
    except Exception as exc:
        print("[Bitable] create request failed: {}".format(type(exc).__name__), flush=True)
        return {"ok": False, "error": "bitable_write_failed"}


def payload_to_bitable_fields(payload):
    """Validate T5.1 payload and map it to the actual Bitable field types."""
    if not isinstance(payload, dict):
        raise ValueError("payload_must_be_object")

    ending = _text(payload.get("ending"), 32)
    class_id = _text(payload.get("classId"), 32)
    if ending not in ALLOWED_ENDINGS:
        raise ValueError("invalid_ending")
    if class_id not in ALLOWED_CLASSES:
        raise ValueError("invalid_class_id")

    return {
        "player": _text(payload.get("player") or "anonymous", 64),
        "buildHash": _text(payload.get("buildHash"), 64),
        "score": _number(payload.get("score"), 0, 100000000),
        "floor": _number(payload.get("floor"), 0, 35),
        "goldRemaining": _number(payload.get("goldRemaining"), 0, 100000000),
        # DESIGN.md defines these Bitable columns as number fields.
        "itemsBroughtOut": _item_count(payload.get("itemsBroughtOut")),
        "itemsLost": _item_count(payload.get("itemsLost")),
        "ending": ending,
        "classId": class_id,
        # Feishu datetime cells require Unix milliseconds, not an ISO string.
        "submittedAt": _datetime_ms(payload.get("submittedAt")),
    }


def _text(value, limit):
    if value is None:
        return ""
    return str(value).strip()[:limit]


def _number(value, minimum, maximum):
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = float(minimum)
    if not math.isfinite(number):
        number = float(minimum)
    number = min(float(maximum), max(float(minimum), number))
    return int(number) if number.is_integer() else number


def _item_count(value):
    if isinstance(value, list):
        return min(len(value), 10000)
    return int(_number(value, 0, 10000))


def _datetime_ms(value):
    if isinstance(value, (int, float)):
        number = float(value)
        if not math.isfinite(number) or number <= 0:
            raise ValueError("invalid_submitted_at")
        return int(number * 1000 if number < 100000000000 else number)

    text = _text(value, 64)
    if not text:
        return int(time.time() * 1000)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("invalid_submitted_at") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return int(parsed.timestamp() * 1000)


def _route_path(raw_path):
    path = urlsplit(raw_path).path
    if PATH_PREFIX and path.startswith(PATH_PREFIX):
        path = path[len(PATH_PREFIX):] or "/"
    return path


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), format % args))

    def translate_path(self, path):
        return super().translate_path(_route_path(path))

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        super().end_headers()

    def do_POST(self):
        if _route_path(self.path) != "/api/leaderboard":
            self.send_error(404, "Not Found")
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            content_length = -1
        if content_length < 1:
            self._send_json(400, {"ok": False, "error": "empty_body"})
            return
        if content_length > MAX_BODY_BYTES:
            self._send_json(413, {"ok": False, "error": "payload_too_large"})
            return

        try:
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._send_json(400, {"ok": False, "error": "invalid_json"})
            return

        try:
            fields = payload_to_bitable_fields(payload)
        except ValueError as exc:
            self._send_json(422, {"ok": False, "error": str(exc)})
            return

        result = bitable_create_record(fields)
        self._send_json(201 if result.get("ok") else 502, result)

    def do_OPTIONS(self):
        if _route_path(self.path) != "/api/leaderboard":
            self.send_error(404, "Not Found")
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)


class ReusableTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    print("⚔ Rift Walker serving at port {}".format(PORT), flush=True)
    print("📁 Directory: {}".format(DIRECTORY), flush=True)
    print("🛤 PATH_PREFIX: {}".format(PATH_PREFIX), flush=True)
    print("📊 Bitable configured: {}".format(bool(FEISHU_APP_ID and FEISHU_APP_SECRET)), flush=True)
    with ReusableTCPServer(("", PORT), CustomHandler) as httpd:
        httpd.serve_forever()

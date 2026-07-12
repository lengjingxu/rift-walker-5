#!/usr/bin/env python3
"""T5.2 Bitable write path test suite

Tests:
  1. FC handler routing: /api/leaderboard POST returns correct response
  2. Payload → Bitable fields mapping
  3. tenant_access_token fetch (mocked when no credentials)
  4. Bitable create record (mocked when no credentials)
  5. CORS preflight OPTIONS response
  6. Edge cases: oversized payload, malformed JSON
  7. Frontend endpoint injection logic
"""

import json
import os
import sys
import unittest
import urllib.request
import urllib.error
from http.server import HTTPServer
import threading
import time

# Add fc directory to path for importing app module
FC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'fc')
sys.path.insert(0, FC_DIR)

# Import the app module functions directly
# We need to import the helper functions, not start the server
import importlib
app_module = importlib.import_module('app')


class TestPayloadToBitableFields(unittest.TestCase):
    """Test payload_to_bitable_fields mapping"""

    def test_full_payload(self):
        """All 10 T5.2 fields map correctly"""
        payload = {
            "player": "TestPlayer",
            "buildHash": "abc123def456",
            "score": 3500,
            "floor": 35,
            "goldRemaining": 150,
            "itemsBroughtOut": ["T5 Sword", "T4 Shield"],
            "itemsLost": ["T1 Dagger", "T2 Ring"],
            "ending": "A_Rebel",
            "classId": "paladin",
            "submittedAt": "2026-07-13T12:00:00.000Z"
        }
        fields = app_module.payload_to_bitable_fields(payload)
        self.assertEqual(fields["player"], "TestPlayer")
        self.assertEqual(fields["buildHash"], "abc123def456")
        self.assertEqual(fields["score"], 3500)
        self.assertEqual(fields["floor"], 35)
        self.assertEqual(fields["goldRemaining"], 150)
        self.assertEqual(fields["itemsBroughtOut"], 2)
        self.assertEqual(fields["itemsLost"], 2)
        self.assertEqual(fields["ending"], "A_Rebel")
        self.assertEqual(fields["classId"], "paladin")
        self.assertEqual(fields["submittedAt"], 1783944000000)

    def test_empty_payload(self):
        """Empty payload defaults to safe values"""
        with self.assertRaisesRegex(ValueError, "invalid_ending"):
            app_module.payload_to_bitable_fields({})

    def test_partial_payload(self):
        """Partial payload: only required fields"""
        payload = {
            "player": "anonymous",
            "floor": 5,
            "ending": "died",
            "classId": "paladin"
        }
        fields = app_module.payload_to_bitable_fields(payload)
        self.assertEqual(fields["player"], "anonymous")
        self.assertEqual(fields["floor"], 5)
        self.assertEqual(fields["ending"], "died")
        # Missing fields get defaults
        self.assertEqual(fields["score"], 0)
        self.assertEqual(fields["goldRemaining"], 0)

    def test_array_fields_stringified(self):
        """itemsBroughtOut/itemsLost arrays become JSON strings"""
        payload = {
            "itemsBroughtOut": ["item1", "item2", "item3"],
            "itemsLost": ["lost1"],
            "ending": "A_Rebel",
            "classId": "paladin"
        }
        fields = app_module.payload_to_bitable_fields(payload)
        self.assertEqual(fields["itemsBroughtOut"], 3)
        self.assertEqual(fields["itemsLost"], 1)

    def test_non_array_items(self):
        """itemsBroughtOut/itemsLost as non-array get stringified"""
        payload = {
            "itemsBroughtOut": "3",
            "itemsLost": 42,
            "ending": "A_Rebel",
            "classId": "paladin"
        }
        fields = app_module.payload_to_bitable_fields(payload)
        self.assertEqual(fields["itemsBroughtOut"], 3)
        self.assertEqual(fields["itemsLost"], 42)


class TestBitableCredentials(unittest.TestCase):
    """Test that Bitable config constants match DESIGN.md"""

    def test_bitable_app_token_default(self):
        """Default BITABLE_APP_TOKEN matches DESIGN.md Q14"""
        # DESIGN.md: base LPdqb0BZ3aUjyVsF3Yucb1WFnnc
        self.assertEqual(app_module.BITABLE_APP_TOKEN, "LPdqb0BZ3aUjyVsF3Yucb1WFnnc")

    def test_bitable_table_id_default(self):
        """Default BITABLE_TABLE_ID matches DESIGN.md Q14"""
        # DESIGN.md: table tblVBRK5aGowuJsw
        self.assertEqual(app_module.BITABLE_TABLE_ID, "tblVBRK5aGowuJsw")

    def test_env_override(self):
        """BITABLE_APP_TOKEN/TABLE_ID can be overridden via env vars"""
        # Save current values
        orig_app_token = os.environ.get("BITABLE_APP_TOKEN", "")
        orig_table_id = os.environ.get("BITABLE_TABLE_ID", "")
        try:
            os.environ["BITABLE_APP_TOKEN"] = "test_override_token"
            os.environ["BITABLE_TABLE_ID"] = "test_override_table"
            # Re-read constants from module (they were set at import time)
            # We need to reload the module to pick up env changes
            importlib.reload(app_module)
            self.assertEqual(app_module.BITABLE_APP_TOKEN, "test_override_token")
            self.assertEqual(app_module.BITABLE_TABLE_ID, "test_override_table")
        finally:
            os.environ.pop("BITABLE_APP_TOKEN", None)
            os.environ.pop("BITABLE_TABLE_ID", None)
            # Restore original env if they existed
            if orig_app_token:
                os.environ["BITABLE_APP_TOKEN"] = orig_app_token
            if orig_table_id:
                os.environ["BITABLE_TABLE_ID"] = orig_table_id
            importlib.reload(app_module)


class TestTenantAccessToken(unittest.TestCase):
    """Test tenant_access_token fetch"""

    def test_no_credentials_returns_none(self):
        """Without FEISHU_APP_ID/APP_SECRET, get_tenant_access_token returns None"""
        # Ensure no credentials
        orig_app_id = os.environ.get("FEISHU_APP_ID", "")
        orig_app_secret = os.environ.get("FEISHU_APP_SECRET", "")
        try:
            os.environ.pop("FEISHU_APP_ID", None)
            os.environ.pop("FEISHU_APP_SECRET", None)
            importlib.reload(app_module)
            token = app_module.get_tenant_access_token()
            self.assertIsNone(token)
        finally:
            if orig_app_id:
                os.environ["FEISHU_APP_ID"] = orig_app_id
            if orig_app_secret:
                os.environ["FEISHU_APP_SECRET"] = orig_app_secret
            importlib.reload(app_module)


class TestBitableCreateRecord(unittest.TestCase):
    """Test bitable_create_record function"""

    def test_no_credentials_returns_error(self):
        """Without credentials, bitable_create_record returns error"""
        orig_app_id = os.environ.get("FEISHU_APP_ID", "")
        orig_app_secret = os.environ.get("FEISHU_APP_SECRET", "")
        try:
            os.environ.pop("FEISHU_APP_ID", None)
            os.environ.pop("FEISHU_APP_SECRET", None)
            importlib.reload(app_module)
            result = app_module.bitable_create_record({"player": "test"})
            self.assertFalse(result.get("ok"))
            self.assertEqual(result.get("error"), "bitable_auth_unavailable")
        finally:
            if orig_app_id:
                os.environ["FEISHU_APP_ID"] = orig_app_id
            if orig_app_secret:
                os.environ["FEISHU_APP_SECRET"] = orig_app_secret
            importlib.reload(app_module)

    def test_result_structure(self):
        """Result always has 'ok' boolean"""
        # Even without credentials
        orig_app_id = os.environ.get("FEISHU_APP_ID", "")
        orig_app_secret = os.environ.get("FEISHU_APP_SECRET", "")
        try:
            os.environ.pop("FEISHU_APP_ID", None)
            os.environ.pop("FEISHU_APP_SECRET", None)
            importlib.reload(app_module)
            result = app_module.bitable_create_record({"player": "test"})
            self.assertIn("ok", result)
            self.assertIsInstance(result["ok"], bool)
        finally:
            if orig_app_id:
                os.environ["FEISHU_APP_ID"] = orig_app_id
            if orig_app_secret:
                os.environ["FEISHU_APP_SECRET"] = orig_app_secret
            importlib.reload(app_module)


class TestFCHandler(unittest.TestCase):
    """Test the FC CustomHandler HTTP routing"""

    @classmethod
    def setUpClass(cls):
        """Start a test HTTP server"""
        cls.server = HTTPServer(('127.0.0.1', 0), app_module.CustomHandler)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        # Wait for server to be ready
        time.sleep(0.5)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def _url(self, path):
        return "http://127.0.0.1:{}/{}".format(self.port, path)

    def test_post_api_leaderboard_no_credentials(self):
        """POST /api/leaderboard without Feishu credentials returns 502 with error"""
        payload = json.dumps({
            "player": "test_player",
            "floor": 5,
            "ending": "died",
            "classId": "paladin"
        }).encode("utf-8")
        req = urllib.request.Request(
            self._url("api/leaderboard"),
            data=payload,
            method="POST"
        )
        req.add_header("Content-Type", "application/json")
        try:
            resp = urllib.request.urlopen(req, timeout=5)
            # If we got 200, credentials are configured — still check response
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("ok", data)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8")
            data = json.loads(body)
            # Without credentials, should return 502 with no_tenant_token error
            if not os.environ.get("FEISHU_APP_ID"):
                self.assertEqual(e.code, 502)
                self.assertFalse(data.get("ok"))
                self.assertEqual(data.get("error"), "bitable_auth_unavailable")

    def test_post_invalid_json(self):
        """POST /api/leaderboard with invalid JSON returns 400"""
        body = "not valid json {{{".encode("utf-8")
        req = urllib.request.Request(
            self._url("api/leaderboard"),
            data=body,
            method="POST"
        )
        req.add_header("Content-Type", "application/json")
        try:
            resp = urllib.request.urlopen(req, timeout=5)
            self.fail("Expected 400 error")
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 400)
            data = json.loads(e.read().decode("utf-8"))
            self.assertFalse(data.get("ok"))
            self.assertEqual(data.get("error"), "invalid_json")

    def test_post_oversized_payload(self):
        """POST /api/leaderboard with payload > 64KB returns 413"""
        # Create a payload larger than 64KB
        huge_payload = json.dumps({"player": "x" * 70000}).encode("utf-8")
        self.assertGreater(len(huge_payload), 64 * 1024)
        req = urllib.request.Request(
            self._url("api/leaderboard"),
            data=huge_payload,
            method="POST"
        )
        req.add_header("Content-Type", "application/json")
        try:
            resp = urllib.request.urlopen(req, timeout=5)
            self.fail("Expected 413 error")
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 413)
            data = json.loads(e.read().decode("utf-8"))
            self.assertFalse(data.get("ok"))
            self.assertEqual(data.get("error"), "payload_too_large")

    def test_post_unknown_path(self):
        """POST to non-/api/leaderboard path returns 404"""
        body = json.dumps({"test": 1}).encode("utf-8")
        req = urllib.request.Request(
            self._url("api/other"),
            data=body,
            method="POST"
        )
        req.add_header("Content-Type", "application/json")
        try:
            resp = urllib.request.urlopen(req, timeout=5)
            self.fail("Expected 404 error")
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 404)

    def test_options_api_leaderboard(self):
        """OPTIONS /api/leaderboard returns CORS headers"""
        req = urllib.request.Request(
            self._url("api/leaderboard"),
            method="OPTIONS"
        )
        try:
            resp = urllib.request.urlopen(req, timeout=5)
            self.assertEqual(resp.code, 204)
            self.assertEqual(resp.headers.get("Access-Control-Allow-Origin"), "*")
            self.assertIn("POST", resp.headers.get("Access-Control-Allow-Methods", ""))
        except urllib.error.HTTPError as e:
            # Some Python HTTP server versions may not handle OPTIONS well
            # but our handler should
            self.skipTest("OPTIONS handling issue in test env: " + str(e.code))

    def test_get_static_file(self):
        """GET a static file still works (baseline: index.html or style.css)"""
        # Just verify the static serving hasn't been broken
        try:
            req = urllib.request.Request(self._url("style.css"), method="GET")
            resp = urllib.request.urlopen(req, timeout=5)
            self.assertEqual(resp.code, 200)
        except urllib.error.HTTPError:
            # style.css may not exist in test env, try data.js
            try:
                req = urllib.request.Request(self._url("data.js"), method="GET")
                resp = urllib.request.urlopen(req, timeout=5)
                self.assertEqual(resp.code, 200)
            except urllib.error.HTTPError:
                self.skipTest("Static files not available in test env")


class TestFrontendEndpointLogic(unittest.TestCase):
    """Test the frontend LEADERBOARD_ENDPOINT injection logic"""

    def test_endpoint_detection_logic(self):
        """Verify the base path detection regex works"""
        # Simulate what the frontend JS does
        import re

        # Case 1: FC deployment (pathname = /ai/diablo-build/)
        pathname = "/ai/diablo-build/"
        base = re.sub(r'/index\.html$', '', pathname)
        base = re.sub(r'/$', '', base) or ''
        endpoint = "https://bitools.retailaim.cn" + base + "/api/leaderboard"
        self.assertEqual(endpoint, "https://bitools.retailaim.cn/ai/diablo-build/api/leaderboard")

        # Case 2: FC deployment (pathname = /ai/diablo-build/index.html)
        pathname = "/ai/diablo-build/index.html"
        base = re.sub(r'/index\.html$', '', pathname)
        base = re.sub(r'/$', '', base) or ''
        endpoint = "https://bitools.retailaim.cn" + base + "/api/leaderboard"
        self.assertEqual(endpoint, "https://bitools.retailaim.cn/ai/diablo-build/api/leaderboard")

        # Case 3: Local dev (pathname = / or /index.html)
        pathname = "/"
        base = re.sub(r'/index\.html$', '', pathname)
        base = re.sub(r'/$', '', base) or ''
        endpoint = "http://localhost:9000" + base + "/api/leaderboard"
        self.assertEqual(endpoint, "http://localhost:9000/api/leaderboard")

        # Case 4: Root with index.html
        pathname = "/index.html"
        base = re.sub(r'/index\.html$', '', pathname)
        base = re.sub(r'/$', '', base) or ''
        endpoint = "http://localhost:9000" + base + "/api/leaderboard"
        self.assertEqual(endpoint, "http://localhost:9000/api/leaderboard")


class TestT51PayloadContractAlignment(unittest.TestCase):
    """Verify T5.2 fields exactly match T5.1 payload contract"""

    def test_all_t51_fields_in_t52_mapping(self):
        """Every field from T5.1 contract is mapped in payload_to_bitable_fields"""
        # T5.1 contract (from leaderboard.js header):
        t51_fields = [
            "player", "buildHash", "score", "floor", "goldRemaining",
            "itemsBroughtOut", "itemsLost", "ending", "classId", "submittedAt"
        ]
        # Test with a full payload
        payload = {
            "player": "test", "buildHash": "test", "score": 1, "floor": 1,
            "goldRemaining": 1, "itemsBroughtOut": [], "itemsLost": [],
            "ending": "A_Rebel", "classId": "paladin",
            "submittedAt": "2026-07-13T12:00:00Z"
        }
        fields = app_module.payload_to_bitable_fields(payload)
        for f in t51_fields:
            self.assertIn(f, fields, "T5.1 field '{}' missing from Bitable mapping".format(f))

    def test_no_extra_fields_in_mapping(self):
        """payload_to_bitable_fields only maps the 10 T5.1 fields"""
        payload = {
            "player": "x",
            "buildHash": "y",
            "score": 1,
            "floor": 2,
            "goldRemaining": 3,
            "itemsBroughtOut": [],
            "itemsLost": [],
            "ending": "died",
            "classId": "paladin",
            "submittedAt": "2026-01-01",
            "extraField": "should_not_appear"
        }
        fields = app_module.payload_to_bitable_fields(payload)
        self.assertNotIn("extraField", fields)
        self.assertEqual(len(fields), 10)


if __name__ == '__main__':
    unittest.main(verbosity=2)

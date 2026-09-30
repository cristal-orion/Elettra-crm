import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import urllib.error
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("coolify_ops", Path(__file__).with_name("coolify_ops.py"))
ops = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ops)


class OperationalTests(unittest.TestCase):
    def test_monitor_detects_maintenance_lock(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(ops, "STATE", Path(directory)):
            self.assertFalse(ops.maintenance_active())
            with ops.maintenance_lock():
                self.assertTrue(ops.maintenance_active())
            self.assertFalse(ops.maintenance_active())

    def test_readiness_wait_handles_proxy_warmup(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return b'{"status":"ready"}'
        with patch.object(ops.urllib.request, "urlopen", side_effect=[urllib.error.URLError("warming up"), Response()]) as request, patch.object(ops.time, "sleep"):
            ops.wait_ready({"app_origin": "https://crm.example.test"})
            self.assertEqual(request.call_count, 2)

    def test_restart_on_backup_failure(self):
        calls = []
        def docker(*args, **kwargs):
            calls.append(args)
            return ""
        with patch.object(ops, "no_deployment"), patch.object(ops, "active", return_value=["a", "b"]), patch.object(ops, "docker", side_effect=docker):
            with self.assertRaises(RuntimeError):
                with ops.stopped_app({}):
                    raise RuntimeError("dump failed")
        self.assertEqual(calls[-2:], [("start", "a"), ("start", "b")])

    def test_deployment_guard_prevents_stop(self):
        with patch.object(ops, "no_deployment", side_effect=ops.OpsError("deployment")), patch.object(ops, "docker") as docker:
            with self.assertRaises(ops.OpsError):
                with ops.stopped_app({}):
                    self.fail("must not enter")
            docker.assert_not_called()

    def test_private_state_is_atomic_and_restricted(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "runtime.json"
            ops.private_json(file, {"secret": "test-only"})
            ops.private_json(file, {"secret": "second-test-only"})
            self.assertEqual(json.loads(file.read_text()), {"secret": "second-test-only"})
            self.assertEqual(file.stat().st_mode & 0o777, 0o600)
            self.assertEqual(list(Path(directory).iterdir()), [file])

    def test_command_errors_do_not_disclose_credentials(self):
        with patch.object(subprocess, "run", return_value=subprocess.CompletedProcess([], 1, "", "secret-password-in-stderr")):
            with self.assertRaises(ops.OpsError) as caught:
                ops.run(["docker", "run", "--env", "SECRET=secret-password"])
            self.assertNotIn("secret-password", str(caught.exception))

    def test_upload_manifest_detects_corruption_and_symlinks(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "doc.pdf"
            file.write_bytes(b"original")
            before = ops.uploads_manifest(directory)
            file.write_bytes(b"changed")
            self.assertNotEqual(before, ops.uploads_manifest(directory))
            (Path(directory) / "link").symlink_to(file)
            with self.assertRaises(ops.OpsError):
                ops.uploads_manifest(directory)

    def test_failed_restore_drops_only_temporary_database(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory)
            bundle = state / "bundle"
            bundle.mkdir()
            (bundle / "manifest.json").write_text(json.dumps({"rows": {"User": 1}, "uploads": {}}))
            (state / "last-backup.json").write_text(json.dumps({"bundle": str(bundle)}))
            config = {"backup_database_url": "postgresql://test-only@db:5432/elettra", "ops_dir": directory}
            commands = []
            with patch.object(ops, "STATE", state), patch.object(ops, "load", return_value=config), patch.object(ops, "psql", side_effect=lambda c, sql, **kw: commands.append((sql, kw)) or ""), patch.object(ops, "docker", side_effect=ops.OpsError("restore failed")):
                with self.assertRaises(ops.OpsError):
                    ops.restore_check(None)
            self.assertRegex(commands[0][0], '^CREATE DATABASE "elettra_verify_[a-f0-9]+" OWNER elettra;$')
            self.assertRegex(commands[-1][0], '^DROP DATABASE "elettra_verify_[a-f0-9]+" WITH \\(FORCE\\);$')
            self.assertEqual(commands[-1][1]["database"], "postgres")


if __name__ == "__main__":
    unittest.main()

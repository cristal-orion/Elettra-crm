"""Regressioni del riconoscimento istanza: nessun container reale modificato."""
import unittest
from unittest.mock import patch

import coolify_ops as ops


class ActiveApplicationTest(unittest.TestCase):
    def resolve(self, modern="", legacy="", previews=None):
        config = {"app_uuid": "target-uuid", "app_id": 19}
        responses = {
            "label=coolify.applicationUuid=target-uuid": modern,
            "label=coolify.applicationId=19": legacy,
        }
        previews = previews or {}

        def docker(*args):
            self.assertEqual(args[0:2], ("ps", "--filter"))
            self.assertEqual(args[3:], ("--format", "{{.ID}}"))
            return responses[args[2]]

        def inspect(container):
            return {"Config": {"Labels": previews.get(container, {})}}

        with patch.object(ops, "docker", side_effect=docker), patch.object(ops, "inspect", side_effect=inspect):
            return ops.active(config)

    def test_current_coolify_uuid_label(self):
        self.assertEqual(self.resolve(modern="live"), ["live"])

    def test_legacy_numeric_label(self):
        self.assertEqual(self.resolve(legacy="live"), ["live"])

    def test_deduplicates_and_keeps_both_live_generations(self):
        self.assertEqual(self.resolve(modern="new\nshared", legacy="old\nshared"), ["new", "old", "shared"])

    def test_excludes_preview_containers(self):
        self.assertEqual(self.resolve(modern="live\npreview", previews={
            "live": {"coolify.pullRequestId": "0"},
            "preview": {"coolify.pullRequestId": "42"},
        }), ["live"])

    def test_stopped_application_has_no_active_containers(self):
        self.assertEqual(self.resolve(), [])


if __name__ == "__main__":
    unittest.main()

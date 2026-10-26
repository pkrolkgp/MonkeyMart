"""Public-safe regression tests for private Defold CI policy.

No game source files or proprietary assets are accessed.
"""
import unittest
from pathlib import Path


WORKFLOW = Path(__file__).resolve().parents[2] / ".github/workflows/private-defold-build.yml"


class TestPrivateBuildWorkflowPolicy(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workflow = WORKFLOW.read_text(encoding="utf-8")

    def test_private_guard_on_real_game_build(self):
        self.assertIn("compile-private-project:", self.workflow)
        build_job = self.workflow.split("compile-private-project:", 1)[1]
        self.assertIn("github.event.repository.private == true", build_job)
        self.assertIn("runs-on: macos-15", build_job)
        self.assertIn("--platform arm64-macos", build_job)
        self.assertIn("verify_bundle.py", build_job)

    def test_game_artifact_requires_explicit_redistribution_permission(self):
        marker = "- name: Publish private compiled app"
        self.assertIn(marker, self.workflow)
        publish_step = self.workflow.split(marker, 1)[1].split("- name:", 1)[0]
        self.assertIn("if: ${{ success()", publish_step)
        self.assertIn("github.event.repository.private == true", publish_step)
        self.assertIn("vars.MONKEYMART_DISTRIBUTION_AUTHORIZED == 'true'", publish_step)
        self.assertIn("actions/upload-artifact@v4", publish_step)
        self.assertIn("MonkeyMart-macOS-AppleSilicon", publish_step)


if __name__ == "__main__":
    unittest.main()

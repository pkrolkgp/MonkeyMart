"""Synthetic bundle verification tests: no copyrighted assets."""
import plistlib
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from verify_bundle import verify_bundle


def fake_app(root, name='Sample.app', executable='Game'):
    app = root / name
    binary = app / 'Contents' / 'MacOS' / executable
    binary.parent.mkdir(parents=True)
    binary.write_bytes(b'fake executable for mocked lipo')
    binary.chmod(0o755)
    with (app / 'Contents' / 'Info.plist').open('wb') as stream:
        plistlib.dump({'CFBundleExecutable': executable}, stream)
    return app, binary


class TestBundleVerification(unittest.TestCase):
    def test_valid_arm64_bundle(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            app, binary = fake_app(root)
            self.assertEqual(verify_bundle(root, lambda path: 'arm64\n'), app)
            self.assertEqual(verify_bundle(root, lambda path: 'x86_64 arm64\n'), app)

    def test_missing_or_ambiguous_bundle(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            with self.assertRaisesRegex(ValueError, 'exactly one'):
                verify_bundle(root, lambda path: 'arm64')
            fake_app(root)
            fake_app(root, 'Other.app')
            with self.assertRaisesRegex(ValueError, 'exactly one'):
                verify_bundle(root, lambda path: 'arm64')

    def test_missing_invalid_or_traversal_plist(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            app, _ = fake_app(root)
            plist = app / 'Contents' / 'Info.plist'
            plist.write_bytes(b'not a plist')
            with self.assertRaisesRegex(ValueError, 'Invalid macOS Info.plist'):
                verify_bundle(root, lambda path: 'arm64')
            with plist.open('wb') as stream:
                plistlib.dump({'CFBundleExecutable': '../outside'}, stream)
            with self.assertRaisesRegex(ValueError, 'Invalid CFBundleExecutable'):
                verify_bundle(root, lambda path: 'arm64')

    def test_empty_binary_and_wrong_architecture(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            _, binary = fake_app(root)
            with self.assertRaisesRegex(ValueError, 'arm64'):
                verify_bundle(root, lambda path: 'x86_64')
            binary.write_bytes(b'')
            with self.assertRaisesRegex(ValueError, 'empty'):
                verify_bundle(root, lambda path: 'arm64')

    def test_non_executable_binary_rejected(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            _, binary = fake_app(root)
            binary.chmod(0o644)
            with self.assertRaisesRegex(ValueError, 'execute permission'):
                verify_bundle(root, lambda path: 'arm64')

    def test_symlink_binary_rejected(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            _, binary = fake_app(root)
            binary.unlink()
            binary.symlink_to('/bin/sh')
            with self.assertRaisesRegex(ValueError, 'linked'):
                verify_bundle(root, lambda path: 'arm64')


if __name__ == '__main__':
    unittest.main()

"""Synthetic-only ZIP safety tests; no proprietary source or assets."""
import stat
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile, ZipInfo

from validate_source_zip import extract_source_zip, validate_source_zip


class TestSafeSourceExtraction(unittest.TestCase):
    def test_nested_project_extracts_without_guessing_folder_name(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            archive = root / 'synthetic.zip'
            with ZipFile(archive, 'w') as z:
                z.writestr('Example/src/game.project', '[project]\n')
                z.writestr('Example/src/main/test.script', 'print("synthetic")\n')
            dest = root / 'source-stage'
            self.assertEqual(extract_source_zip(archive, dest), 'Example/src/game.project')
            self.assertEqual((dest / 'Example/src/main/test.script').read_text(), 'print("synthetic")\n')
            with self.assertRaises(FileExistsError):
                extract_source_zip(archive, dest)

    def test_traversal_and_case_collisions_rejected_before_creating_destination(self):
        for names in (
            ('game.project', '../outside.txt'),
            ('game.project', 'A/asset', 'a/ASSET'),
            ('game.project', 'dir', 'dir/file'),
            ('game.project', 'folder\\escape.txt'),
            ('game.project', 'folder/./escape.txt'),
        ):
            with self.subTest(names=names), TemporaryDirectory() as tmp:
                root = Path(tmp)
                archive = root / 'synthetic.zip'
                with ZipFile(archive, 'w') as z:
                    for name in names:
                        z.writestr(name, 'synthetic')
                dest = root / 'stage'
                with self.assertRaises(ValueError):
                    extract_source_zip(archive, dest)
                self.assertFalse(dest.exists())


    def test_canonically_equivalent_unicode_names_rejected(self):
        # APFS/HFS+ can treat composed and decomposed names as equivalent.
        for names in (
            ('game.project', 'assets/café.png', 'assets/café.png'),
            ('game.project', 'café/file.png', 'café/other.png', 'café'),
        ):
            with self.subTest(names=names), TemporaryDirectory() as tmp:
                root = Path(tmp)
                archive = root / 'synthetic.zip'
                with ZipFile(archive, 'w') as z:
                    for name in names:
                        z.writestr(name, 'synthetic')
                dest = root / 'stage'
                with self.assertRaisesRegex(ValueError, 'Duplicate|collision'):
                    extract_source_zip(archive, dest)
                self.assertFalse(dest.exists())

    def test_symlink_is_rejected(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            archive = root / 'synthetic.zip'
            link = ZipInfo('assets/link')
            link.create_system = 3
            link.external_attr = (stat.S_IFLNK | 0o777) << 16
            with ZipFile(archive, 'w') as z:
                z.writestr('game.project', '[project]')
                z.writestr(link, 'outside')
            with self.assertRaisesRegex(ValueError, 'link or special'):
                validate_source_zip(archive)

    def test_missing_or_multiple_project_files_rejected(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            archive = root / 'synthetic.zip'
            with ZipFile(archive, 'w') as z:
                z.writestr('a/game.project', '[project]')
                z.writestr('b/game.project', '[project]')
            with self.assertRaisesRegex(ValueError, 'exactly one'):
                validate_source_zip(archive)


if __name__ == '__main__':
    unittest.main()

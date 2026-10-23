"""Validate a user-provided Defold ZIP before CI extraction; no game assets."""
import argparse
import re
import stat
from pathlib import PurePosixPath
from zipfile import ZipFile

MAX_FILES = 50000
MAX_UNCOMPRESSED = 3 * 1024**3
MAX_ENTRY = 1024**3


def validate_source_zip(path):
    with ZipFile(path) as archive:
        entries = archive.infolist()
        if not entries or len(entries) > MAX_FILES:
            raise ValueError('Invalid ZIP entry count')
        seen, projects, total = set(), [], 0
        for entry in entries:
            name = entry.filename
            if (not name or name.startswith('/') or '\\' in name or
                    any(ord(char) < 32 or ord(char) == 127 for char in name) or
                    re.match(r'^[A-Za-z]:', name)):
                raise ValueError('Unsafe archive filename')
            parts = name.rstrip('/').split('/')
            if any(part in ('', '.', '..') for part in parts):
                raise ValueError('Unsafe archive path component')
            key = '/'.join(parts).casefold()
            if key in seen:
                raise ValueError('Duplicate or case-colliding archive path')
            seen.add(key)
            kind = stat.S_IFMT(entry.external_attr >> 16)
            if kind not in (0, stat.S_IFREG, stat.S_IFDIR):
                raise ValueError('ZIP contains a link or special file')
            total += entry.file_size
            if entry.file_size > MAX_ENTRY or total > MAX_UNCOMPRESSED:
                raise ValueError('ZIP exceeds safe extraction size')
            if not entry.is_dir() and PurePosixPath(name).name == 'game.project':
                projects.append(name)
        if len(projects) != 1:
            raise ValueError('Expected exactly one game.project')
        return projects[0]


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('archive')
    args = parser.parse_args()
    print(validate_source_zip(args.archive))

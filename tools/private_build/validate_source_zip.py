"""Validate a user-provided Defold ZIP before CI extraction; no game assets."""
import argparse
import re
import stat
import unicodedata
from pathlib import Path
from pathlib import PurePosixPath
from zipfile import ZipFile

MAX_FILES = 50000
MAX_UNCOMPRESSED = 3 * 1024**3
MAX_ENTRY = 1024**3


def filesystem_key(path):
    """Model case-insensitive, canonically equivalent names on macOS filesystems."""
    return unicodedata.normalize('NFD', path).casefold()


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
            key = filesystem_key('/'.join(parts))
            if key in seen:
                raise ValueError('Duplicate or case-colliding archive path')
            seen.add(key)
            kind = stat.S_IFMT(entry.external_attr >> 16)
            if kind not in (0, stat.S_IFREG, stat.S_IFDIR):
                raise ValueError('ZIP contains a link or special file')
            if kind == stat.S_IFDIR and not entry.is_dir():
                raise ValueError('Directory metadata conflicts with ZIP path')
            if entry.flag_bits & 1:
                raise ValueError('Encrypted ZIP entries are unsupported')
            total += entry.file_size
            if entry.file_size > MAX_ENTRY or total > MAX_UNCOMPRESSED:
                raise ValueError('ZIP exceeds safe extraction size')
            if not entry.is_dir() and PurePosixPath(name).name == 'game.project':
                projects.append(name)
        # A file cannot simultaneously be a parent directory of another entry.
        files = {filesystem_key(e.filename) for e in entries if not e.is_dir()}
        for name in seen:
            components = name.split('/')
            if any('/'.join(components[:i]) in files for i in range(1, len(components))):
                raise ValueError('ZIP file/directory path collision')
        if len(projects) != 1:
            raise ValueError('Expected exactly one game.project')
        return projects[0]


def extract_source_zip(archive_path, destination):
    """Validate first, then extract into a new directory with bounded writes."""
    project_path = validate_source_zip(archive_path)
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=False)
    total_written = 0
    with ZipFile(archive_path) as archive:
        for entry in archive.infolist():
            target = destination.joinpath(*entry.filename.rstrip('/').split('/'))
            if entry.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            written = 0
            with archive.open(entry) as source, target.open('xb') as output:
                while True:
                    chunk = source.read(1024 * 1024)
                    if not chunk:
                        break
                    written += len(chunk)
                    total_written += len(chunk)
                    if written > MAX_ENTRY or total_written > MAX_UNCOMPRESSED:
                        raise ValueError('ZIP extraction exceeds safe size')
                    output.write(chunk)
            if written != entry.file_size:
                raise ValueError('ZIP entry size mismatch')
    return project_path


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('archive')
    parser.add_argument('--extract-to', help='New directory for safe extraction')
    args = parser.parse_args()
    print(extract_source_zip(args.archive, args.extract_to) if args.extract_to else validate_source_zip(args.archive))

#!/usr/bin/env python3
"""Verify a Defold macOS .app has an actual Apple Silicon executable.

Uses only Python stdlib and Apple's lipo; contains no game assets.
"""
import argparse
import plistlib
import re
import subprocess
from pathlib import Path


def verify_bundle(build_root, inspect_arches=None):
    """Return the verified .app path or raise ValueError with an actionable reason."""
    build_root = Path(build_root)
    if not build_root.is_dir():
        raise ValueError(f'Build output directory missing: {build_root}')
    apps = sorted(p for p in build_root.rglob('*.app') if p.is_dir() and not p.is_symlink())
    if len(apps) != 1:
        raise ValueError(f'Expected exactly one macOS .app, found {len(apps)}')
    app = apps[0]
    plist_path = app / 'Contents' / 'Info.plist'
    if not plist_path.is_file() or plist_path.is_symlink():
        raise ValueError('App bundle has no regular Contents/Info.plist')
    try:
        with plist_path.open('rb') as stream:
            metadata = plistlib.load(stream)
    except (OSError, ValueError, TypeError, plistlib.InvalidFileException) as exc:
        raise ValueError('Invalid macOS Info.plist') from exc
    executable_name = metadata.get('CFBundleExecutable') if isinstance(metadata, dict) else None
    if (not isinstance(executable_name, str) or not executable_name or
            executable_name in ('.', '..') or '/' in executable_name or '\\' in executable_name):
        raise ValueError('Invalid CFBundleExecutable in Info.plist')
    binary = app / 'Contents' / 'MacOS' / executable_name
    if not binary.is_file() or binary.is_symlink() or binary.stat().st_size == 0:
        raise ValueError(f'Missing, empty or linked app executable: {executable_name}')
    if not (binary.stat().st_mode & 0o111):
        raise ValueError(f'App executable lacks execute permission: {executable_name}')
    if inspect_arches is None:
        def inspect_arches(path):
            result = subprocess.run(['lipo', '-archs', str(path)], capture_output=True,
                                    text=True, check=True, timeout=30)
            return result.stdout
    try:
        arches = inspect_arches(binary)
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        raise ValueError(f'Unable to inspect Mach-O architecture: {executable_name}') from exc
    if not isinstance(arches, str) or 'arm64' not in re.findall(r'\b[a-zA-Z0-9_]+\b', arches):
        raise ValueError(f'Expected Apple Silicon arm64 executable, got: {arches!r}')
    return app


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('build_root', type=Path)
    args = parser.parse_args()
    try:
        app = verify_bundle(args.build_root)
    except ValueError as exc:
        parser.exit(1, f'ERROR: {exc}\n')
    print(app)


if __name__ == '__main__':
    main()

"""Generic preflight for a user-provided Defold source ZIP. No game assets."""
from pathlib import Path
from zipfile import ZipFile


def validate_source_zip(path):
    with ZipFile(Path(path)) as archive:
        projects = [item.filename for item in archive.infolist() if item.filename.endswith('/game.project') or item.filename == 'game.project']
        if len(projects) != 1:
            raise ValueError('Expected exactly one Defold project')
        return projects[0]

#!/usr/bin/env python3
"""Validate previously recovered source without creating placeholder scenes/assets."""
import argparse
import configparser
import json
import re
from pathlib import Path

SCENES = (
    "main/audio_add.collection", "main/debug.collection",
    "main/screen_game/background2.collection", "main/screen_game/background3.collection",
    "main/screen_game/background4.collection", "main/screen_game/backgroundC.collection",
    "main/screen_game/backgroundH.collection",
)
ATLASES = ("background", "game", "dodik", "ui_game", "ui_main")
SPINE = ("animals", "effects", "monkeys", "props")
ROOT_FIELDS = {
    ("bootstrap", "main_collection"): ".collectionc",
    ("bootstrap", "render"): ".renderc",
    ("input", "game_binding"): ".input_bindingc",
}

def fix_project(filename):
    original = filename.read_text(encoding="utf-8")
    result, section, changed = [], None, 0
    for line in original.splitlines(keepends=True):
        sect = re.match(r"^\s*\[([^\]]+)\]\s*$", line.strip())
        if sect:
            section = sect.group(1).lower()
        match = re.match(r"^(\s*)([a-zA-Z0-9_#]+)(\s*=\s*)([^\r\n]*)(\r?\n?)$", line)
        if match:
            start, key, eq, value, newline = match.groups()
            required = ROOT_FIELDS.get((section, key.lower()))
            if required and value.strip() and not value.strip().endswith(required):
                if not value.strip().endswith(required[:-1]):
                    raise ValueError("Unexpected resource extension for " + section + "." + key)
                line = start + key + eq + value.strip() + "c" + newline
                changed += 1
        result.append(line)
    if changed:
        backup = filename.with_name(filename.name + ".backup-before-private-ci")
        if not backup.exists():
            backup.write_text(original, encoding="utf-8")
        filename.write_text("".join(result), encoding="utf-8")
    return changed

def prepare(project, source):
    if not (project / "game.project").is_file():
        raise ValueError("Source ZIP does not contain game.project")
    copied, blockers = [], []
    for rel in SCENES:
        destination = project / rel
        if not destination.is_file() and source and (source / rel).is_file():
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes((source / rel).read_bytes())
            copied.append(rel)
        if not destination.is_file():
            blockers.append(rel)
    changed = fix_project(project / "game.project")
    config = configparser.ConfigParser(interpolation=None, strict=False)
    config.read(project / "game.project", encoding="utf-8")
    root_verified = []
    for (section, key), ending in ROOT_FIELDS.items():
        path = config.get(section, key, fallback="").strip()
        if not path.startswith("/") or not path.endswith(ending):
            blockers.append("Invalid " + section + "." + key + ": " + path)
            continue
        original_path = path[1:-1]
        if (project / original_path).is_file():
            root_verified.append(original_path)
        else:
            blockers.append(original_path)
    for name in ATLASES:
        path = f"main/atlases/{name}.atlas"
        if not (project / path).is_file():
            blockers.append(path)
    versions = {}
    for name in SPINE:
        path = f"images/spine/{name}.spinejson"
        f = project / path
        if not f.is_file():
            blockers.append(path)
            continue
        try:
            version = json.loads(f.read_text(encoding="utf-8"))["skeleton"]["spine"]
        except (ValueError, KeyError, TypeError):
            blockers.append(path + ": invalid Spine JSON")
            continue
        versions[name] = version
        if not version.startswith("4.2."):
            blockers.append(path + ": requires Spine 4.2, found " + version)
    skins_added = 0
    for model in project.rglob("*.spinemodel"):
        text = model.read_text(encoding="utf-8")
        if not re.search(r"(?m)^\s*skin\s*:", text):
            model.write_text(text.rstrip("\n") + '\nskin: "default"\n', encoding="utf-8")
            skins_added += 1
    return {
        "scenes_added_from_original_resources": copied,
        "bootstrap_references_fixed": changed,
        "root_resources_verified": root_verified,
        "spine_skins_fixed": skins_added,
        "spine_versions": versions,
        "blockers": blockers,
    }

def main():
    p = argparse.ArgumentParser()
    p.add_argument("project", type=Path)
    p.add_argument("--restored", type=Path)
    p.add_argument("--report", type=Path, default=Path("private-preflight.json"))
    args = p.parse_args()
    report = prepare(args.project, args.restored)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    print("Original scenes restored:", len(report["scenes_added_from_original_resources"]))
    print("Root resources verified:", len(report["root_resources_verified"]))
    print("Spine skins repaired:", report["spine_skins_fixed"])
    print("Blockers:", len(report["blockers"]))
    for missing in report["blockers"]:
        print("BLOCKER: " + missing)
    return bool(report["blockers"])

if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Automated CI recovery of actual Defold LiveUpdate resources.

Reads the existing resources.zip in the checked-out repository. Decodes original
hashed resources using their signed manifest. Converts compiled .collectionc,
.goc, and .spritec protobuf messages into source with Defold's original
open-source .proto schemas. Recovered game resources remain ONLY on the CI
runner and are not uploaded as artifacts or committed.
"""
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import zipfile

# Same algorithm as the existing metadata audit (verified on real resources).
from audit_liveupdate import manifest_entries, unpack_lz4

PATH = Path("resources.zip")
OUT = Path(os.environ.get("RECOVERY_OUTPUT", "build/liveupdate-test"))
PROTOS = Path(__file__).resolve().parent / "defold-protos"

SCENES = [
    "main/audio_add.collection",
    "main/debug.collection",
    "main/screen_game/background2.collection",
    "main/screen_game/background3.collection",
    "main/screen_game/background4.collection",
    "main/screen_game/backgroundC.collection",
    "main/screen_game/backgroundH.collection",
]
TYPES = {
    ".collectionc": ("gameobject/gameobject_ddf.proto", "dmGameObjectDDF.CollectionDesc", ".collection"),
    ".goc": ("gameobject/gameobject_ddf.proto", "dmGameObjectDDF.PrototypeDesc", ".go"),
    ".spritec": ("gamesys/sprite_ddf.proto", "dmGameSystemDDF.SpriteDesc", ".sprite"),
}

def safe_path(uri):
    if not uri.startswith("/"):
        return None
    p = PurePosixPath(uri[1:])
    if not p.parts or any(part in ("..", ".") or ":" in part for part in p.parts):
        return None
    return str(p)

def strip_runtime_blocks(text):
    for field in ("component_types", "property_decls"):
        pattern = re.compile(r"(?m)^[ \t]*" + field + r"\s*\{")
        search = 0
        while (hit := pattern.search(text, search)) is not None:
            depth, quoted, escape = 0, False, False
            end = None
            for i in range(hit.end()-1, len(text)):
                char = text[i]
                if quoted:
                    if escape: escape = False
                    elif char == "\\": escape = True
                    elif char == '"': quoted = False
                elif char == '"': quoted = True
                elif char == "{": depth += 1
                elif char == "}":
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break
            if end is None: raise ValueError("unterminated " + field)
            if end < len(text) and text[end] == "\n": end += 1
            text = text[:hit.start()] + text[end:]
            search = hit.start()
    return text

def replace_extensions(text):
    # Built-in resource paths compiled in old Defold archives.
    changes = [
        (".a.texturesetc", ".atlas"),
        (".collectionc", ".collection"),
        (".spinemodelc", ".spinemodel"),
        (".spinescenec", ".spinescene"),
        (".spritec", ".sprite"),
        (".goc", ".go"),
        (".oggc", ".ogg"),
        (".soundc", ".sound"),
    ]
    for old, new in changes: text = text.replace(old, new)
    return text

def unpack(entry, content):
    if len(content) < 16: raise ValueError("missing LiveUpdateResourceHeader")
    if entry["flags"] & 4:
        raise ValueError("ENCRYPTED")
    result = content[16:]
    if entry["flags"] & 8:
        if len(result) != entry["compressed_size"]:
            raise ValueError("compressed size mismatch")
        result = bytes(unpack_lz4(result, entry["size"]))
    if len(result) != entry["size"]: raise ValueError("unpacked size mismatch")
    return result

def convert_source(path, data):
    for compiled, (descriptor, typename, target) in TYPES.items():
        if not path.endswith(compiled): continue
        command = [
            "protoc", "--proto_path=" + str(PROTOS),
            "--decode=" + typename, descriptor,
        ]
        result = subprocess.run(command, input=data, capture_output=True)
        if result.returncode:
            raise ValueError("protoc: " + result.stderr.decode("utf-8", errors="replace")[-450:])
        text = result.stdout.decode("utf-8")
        text = replace_extensions(strip_runtime_blocks(text))
        relative = path[:-len(compiled)] + target
        out = OUT / "source" / relative
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
        return relative
    return None

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(PATH) as z:
        manifest = manifest_entries(z.read("liveupdate.game.dmanifest"))
        filenames = set(z.namelist())
        recovered = []
        errors = []
        encrypted = 0
        converted = []
        for entry in manifest:
            if entry["hash"] not in filenames: continue
            rel = safe_path(entry["path"])
            if rel is None:
                errors.append({"path": entry["path"], "error": "unsafe URL"})
                continue
            if entry["flags"] & 4:
                encrypted += 1
                continue
            try:
                data = unpack(entry, z.read(entry["hash"]))
                recovered.append(rel)
                produced = convert_source(rel, data)
                if produced: converted.append(produced)
            except Exception as exc:
                errors.append({"path": rel, "error": str(exc)})
        recovered_set = set(converted)
        missing = [p for p in SCENES if p not in recovered_set]
        report = {
            "manifest_entries": len(manifest),
            "resources_decoded": len(recovered),
            "encrypted_skipped": encrypted,
            "source_files": sorted(converted),
            "scenes_expected": len(SCENES),
            "scenes_restored": [p for p in SCENES if p in recovered_set],
            "scenes_missing": missing,
            "errors": errors,
        }
        (OUT/"audit.json").write_text(json.dumps(report, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
        summary = ["# LiveUpdate: odzyskiwanie prawdziwych scen Monkey Mart", "",
                   "Tylko raport. Zasoby i zdekompilowany kod pozostają w tymczasowym katalogu CI.", "",
                   f"- Zdekodowane zasoby: **{len(recovered)}**",
                   f"- Zaszyfrowane (pominięte): **{encrypted}**",
                   f"- Odtworzone sceny: **{len(report['scenes_restored'])}/{len(SCENES)}**",
                   f"- Błędy konwersji: **{len(errors)}**",
                   "", "## Sceny", ""]
        for scene in SCENES:
            summary.append(("- ✅ " if scene in recovered_set else "- ❌ ") + "\x60"+scene+"\x60")
        if errors:
            summary += ["", "## Pierwsze błędy", ""]
            summary += [f"- {e['path']}: {e['error']}" for e in errors[:12]]
        result="\n".join(summary)+"\n"
        print(result)
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"],"a",encoding="utf-8") as f: f.write(result)
        return 1 if errors or missing else 0

if __name__=="__main__": sys.exit(main())

#!/usr/bin/env python3
"""Check Defold Live Update manifest against resources.zip. Metadata-only output."""
import json
import os
import sys
import zipfile
from pathlib import Path

# These paths were identified in the local Defold project-recovery audit.
MISSING = [
    "/_generated_1130c12bbc64f949.spinemodelc",
    "/_generated_4d3ca6caaa859cf6.spinemodelc",
    "/_generated_6febe36e4359bc0a.spinemodelc",
    "/_generated_d2460ee6ef2eee96.spinemodelc",
    "/main/atlases/background.a.texturesetc",
    "/main/atlases/dodik.a.texturesetc",
    "/main/atlases/game.a.texturesetc",
    "/main/atlases/ui_game.a.texturesetc",
    "/main/atlases/ui_main.a.texturesetc",
    "/main/audio_add.collection",
    "/main/debug.collection",
    "/main/fonts/main.fontc",
    "/main/gamecore/animal.spinemodelc",
    "/main/screen_game/background2.collection",
    "/main/screen_game/background3.collection",
    "/main/screen_game/background4.collection",
    "/main/screen_game/backgroundC.collection",
    "/main/screen_game/backgroundH.collection",
]

def varint(blob, p):
    value = 0
    for i in range(10):
        if p == len(blob):
            raise ValueError("Incomplete protobuf varint")
        byte = blob[p]
        p += 1
        value |= (byte & 127) << (7 * i)
        if byte < 128:
            return value, p
    raise ValueError("Invalid varint")

def fields(blob):
    p = 0
    while p < len(blob):
        tag, p = varint(blob, p)
        number, kind = tag >> 3, tag & 7
        if not number:
            raise ValueError("Invalid protobuf field tag")
        if kind == 0:
            value, p = varint(blob, p)
        elif kind == 2:
            length, p = varint(blob, p)
            if length > len(blob) - p:
                raise ValueError("Protobuf length beyond buffer")
            value = blob[p:p+length]
            p += length
        elif kind in (1, 5):
            length = 8 if kind == 1 else 4
            value = blob[p:p+length]
            p += length
        else:
            raise ValueError("Unsupported protobuf wire type " + str(kind))
        yield number, value

def grouped(blob):
    obj = {}
    for field, value in fields(blob):
        obj.setdefault(field, []).append(value)
    return obj

def first(obj, key, default=None):
    return obj.get(key, [default])[0]

def manifest_entries(blob):
    file_message = grouped(blob)
    data = first(file_message, 1)
    if not isinstance(data, bytes):
        raise ValueError("Not a Defold ManifestFile")
    contents = grouped(data)
    entries = []
    for raw in contents.get(3, []):
        item = grouped(raw)
        digest = first(grouped(first(item, 1, b"")), 1, b"").hex()
        url = first(item, 2, b"").decode("utf-8")
        if digest and url:
            entries.append({
                "hash": digest,
                "path": url,
                "size": first(item, 4, 0),
                "compressed_size": first(item, 5, 0),
                "flags": first(item, 6, 0),
            })
    if not entries:
        raise ValueError("No resource entries in manifest")
    return entries

def unpack_lz4(blob, size):
    # Defold LiveUpdate stores raw LZ4 blocks, not LZ4 frames.
    p = 0
    output = bytearray()
    while p < len(blob):
        token = blob[p]
        p += 1
        literals = token >> 4
        if literals == 15:
            while True:
                if p >= len(blob):
                    raise ValueError("Truncated LZ4 literal run")
                more = blob[p]
                p += 1
                literals += more
                if more != 255:
                    break
        if literals > len(blob) - p:
            raise ValueError("LZ4 literals exceed input")
        output.extend(blob[p:p+literals])
        p += literals
        if p == len(blob):
            break
        if p + 2 > len(blob):
            raise ValueError("Truncated LZ4 offset")
        distance = blob[p] | (blob[p+1] << 8)
        p += 2
        if not distance or distance > len(output):
            raise ValueError("Invalid LZ4 offset")
        count = (token & 15) + 4
        if (token & 15) == 15:
            while True:
                if p >= len(blob):
                    raise ValueError("Truncated LZ4 match")
                more = blob[p]
                p += 1
                count += more
                if more != 255:
                    break
        for _ in range(count):
            output.append(output[-distance])
            if len(output) > size:
                raise ValueError("LZ4 expanded beyond expected size")
    if len(output) != size:
        raise ValueError("LZ4 output size mismatch")
    return output

def run():
    package = Path("resources.zip")
    if not package.is_file():
        raise FileNotFoundError("resources.zip not found in repository")
    with zipfile.ZipFile(package) as archive:
        names = set(archive.namelist())
        if "liveupdate.game.dmanifest" not in names:
            raise ValueError("ZIP has no liveupdate.game.dmanifest")
        resources = manifest_entries(archive.read("liveupdate.game.dmanifest"))
        for obj in resources:
            obj["in_zip"] = obj["hash"] in names
            obj["status"] = "not present in ZIP"
            if not obj["in_zip"]:
                continue
            try:
                data = archive.read(obj["hash"])
                if len(data) < 16:
                    raise ValueError("Missing 16-byte LiveUpdate header")
                data = data[16:]
                if obj["flags"] & 4:
                    obj["status"] = "encrypted; not verified"
                    continue
                if obj["flags"] & 8:
                    if len(data) != obj["compressed_size"]:
                        raise ValueError("Compressed length mismatch")
                    data = unpack_lz4(data, obj["size"])
                if len(data) != obj["size"]:
                    raise ValueError("Uncompressed length mismatch")
                obj["status"] = "verified"
            except Exception as err:
                obj["status"] = "ERROR: " + str(err)
    paths = {x["path"] for x in resources if x["status"] == "verified"}
    compared = []
    for missing in MISSING:
        options = {missing}
        if missing.endswith(".collection"):
            options.add(missing + "c")
        compared.append({"original": missing, "found": sorted(options & paths)})
    total = len(resources)
    verified = sum(x["status"] == "verified" for x in resources)
    zipped = sum(x["in_zip"] for x in resources)
    errors = [x for x in resources if x["in_zip"] and x["status"] != "verified"]
    found = sum(bool(x["found"]) for x in compared)
    folder = Path("reports")
    folder.mkdir(exist_ok=True)
    report = {"manifest_count": total, "zip_count": zipped, "verified": verified,
              "errors": len(errors), "resolved_out_of_18": found,
              "missing_dependencies": compared, "resources": resources}
    (folder / "liveupdate.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    backtick = chr(96)
    md = ["# Monkey Mart: audyt resources.zip", "",
          "Bez publikowania odzyskanych plików gry.", "",
          f"**Manifest:** {total} | **W ZIP:** {zipped} | **Zweryfikowane:** {verified} | **Problemy:** {len(errors)}",
          "", f"**Z 18 brakujących zależności znaleziono: {found}.**",
          "", "## Zależności", "",
          "| Brakująca ścieżka | Jest w Live Update? |", "|---|---|"]
    for x in compared:
        located = ", ".join(backtick + s + backtick for s in x["found"]) or "Nie"
        md.append("| " + backtick + x["original"] + backtick + " | " + located + " |")
    md += ["", "## Zweryfikowane pliki Live Update", "",
           "| Ścieżka | Bajty | Status |", "|---|---:|---|"]
    for x in resources:
        if x["in_zip"]:
            md.append("| " + backtick + x["path"] + backtick + f" | {x['size']} | {x['status']} |")
    report_text = "\n".join(md) + "\n"
    (folder / "liveupdate.md").write_text(report_text, encoding="utf-8")
    summary_file = os.getenv("GITHUB_STEP_SUMMARY")
    if summary_file:
        with open(summary_file, "a", encoding="utf-8") as f:
            f.write(report_text)
    print(f"Manifest {total}; in ZIP {zipped}; verified {verified}; errors {len(errors)}")
    print(f"Previously missing dependencies recovered: {found}/18")
    print("GitHub Actions: open job Summary to see full report.")
    return 1 if errors else 0

if __name__ == "__main__":
    try:
        sys.exit(run())
    except Exception as exc:
        print("ERROR:", exc, file=sys.stderr)
        sys.exit(1)

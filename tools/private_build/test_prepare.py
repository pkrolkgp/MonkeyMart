"""Non-proprietary regression tests; CI executes on both public and private repos."""
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from prepare import prepare, fix_project, SCENES, ATLASES, SPINE

class TestPrivateProjectBuild(unittest.TestCase):
    def test_defold_resource_suffixes(self):
        with TemporaryDirectory() as tmp:
            f = Path(tmp)/"game.project"
            f.write_text("[bootstrap]\nmain_collection = /main/start.collection\nrender = /a/render.render\n[input]\ngame_binding = /input/a.input_binding\n")
            self.assertEqual(fix_project(f), 3)
            self.assertEqual(fix_project(f), 0)
            self.assertIn("/main/start.collectionc", f.read_text())
            self.assertIn("/a/render.renderc", f.read_text())
            self.assertIn("/input/a.input_bindingc", f.read_text())
            self.assertTrue((f.parent/"game.project.backup-before-private-ci").exists())

    def test_real_scenes_are_copied_and_missing_atlases_block_build(self):
        with TemporaryDirectory() as tmp:
            base = Path(tmp)
            project, source = base/"project", base/"recovered"
            project.mkdir()
            (project/"game.project").write_text(
                "[bootstrap]\nmain_collection = /main/start.collectionc\nrender = /main/fx.renderc\n"
                "[input]\ngame_binding = /input/a.input_bindingc\n"
            )
            for name in ("main/start.collection", "main/fx.render", "input/a.input_binding"):
                f=project/name; f.parent.mkdir(parents=True,exist_ok=True); f.write_text("valid")
            for name in SCENES:
                f=source/name; f.parent.mkdir(parents=True,exist_ok=True); f.write_text("original")
            for name in SPINE:
                f=project/f"images/spine/{name}.spinejson"
                f.parent.mkdir(parents=True,exist_ok=True)
                f.write_text(json.dumps({"skeleton":{"spine":"4.2.11"}}))
            model=project/"effect.spinemodel"; model.write_text('default_animation: "idle"\n')
            first=prepare(project,source)
            self.assertEqual(len(first["scenes_added_from_original_resources"]),7)
            self.assertEqual(first["spine_skins_fixed"],1)
            self.assertEqual(len(first["blockers"]),5)
            for name in ATLASES:
                path=f"main/atlases/{name}.atlas"
                self.assertIn(path, first["blockers"])
                f=project/path; f.parent.mkdir(parents=True, exist_ok=True); f.write_text('images: "/image.png"\n')
            self.assertFalse(prepare(project,source)["blockers"])

if __name__=="__main__":
    unittest.main()

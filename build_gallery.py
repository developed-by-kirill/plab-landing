from pathlib import Path
root = Path(__file__).resolve().parent
shaders = (root / "gallery-shaders.js").read_text(encoding="utf-8")
runtime = (root / "gallery-runtime.js").read_text(encoding="utf-8-sig")
(root / "dist/gallery.js").write_text("// Morph Gallery\n(()=>{\n" + shaders + runtime + "\n})();\n", encoding="utf-8")

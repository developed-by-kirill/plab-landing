"""Retain the supplied shader verbatim and adapt the gallery to static HTML."""
from pathlib import Path
import re

source = Path(r'C:\Users\ikiri\.codex\attachments\153e3f05-1e0a-4cb2-9861-8eaaea466567\Вставленный текст.txt').read_text(encoding='utf-8')
shaders = '\n'.join('const '+name+' = `'+re.search(r'const '+name+r' = `([\s\S]*?)`', source).group(1)+'`;' for name in ['VERT', 'FRAG'])
target = Path(__file__).parent / 'dist/gallery.js'
runtime = (Path(__file__).parent / 'gallery-runtime.js').read_text(encoding='utf-8')
target.write_text('// Shader from the supplied MorphGallery reference.\n(()=>{\n'+shaders+'\n'+runtime+'\n})();\n', encoding='utf-8')

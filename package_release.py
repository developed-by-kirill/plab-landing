"""Package an already exported release and refresh the landing download manifest."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

root = Path(__file__).resolve().parent.parent
version = re.search(r'config/version="([^"]+)"', (root / 'project.godot').read_text(encoding='utf-8')).group(1)
release = root / 'build/landing-release'
downloads = root / 'landing/dist/downloads'
downloads.mkdir(parents=True, exist_ok=True)
sha = lambda data: hashlib.sha256(data).hexdigest()
files = {name: sha((release / name).read_bytes()) for name in ('PLab.exe', 'PLab.pck')}
source = hashlib.sha256()
for path in sorted([root / 'project.godot', *root.glob('scripts/**/*.gd'), *root.glob('scenes/**/*.tscn')]):
    source.update(path.relative_to(root).as_posix().encode())
    source.update(path.read_bytes())
metadata = {'version': version, 'platform': 'Windows x64', 'source_sha256': source.hexdigest(), 'files_sha256': files}
(release / 'RELEASE.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
guide = (root / 'docs/user_guide.md').read_text(encoding='utf-8')
(downloads / 'Инструкция-PLab.txt').write_text(guide, encoding='utf-8-sig')
archive = root / f'build/releases/PLab-{version}-Windows-x64.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name in ('PLab.exe', 'PLab.pck', 'RELEASE.json'):
        z.write(release / name, f'PLab-{version}/{name}')
    z.writestr(f'PLab-{version}/Инструкция.txt', guide.encode('utf-8-sig'))
data = archive.read_bytes()
parts = []
for i, offset in enumerate(range(0, len(data), 20 * 1024 * 1024)):
    chunk = data[offset:offset + 20 * 1024 * 1024]
    name = f'PLab-{version}.part{i+1}'
    (downloads / name).write_bytes(chunk)
    parts.append({'url': name, 'size_bytes': len(chunk), 'sha256': sha(chunk)})
metadata.update(filename=archive.name, size_bytes=len(data), sha256=sha(data), parts=parts)
(downloads / 'release.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
print(json.dumps({'archive': str(archive), 'size_bytes': len(data), 'version': version, 'sha256': sha(data)}))

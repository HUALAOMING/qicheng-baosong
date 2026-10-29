"""Create a separate local delivery after the final test runs; never publishes."""
from pathlib import Path
from hashlib import sha256
import json, re, shutil, zipfile

root = Path(__file__).resolve().parent.parent
output = root.parent / 'deliverables-5.3.0-final-polish'
evidence = root / 'docs' / 'final-polish-evidence'
output.mkdir(exist_ok=True)
evidence.mkdir(parents=True, exist_ok=True)
node = (root / 'tests/generated/final-node-output.txt').read_text(encoding='utf-8-sig')
browser = (root / 'tests/generated/final-browser-output.txt').read_text(encoding='utf-8-sig')
assert re.search(r'ℹ pass 302\b', node) and re.search(r'ℹ fail 0\b', node)
assert 'FAIL ' not in browser and '"status":"FAIL"' not in browser and 'errors":[]' in browser
for name in ('final-node-output.txt','final-browser-output.txt'):
    shutil.copy2(root / 'tests/generated' / name, evidence / name)
for name in ('pudding.png','obsidian.png'):
    shutil.copy2(root / 'tests/generated/home53' / name, evidence / ('home-' + name))
manifest = json.loads((root / 'data/static-resources.json').read_text(encoding='utf-8'))
for name, expected in manifest['hashes'].items():
    assert sha256((root / name).read_bytes()).hexdigest() == expected, name
portable = output / 'Qicheng-5.3.0-offline-final.html'
shutil.copy2(root / 'assets/editable-template.html', portable)
archive = output / 'qicheng-5.3.0-final-source.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for file in sorted(root.rglob('*')):
        relative = file.relative_to(root)
        if not file.is_file() or any(part in {'.git','node_modules','__pycache__'} for part in relative.parts) or relative.parts[:2] == ('tests','generated'):
            continue
        z.write(file, relative.as_posix())
receipt = {'revision':manifest['revision'],'resources':len(manifest['assets']),'nodeTestsPassed':302,
           'files':{file.name:{'bytes':file.stat().st_size,'sha256':sha256(file.read_bytes()).hexdigest()} for file in (portable,archive)},
           'published':False}
(output / 'DELIVERY_RECEIPT.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(receipt,ensure_ascii=False,indent=2))

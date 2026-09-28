"""Maintainer-only ingestion. Runtime never accesses the upstream library.

Fetches every catalogue part listed in scripts/catalog-parts.json plus its full
transitive dependency closure (subparts, primitives, hi/lo-res primitives) from
the official LDraw library into a new immutable pack directory, audits each
file's licence header and writes the pack manifest (hash, size, source, licence,
authors per file). Existing files in the pack directory are reused, so a rerun
is offline once complete. Afterwards run `npx tsx scripts/build-parts.ts`.

Usage: python3 scripts/fetch-library.py [release-id] [retrieved-date] [complete.zip]

The upstream server rate-limits individual file requests, so a locally
downloaded official archive (https://library.ldraw.org/library/updates/complete.zip)
can be given as a third argument; files missing from the pack directory are
then taken from the archive before falling back to individual requests. The
archive's hash is recorded in the manifest.
"""
import concurrent.futures
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import time
import zipfile

release = sys.argv[1] if len(sys.argv) > 1 else 'catalogue-2026-09-28'
retrieved = sys.argv[2] if len(sys.argv) > 2 else '2026-09-28'
root = pathlib.Path('public/libraries') / release
root.mkdir(parents=True, exist_ok=True)
base = 'https://library.ldraw.org/library/official/'
parts = [p[0] for p in json.loads(pathlib.Path('scripts/catalog-parts.json').read_text())['parts']]
assert len(parts) == len(set(parts)), 'duplicate catalogue part'
seen = {}
archive = zipfile.ZipFile(sys.argv[3]) if len(sys.argv) > 3 else None
archive_names = {n.lower(): n for n in archive.namelist()} if archive else {}
retrieved_from = ['https://library.ldraw.org/library/official/ (individual files)']
if archive:
    digest = hashlib.sha256(pathlib.Path(sys.argv[3]).read_bytes()).hexdigest()
    retrieved_from.append('https://library.ldraw.org/library/updates/complete.zip (sha256 ' + digest + ')')


def download(path):
    dest = root / path
    if dest.exists():
        return dest.read_bytes().decode('utf-8')
    member = archive_names.get(('ldraw/' + path).lower())
    if member:
        text = archive.read(member).decode('utf-8-sig')
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(text.encode('utf-8'))
        return text
    if archive and path != 'LDConfig.ldr':
        return None  # The official archive is complete: absent means no such file.
    for attempt in range(12):
        proc = subprocess.run(['curl', '-sSL', '--connect-timeout', '10', '--max-time', '30',
                               '-w', '\n%{http_code}', base + path], capture_output=True)
        body, _, status = proc.stdout.rpartition(b'\n')
        if status == b'200':
            break
        if status == b'404':
            return None
        # Rate limited (429) or transient failure: back off politely and retry.
        time.sleep(min(60, 5 * 2 ** attempt))
    else:
        raise RuntimeError('Download failed: ' + path)
    proc.stdout = body
    text = proc.stdout.decode('utf-8-sig')
    if not text.startswith('0'):
        raise ValueError('Not an LDraw file: ' + path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(text.encode('utf-8'))
    return text


def candidates(ref):
    """Library search order by reference shape: subparts live in parts/s/,
    numbered part files in parts/, everything else is a primitive in p/."""
    if ref.startswith('s/'):
        return ['parts/' + ref]
    if re.match(r'^(8|48)/', ref):
        return ['p/' + ref]
    if re.match(r'^\d', ref) and not re.match(r'^\d+-\d+', ref):
        return ['parts/' + ref, 'p/' + ref]
    return ['p/' + ref, 'parts/' + ref]


def resolve(ref):
    for path in candidates(ref):
        if path in seen:
            return path, seen[path]
        text = download(path)
        if text is not None:
            return path, text
    raise FileNotFoundError(ref)


pending = {p + '.dat' for p in parts}
roots = set(pending)
while pending:
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda ref: (ref, resolve(ref)), sorted(pending)))
    pending = set()
    for ref, (path, text) in results:
        if ref in roots and not path.startswith('parts/'):
            raise ValueError('Catalogue part is not a part file: ' + ref)
        seen[path] = text
        for line in text.splitlines():
            tok = line.split(maxsplit=14)
            if tok and tok[0] == '1' and len(tok) == 15:
                dep = tok[-1].strip().replace('\\', '/').lower()
                if not any(c in seen for c in candidates(dep)):
                    pending.add(dep)

seen['LDConfig.ldr'] = download('LDConfig.ldr')
files = []
for path, txt in sorted(seen.items()):
    licenses = [l.strip() for l in re.findall(r'^0 !LICENSE (.+)$', txt, re.M)]
    if path != 'LDConfig.ldr' and not licenses:
        raise ValueError('Missing licence ' + path)
    if any('CC BY 4.0' not in l and 'Redistributable' not in l for l in licenses):
        raise ValueError((path, licenses))
    kind = re.search(r'^0 !LDRAW_ORG (\S+)', txt, re.M)
    if path != 'LDConfig.ldr' and (not kind or kind.group(1).startswith('Unofficial')):
        raise ValueError('Not an official library file: ' + path)
    raw = (root / path).read_bytes()
    files.append(dict(path=path, sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw), source=base + path,
                      license=licenses, authors=[a.strip() for a in re.findall(r'^0 Author: (.+)$', txt, re.M)]))
manifest = dict(releaseId=release, retrieved=retrieved, retrievedFrom=retrieved_from, files=files, parts=[p + '.dat' for p in parts])
(root / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Audited {len(files)} files, {sum(f["bytes"] for f in files)} bytes, {len(parts)} catalogue parts')

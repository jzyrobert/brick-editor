"""Maintainer-only ingestion. Runtime never accesses the upstream library."""
import subprocess, urllib.request, pathlib, hashlib, json, re, concurrent.futures
root=pathlib.Path('public/libraries/starter-2026-09-27'); root.mkdir(parents=True,exist_ok=True)
base='https://library.ldraw.org/library/official/'
parts=['3001','3003','3004','3005','3020','3022']
seen={}
def fetch(path):
    dest=root/path
    if dest.exists(): return path,dest.read_text()
    text=subprocess.check_output(['curl','-fsSL','--retry','3',base+path]).decode('utf-8-sig')
    if not text.startswith('0'): raise ValueError(path)
    dest.parent.mkdir(parents=True,exist_ok=True); dest.write_text(text)
    return path,text
pending={'parts/'+p+'.dat' for p in parts}
while pending:
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results=list(pool.map(fetch, sorted(pending)))
    pending=set()
    for path,text in results:
        seen[path]=text
        for line in text.splitlines():
            tok=line.split(maxsplit=14)
            if tok and tok[0]=='1' and len(tok)==15:
                ref=tok[-1].replace('\\','/').lower()
                dep=('parts/' if ref.startswith('s/') or re.match(r'^\d+[a-z]*\.dat$',ref) and not ref.startswith('stud') else 'p/')+ref
                # Library subparts use s/, primitives otherwise. Numeric starter refs handled explicitly.
                if not ref.startswith('s/'): dep='p/'+ref
                if dep not in seen: pending.add(dep)
_,colors=fetch('LDConfig.ldr'); seen['LDConfig.ldr']=colors
files=[]
for path,txt in sorted(seen.items()):
    licenses=re.findall(r'^0 !LICENSE (.+)$',txt,re.M)
    if path!='LDConfig.ldr' and not licenses: raise ValueError('Missing licence '+path)
    if any('CC BY 4.0' not in l and 'Redistributable' not in l for l in licenses): raise ValueError((path,licenses))
    files.append(dict(path=path,sha256=hashlib.sha256(txt.encode()).hexdigest(),bytes=len(txt.encode()),source=base+path,license=licenses,authors=re.findall(r'^0 Author: (.+)$',txt,re.M)))
manifest=dict(releaseId=root.name,retrieved='2026-09-27',files=files,parts=[p+'.dat' for p in parts])
(root/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Audited {len(files)} files')

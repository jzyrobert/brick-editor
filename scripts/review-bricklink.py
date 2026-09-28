"""Maintainer-only evidence collection for the curated BrickLink mapping pack.

For every catalogue part in scripts/catalog-parts.json this records, from the
public BrickLink catalogue, the title of each candidate item number and the
colour ids BrickLink lists as known for that item. Candidates are the LDraw
number itself and, only as a lead for human review, the number without a
trailing mould letter. Nothing is accepted automatically: a maintainer sets
"itemId" in scripts/bricklink-review.json after comparing the titles with the
part, or leaves it null. build-parts.ts only maps parts with a reviewed itemId.

Existing reviewed entries are kept; only missing parts are fetched.
Usage: python3 scripts/review-bricklink.py [retrieved-date]
"""
import concurrent.futures
import html
import json
import pathlib
import re
import subprocess
import sys
import time

retrieved = sys.argv[1] if len(sys.argv) > 1 else '2026-09-28'
out = pathlib.Path('scripts/bricklink-review.json')
review = json.loads(out.read_text()) if out.exists() else {}
parts = json.loads(pathlib.Path('scripts/catalog-parts.json').read_text())['parts']
AGENT = 'Mozilla/5.0 (brick-editor catalogue review)'
# Known renumberings to look up as additional leads (still reviewed by hand).
LEADS = {'6141': ['4073']}


def get(url):
    for attempt in range(3):
        proc = subprocess.run(['curl', '-fsSL', '-A', AGENT, url], capture_output=True)
        if proc.returncode == 0:
            return proc.stdout.decode('utf-8', 'replace')
        time.sleep(2 + attempt * 3)
    raise RuntimeError(url)


def item(no):
    page = get('https://www.bricklink.com/v2/catalog/catalogitem.page?P=' + no)
    title = re.search(r'<title>(.*?)</title>', page, re.S)
    title = html.unescape(title.group(1).strip()) if title else ''
    if not title.endswith('| BrickLink') or ('Part ' + no) not in title:
        return None
    colors = get('https://www.bricklink.com/catalogColors.asp?itemType=P&itemNo=' + no)
    known = sorted({int(c) for c in re.findall(r'catalogitem\.page\?P=' + re.escape(no) + r'&idColor=(\d+)', colors)})
    return dict(title=title.replace(' | BrickLink', ''), knownColors=known,
                source='https://www.bricklink.com/v2/catalog/catalogitem.page?P=' + no,
                colorSource='https://www.bricklink.com/catalogColors.asp?itemType=P&itemNo=' + no)


def review_part(entry):
    ldraw = entry[0]
    stripped = re.sub(r'(?<=\d)[a-z]$', '', ldraw)
    found = {}
    for no in dict.fromkeys([ldraw, stripped, *LEADS.get(ldraw, [])]):
        found[no] = item(no)
    return ldraw, dict(name=entry[1], candidates=found, retrieved=retrieved, itemId=None)


todo = [p for p in parts if p[0] not in review]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for ldraw, data in pool.map(review_part, todo):
        review[ldraw] = data
        print(ldraw, '|', data['name'], '|', ' || '.join(
            f"{no}: {c['title'] if c else 'NOT FOUND'}" for no, c in data['candidates'].items()))
order = [p[0] for p in parts]
out.write_text(json.dumps({k: review[k] for k in order if k in review}, indent=2, ensure_ascii=False) + '\n')

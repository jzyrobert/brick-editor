"""Embed comparison images so the HTML preview works outside its checkout.
Run on the path-based index.html before embedding; keeps source/report links.
"""
from pathlib import Path
from html.parser import HTMLParser
import base64
import json
import re

root = Path(__file__).resolve().parent
page = root / 'index.html'
html = page.read_text()
if 'id="embedded-views"' in html:
    raise SystemExit('Preview already embeds its images; regenerate the path-based HTML first.')

class Images(HTMLParser):
    models = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'img' and 'data-model' in attrs:
            self.models.append(attrs['data-model'])

parser = Images()
parser.feed(html)
assert len(set(parser.models)) == 24
views = {}
for model in parser.models:
    views[model] = {}
    for view in ['iso', 'front', 'iso-back', 'top']:
        data = (root / model / (view + '.webp')).read_bytes()
        views[model][view] = 'data:image/webp;base64,' + base64.b64encode(data).decode()
    # The initial view works even if the preview host disables JavaScript.
    html = html.replace('src="' + model + '/iso.webp"', 'src="' + views[model]['iso'] + '"')
    html = html.replace('href="' + model + '/iso.webp"', 'href="' + views[model]['iso'] + '"')

script = '''<script id="embedded-views" type="application/json">''' + json.dumps(views, separators=(',', ':')) + '''</script>
<script>
const embeddedViews = JSON.parse(document.querySelector('#embedded-views').textContent);
document.querySelector('#view').addEventListener('change', event => {
  for (const img of document.querySelectorAll('[data-model]')) {
    img.src = embeddedViews[img.dataset.model][event.target.value];
  }
  for (const link of document.querySelectorAll('[data-view-link]')) {
    link.href = embeddedViews[link.dataset.viewLink][event.target.value];
  }
});
document.querySelector('#style').addEventListener('change', event => {
  for (const section of document.querySelectorAll('[data-style]')) {
    section.hidden = event.target.value !== 'all' && section.dataset.style !== event.target.value;
  }
});
</script>'''
viewer = """<dialog id="full-view" style="border:0;padding:12px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px)"><form method="dialog"><button style="min-width:44px;min-height:44px;font:inherit">Close image</button></form><img alt="Full-size build view" style="display:block;max-width:100%;height:auto"></dialog>"""
viewer_script = """
const fullView = document.querySelector('#full-view');
for (const link of document.querySelectorAll('[data-view-link]')) {
  link.addEventListener('click', event => {
    event.preventDefault();
    const source = link.querySelector('img');
    fullView.querySelector('img').src = source.src;
    fullView.querySelector('img').alt = source.alt;
    fullView.showModal();
  });
}
"""
html = html.replace('</main>', '</main>' + viewer)
script = script.replace('const embeddedViews', viewer_script + '\nconst embeddedViews', 1)
html, replaced = re.subn(r'<script>.*?</script>', lambda _: script, html, count=1, flags=re.S)
assert replaced == 1
page.write_text(html)
print(f'Embedded {len(views) * 4} views in {page.stat().st_size:,} bytes')

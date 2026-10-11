"""Portable comparison pages; every page embeds its own images."""
from pathlib import Path
import base64, json
from html import escape
from PIL import Image, ImageOps, ImageDraw, ImageFont
root=Path.cwd();dest=root/'docs/samples/format-size';metrics=json.loads((dest/'metrics.json').read_text());base=json.loads((root/'docs/samples/style-self-improvement/baseline.json').read_text())['cases']
subjects=['pelican','piplup','temple','dragon','destroyer','ewok'];views=['iso','front','iso-back','top'];variants=['format-1','reference-1','format-2','reference-2','baseline','repeat-2','repeat-3','budget']
history=json.loads((root/'docs/samples/style-directions/metrics.json').read_text())['cases']
review_file=dest/'assessment.json'
reviews={c['id']:c for c in json.loads(review_file.read_text())['cases']} if review_file.exists() else {}
labels={'baseline':'Historical E / diorama','budget':'Earlier target-free sizing','repeat-2':'Historical repeat 2','repeat-3':'Historical repeat 3','format-1':'Format first · run 1','reference-1':'Format + references · run 1','format-2':'Format first · run 2','reference-2':'Format + references · run 2'}
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',21)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',17)
data=lambda p:'data:image/webp;base64,'+base64.b64encode(p.read_bytes()).decode()
css='''body{margin:0;background:#faf8f4;color:#242424;font:16px system-ui}main{max-width:1800px;margin:auto;padding:20px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}article{background:white;border:1px solid #ddd;border-radius:10px;padding:12px;min-width:0}img{width:100%;height:auto}button,select{min-height:44px;font:inherit;max-width:100%}button,summary{cursor:pointer}summary{min-height:44px;display:flex;align-items:center}table{border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}.table-wrap{overflow:auto}a{color:#254c7f}nav{display:flex;flex-wrap:wrap;gap:16px;margin:16px 0}nav a{display:inline-flex;align-items:center;min-height:44px}.meta{color:#555;font-size:14px}dialog{max-width:94vw;max-height:94vh;padding:12px}dialog img{max-height:80vh;object-fit:contain}dialog::backdrop{background:#000b}[hidden]{display:none!important}@media(max-width:1100px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.grid{grid-template-columns:1fr}main{padding:12px}}'''
head=lambda title:f'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(title)}</title><style>{css}</style><main><h1>{escape(title)}</h1>'
nav='<nav><a href="index.html">Overview</a>'+''.join(f'<a href="{s}.html">{s.title()}</a>' for s in subjects)+'<a href="README.md">Report</a></nav>'
index=[head('Sol 6.1 high · Format-first sizing'),'<p>Format-first guidance alone versus the same guidance plus commercial piece-count references. Two independent runs per condition, six briefs and two styles; 48 clean text-only generations. Earlier builds are historical context, not contemporaneous controls.</p>',nav]
index.append(f'<p>{len(metrics["cases"])} of 48 results archived. Click a subject for all four views; images are embedded so previews also work as standalone files.</p>')
if review_file.exists():
    assessment=json.loads(review_file.read_text())
    if not assessment['complete']:
        index.append('<p>Review is incomplete. Conditions currently cover different subsets of briefs; their partial totals and averages are not directly comparable.</p>')
    index.append('<h2>Review</h2><p>Both repeats count equally. Subjective four-view assessment, not a buildability test or evidence of statistical significance.</p><div class="table-wrap"><table><thead><tr><th>Condition</th><th>Reviewed</th><th>Total score</th><th>Mean / 20</th><th>Median parts</th></tr></thead><tbody>')
    for row in assessment['summary']:
        if row['style']!='both':continue
        label='Format first' if row['variant']=='format' else 'Format + references'
        index.append(f'<tr><td>{label}</td><td>{row["reviewed"]}/24</td><td>{row["score"]}/{row["maximum"]}</td><td>{row["meanScore"]:.2f}</td><td>{row["medianParts"]:,.0f}</td></tr>')
    index.append('</tbody></table></div>')
    if assessment['complete']:
        index.append('<p><strong>Recommendation: keep defaults unchanged.</strong> The table has a small, mixed advantage: six brief/style means improve, two tie and four regress. It changes model size but does not reliably fix proportions or attachment errors. The report includes all counts and both repeats.</p>')

for subject in subjects:
    html=[head(subject.title()+' · Format-first sizing'),nav,'<p>Sol 6.1 high. Original brief only, independent starts; all renders are generated after model output. Zero compiler errors does not establish physical buildability.</p><label>Style <select id="style"><option value="all">Both styles</option><option value="lego">Lego-style</option><option value="diorama">Diorama</option></select></label> <label>View <select id="view"><option value="iso">Three-quarter</option><option value="front">Front</option><option value="iso-back">Back</option><option value="top">Top</option></select></label>']
    images={}
    for style in ['lego','diorama']:
        html.append(f'<section data-style="{style}"><h2>{style.title()}</h2><div class="grid">')
        rows=[]
        for variant in variants:
            historical=variant in ['baseline','budget','repeat-2','repeat-3']
            source=base if variant=='baseline' else history if historical else metrics['cases']
            c=next((x for x in source if x['style']==style and x['subject']==subject and (variant=='baseline' or (x['variant']==variant if historical else x['variant']+'-'+str(x['repeat'])==variant))),None)
            if not c:
                html.append(f'<article><h3>{labels[variant]}</h3><p>Pending</p></article>');continue
            d=root/c.get('artifact',c.get('source')); key=style+'-'+variant
            if not (d/'iso.webp').exists():
                html.append(f'<article><h3>{labels[variant]}</h3><p>No accepted render; see metrics for failure.</p></article>');continue
            images[key]={v:data(d/f'{v}.webp') for v in views}
            report=json.loads((d/'compile.json').read_text());count=c['parts'];title=report['title']
            path='../lego-style-study/'+('fresh-e' if style=='lego' else 'diorama')+'/sol-'+subject if variant=='baseline' else '../style-directions/'+c['id'] if historical else c['id']
            html.append(f'<article><h3>{labels[variant]}</h3><button data-enlarge="{key}" aria-label="Enlarge {escape(style+" "+labels[variant])}" style="border:0;background:transparent;padding:0;width:100%"><img data-model="{key}" src="{images[key]["iso"]}" alt="{escape(subject+" · "+style+" · "+labels[variant])}"></button><p>{escape(title)}</p><p class="meta">{count:,} parts · {sum(c["warnings"].values())} warning records</p><a href="{path}/build.js">Source</a> · <a href="{path}/prompt.md">Input</a> · <a href="{path}/compile.json">Report</a></article>')
            review=reviews.get(c['id']) if not historical else None
            if review:
                html[-1]=html[-1].replace('</article>',f'<details><summary>Review notes</summary><p>{escape(review["note"])}</p><p class="meta">Subjective score {review["score"]}/20; historical E/diorama samples {review["baselineRange"][0]}–{review["baselineRange"][1]}/20 ({review["baselineSamples"]} reviewed). Scores are not physical validation.</p></details></article>')
            rows.append((d,labels[variant],count,variant))
        html.append('</div></section>')
        if rows:
            # Four view rows, columns are conditions. This is also a simple PNG fallback.
            groups=[('',[r for r in rows if r[3] in ['format-1','reference-1','format-2','reference-2']]),('-history',[r for r in rows if r[3] in ['baseline','repeat-2','repeat-3','budget']])]
            for suffix,group in groups:
                if not group:continue
                canvas=Image.new('RGB',(600*len(group),4*500),'#faf8f4');draw=ImageDraw.Draw(canvas)
                for col,(d,label,count,variant) in enumerate(group):
                    for vi,view in enumerate(views):
                        draw.text((col*600+12,vi*500+8),f'{label} · {count:,}',font=small,fill='#242424')
                        im=ImageOps.contain(Image.open(d/f'{view}.webp').convert('RGB'),(600,450));canvas.paste(im,(col*600,vi*500+37))
                        draw.text((col*600+12,vi*500+475),view,font=small,fill='#444')
                canvas.save(dest/f'{style}-{subject}{suffix}.png')
    html.append('</main><dialog id="full"><button id="close">Close</button><img id="full-img" alt="Enlarged comparison"></dialog><script type="application/json" id="images">'+json.dumps(images,separators=(',',':'))+'</script>')
    html.append('''<script>const images=JSON.parse(document.querySelector('#images').textContent);const view=document.querySelector('#view');view.onchange=()=>{for(const img of document.querySelectorAll('[data-model]'))img.src=images[img.dataset.model][view.value]};document.querySelector('#style').onchange=e=>{for(const section of document.querySelectorAll('[data-style]'))section.hidden=e.target.value!=='all'&&section.dataset.style!==e.target.value};for(const b of document.querySelectorAll('[data-enlarge]'))b.onclick=()=>{document.querySelector('#full-img').src=images[b.dataset.enlarge][view.value];document.querySelector('#full').showModal()};document.querySelector('#close').onclick=()=>document.querySelector('#full').close();</script></html>''')
    (dest/f'{subject}.html').write_text(''.join(html))
    index.append(f'<h2><a href="{subject}.html">{subject.title()} — compare all conditions</a></h2><p><a href="lego-{subject}.png">Lego-style contact sheet</a> · <a href="diorama-{subject}.png">Diorama contact sheet</a></p>')
index.append('</main></html>');(dest/'index.html').write_text(''.join(index))
print('Wrote six portable pages and view contact sheets')

"""Summarize all cases, including failures; never select the better repetition."""
from pathlib import Path
from statistics import mean, median
import json
root=Path.cwd(); dest=root/'docs/samples/format-size'
protocol=json.loads((dest/'protocol.json').read_text())
metrics=json.loads((dest/'metrics.json').read_text())
rows=metrics['cases']; summary=[]
for variant in ['format','reference']:
    for style in ['lego','diorama','both']:
        selected=[r for r in rows if r['variant']==variant and (style=='both' or r['style']==style)]
        ok=[r for r in selected if r['accepted'] and 'parts' in r]
        expected=sum(c['variant']==variant and (style=='both' or c['style']==style) for c in protocol['cases'])
        summary.append(dict(variant=variant,style=style,expected=expected,finished=len(selected),accepted=len(ok),failed=len(selected)-len(ok),meanParts=mean(r['parts'] for r in ok) if ok else None,medianParts=median(r['parts'] for r in ok) if ok else None,meanSearches=mean(r['searches'] for r in ok) if ok else None,meanGenerationSeconds=mean(r['seconds'] for r in ok) if ok else None,compilerWarnings=sum(sum(r.get('warnings',{}).values()) for r in ok),blockedNativeToolAttempts=sum(len(r.get('blockedNativeToolAttempts',[])) for r in selected)))
comparisons=[]
for style in ['lego','diorama']:
    for subject in ['pelican','piplup','temple','dragon','destroyer','ewok']:
        groups={v:sorted([r for r in rows if r['style']==style and r['subject']==subject and r['variant']==v and r['accepted']],key=lambda r:r['repeat']) for v in ['format','reference']}
        if not all(len(g)==2 for g in groups.values()):continue
        counts={v:[r['parts'] for r in g] for v,g in groups.items()}
        comparisons.append(dict(style=style,subject=subject,parts=counts,referenceMeanCountRatio=mean(counts['reference'])/mean(counts['format'])))
(dest/'measurements.json').write_text(json.dumps(dict(complete=len(rows)==48,summary=summary,comparisons=comparisons,uniqueNativeSessions=metrics['uniqueNativeSessions']),indent=2)+'\n')
print(json.dumps({'finished':len(rows),'accepted':sum(r['accepted'] for r in rows)}))

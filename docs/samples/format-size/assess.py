"""Aggregate recorded reviews. Optional argument: private review-notes JSON.
With no argument, reuse public assessment notes. Never alters generated sources.
"""
from pathlib import Path
from statistics import mean, median
import json, sys
root=Path.cwd(); dest=root/'docs/samples/format-size'
metrics=json.loads((dest/'metrics.json').read_text())
original=json.loads((root/'docs/samples/style-self-improvement/baseline.json').read_text())['cases']
history=json.loads((root/'docs/samples/style-directions/assessment.json').read_text())['cases']
f=Path(sys.argv[1]) if len(sys.argv)>1 else dest/'assessment.json'
notes=json.loads(f.read_text()) if f.exists() else {}
if 'cases' in notes: notes={r['id']:{'scores':r['scores'],'note':r['note']} for r in notes['cases']}
rows=[]
for c in metrics['cases']:
    if c['id'] not in notes: continue
    n=notes[c['id']]; assert len(n['scores'])==5 and all(isinstance(s,int) and 0<=s<=4 for s in n['scores'])
    b=next(x for x in original if x['style']==c['style'] and x['subject']==c['subject'])
    controls=[b['score']]+[x['score'] for x in history if x['style']==c['style'] and x['subject']==c['subject'] and x['variant'] in ['repeat-2','repeat-3']]
    rows.append({**{k:c[k] for k in ['id','variant','repeat','style','subject','parts']},**n,'score':sum(n['scores']),'baselineRange':[min(controls),max(controls)],'baselineSamples':len(controls)})
summary=[]
for variant in ['format','reference']:
    for style in ['lego','diorama','both']:
        group=[r for r in rows if r['variant']==variant and (style=='both' or r['style']==style)]
        if not group: continue
        summary.append(dict(variant=variant,style=style,reviewed=len(group),score=sum(r['score'] for r in group),maximum=20*len(group),meanScore=mean(r['score'] for r in group),medianParts=median(r['parts'] for r in group),minParts=min(r['parts'] for r in group),maxParts=max(r['parts'] for r in group),repeatScores={str(k):sum(r['score'] for r in group if r['repeat']==k) for k in [1,2]}))
comparisons=[]
for style in ['lego','diorama']:
    for subject in ['pelican','piplup','temple','dragon','destroyer','ewok']:
        groups={v:sorted([r for r in rows if r['style']==style and r['subject']==subject and r['variant']==v],key=lambda r:r['repeat']) for v in ['format','reference']}
        if not all(len(g)==2 for g in groups.values()):continue
        scores={v:[r['score'] for r in g] for v,g in groups.items()};delta=mean(scores['reference'])-mean(scores['format'])
        comparisons.append(dict(style=style,subject=subject,scores=scores,parts={v:[r['parts'] for r in g] for v,g in groups.items()},referenceMeanDelta=delta,referenceAboveBothFormatRuns=min(scores['reference'])>max(scores['format']),referenceBelowBothFormatRuns=max(scores['reference'])<min(scores['format'])))
assessment=dict(complete=len(rows)==48,reviewed=len(rows),expected=48,axes=['recognition/proportions','intentional finish','composition','visible support','across-view consistency'],scale='Each axis 0–4. Unblinded subjective review; scores do not certify buildability or establish statistical significance.',summary=summary,comparisons=comparisons,referenceWinsByMean=sum(c['referenceMeanDelta']>0 for c in comparisons),referenceTiesByMean=sum(c['referenceMeanDelta']==0 for c in comparisons),referenceLossesByMean=sum(c['referenceMeanDelta']<0 for c in comparisons),cases=rows)
(dest/'assessment.json').write_text(json.dumps(assessment,indent=2)+'\n');print(json.dumps({'reviewed':len(rows),'complete':assessment['complete']}))

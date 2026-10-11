"""Summarize the recorded four-view reviews without changing generation artifacts.

Usage: python assess.py [path/to/review-notes.json]
Without an argument, reuse the published per-case reviews in assessment.json.
Scores are subjective editorial judgements, not automated physical validation.
"""
from pathlib import Path
from statistics import mean
import json
import sys

root = Path.cwd()
dest = root / 'docs/samples/style-directions'
metrics = json.loads((dest / 'metrics.json').read_text())
baseline = json.loads((root / 'docs/samples/style-self-improvement/baseline.json').read_text())['cases']
review_input = json.loads((Path(sys.argv[1]) if len(sys.argv) > 1 else dest / 'assessment.json').read_text())
notes = {c['id']: {'scores': c['scores'], 'note': c['note']} for c in review_input['cases']} if 'cases' in review_input else review_input
variants = ['budget', 'antipattern', 'facts', 'repeat-2', 'repeat-3', 'syntax']
rows = []
for case in metrics['cases']:
    if case['id'] not in notes:
        continue
    note = notes[case['id']]
    assert len(note['scores']) == 5 and all(0 <= s <= 4 for s in note['scores'])
    base = next(b for b in baseline if b['style'] == case['style'] and b['subject'] == case['subject'])
    controls = [base['score']]
    for repeat in ['repeat-2', 'repeat-3']:
        key = f"{repeat}-{case['style']}-{case['subject']}"
        if key in notes:
            controls.append(sum(notes[key]['scores']))
    score = sum(note['scores'])
    rows.append(dict(id=case['id'], style=case['style'], subject=case['subject'], variant=case['variant'],
                     scores=note['scores'], score=score, baselineScore=base['score'],
                     deltaFromRetained=score-base['score'], baselineSamples=len(controls),
                     baselineRange=[min(controls), max(controls)], baselineMean=mean(controls),
                     aboveObservedBaselineRange=score > max(controls),
                     belowObservedBaselineRange=score < min(controls), note=note['note']))
summary = []
for variant in variants:
    for style in ['lego', 'diorama', 'both']:
        selected = [r for r in rows if r['variant'] == variant and (style == 'both' or r['style'] == style)]
        if not selected:
            continue
        summary.append(dict(variant=variant, style=style, reviewed=len(selected),
                            score=sum(r['score'] for r in selected), baselineScore=sum(r['baselineScore'] for r in selected),
                            better=sum(r['deltaFromRetained'] > 0 for r in selected),
                            tied=sum(r['deltaFromRetained'] == 0 for r in selected),
                            worse=sum(r['deltaFromRetained'] < 0 for r in selected),
                            aboveRange=sum(r['aboveObservedBaselineRange'] for r in selected),
                            belowRange=sum(r['belowObservedBaselineRange'] for r in selected)))
assessment = dict(complete=len(rows) == 72, reviewed=len(rows), expected=72,
                  axes=['recognition/proportions', 'intentional finish', 'composition', 'visible support', 'across-view consistency'],
                  scale='Each axis 0–4; subjective four-view review. Scores are not physical certification or statistical evidence.',
                  limitations=['One sample per intervention; three unchanged-prompt controls per brief/style.',
                               'Retained baseline generated earlier. Reviews are unblinded.',
                               'Exposed studs and angular/pixel forms are valid when purposeful.',
                               'Warning counts are retained separately; zero compiler errors does not establish buildability.'],
                  summary=summary, cases=rows)
(dest / 'assessment.json').write_text(json.dumps(assessment, indent=2) + '\n')
print(json.dumps({'reviewed': len(rows), 'complete': assessment['complete']}))

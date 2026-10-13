#!/usr/bin/env python3
"""Export only public frozen artifacts from the three October 13 pilots."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

root = Path(__file__).resolve().parent.parent
read = lambda p: json.loads(p.read_text())

def copy_checked(source, target, sha):
    data = source.read_bytes()
    if hashlib.sha256(data).hexdigest() != sha:
        raise ValueError(f"Changed frozen file: {source}")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    out = parser.parse_args().out
    out.mkdir(parents=True, exist_ok=False)
    studies = root / 'fixtures/spatial-benchmark/studies'
    audit = read(studies / 'model-screening-pilot/results/exact-count-audit.json')
    cases, tasks, summaries = [], {}, []
    for model, location, label in [('sol', 'automatic-facts-pilot/results', 'Sol 6.1 · high'), ('luna', 'model-screening-pilot/results/luna', 'Luna · high'), ('astra', 'model-screening-pilot/results/astra', 'Astra · medium')]:
        base = studies / location
        report, evidence, manifest = [read(base / name) for name in ['report.json', 'evidence.json', 'manifest.json']]
        mapping = {r['caseId']: r for r in read(base / 'evaluation/private-mapping.json')}
        proofs = {r['caseId']: r for r in evidence['rows']}
        compliance = next(s for s in audit['summaries'] if s['model'] == model)
        count_checks = {r['caseId']: r['exactCount'] for r in compliance['rows']}
        if len(report['rows']) != (32 if model == 'sol' else 16):
            raise ValueError('Missing scheduled cases')
        for t in manifest['tasks']:
            tasks[t['id']] = {'id': t['id'], 'name': t['id'].replace('-', ' ').title(), 'brief': t['brief']}
        summaries.append({'id': model, 'label': label, 'conditions': compliance['conditions'], 'contrast': report['visualContrasts']})
        for row in report['rows']:
            case = row['caseId']; proof = proofs[case]; capture = mapping[case]
            valid = row['status'] == 'submitted' and count_checks[case]['status'] == 'verified'
            status = 'Compliant submission' if valid else 'Exact-count violation' if row['status'] == 'submitted' else 'Infrastructure failure' if row['status'] == 'infrastructure-failure' else 'Model failure'
            item = {'id': model+'--'+case, 'caseId': case, 'model': model, 'modelLabel': label, 'task': row['task'], 'condition': row['condition'], 'rep': int(case.split('--')[-1]), 'valid': valid, 'status': status, 'runnerStatus': row['status'], 'images': [], 'parts': (row.get('stats') or {}).get('parts'), 'score': row['visualTotal'] if valid else None, 'originalScore': row['visualTotal'], 'reason': proof.get('failure') or '', 'problems': row.get('problems') or [], 'assessment': row.get('visualAssessment')}
            if status == 'Exact-count violation': item['reason'] = '14 parts instead of the required 16. Originally marked submitted; its archived visual score is excluded from compliant summaries.'
            if capture.get('renderFailure') or len(capture['images']) not in [0,4]: raise ValueError('Incomplete frozen capture')
            for im in capture['images']:
                rel = f"images/{model}/{case}/{im['file']}"
                copy_checked(base / 'evaluation' / capture['id'] / im['file'], out / rel, im['sha256'])
                item['images'].append(rel)
            item['downloads'] = {}
            for filename, key in [('submission.txt','Original reply'), ('build.mpd','MPD'), ('script.json','Build script')]:
                source = base / 'cases' / case / filename
                if not source.exists(): continue
                sha = proof['files'].get(filename)
                if sha is None:
                    # The Sol archive records extracted script hashes separately.
                    if filename != 'script.json': raise ValueError('Missing hash')
                    compilation = read(base / 'cases' / case / 'compilation.json')
                    copy_checked(base / 'cases' / case / 'compilation.json', out / f'models/{model}/{case}/compilation.json', proof['files']['compilation.json'])
                    if read(source) != compilation['script']: raise ValueError('Extracted script differs')
                    sha = hashlib.sha256(source.read_bytes()).hexdigest()
                rel = f'models/{model}/{case}/{filename}'
                copy_checked(source, out / rel, sha); item['downloads'][key] = rel
            cases.append(item)
        shutil.copyfile(base / 'report.json', out / f'{model}-results.json')
    cases.sort(key=lambda c: (list(tasks).index(c['task']), c['rep'], ['sol','luna','astra'].index(c['model']), ['control','shape','connections','combined'].index(c['condition'])))
    payload = {'version':'spatial-screening-preview/1','tasks':list(tasks.values()), 'models':summaries, 'cases':cases}
    assert len(cases)==64 and sum(len(c['images']) for c in cases)==220 and sum(c['valid'] for c in cases)==46
    (out / 'data.json').write_text(json.dumps(payload, ensure_ascii=False)+'\n')
    for name in ['index.html','app.js']:
        shutil.copyfile(root / 'scripts/spatial-screening-preview' / name, out / name)
    shutil.copyfile(root / 'scripts/spatial-preview/style.css', out / 'style.css')
    shutil.copyfile(root / 'public/fonts/BricolageGrotesque.ttf', out / 'BricolageGrotesque.ttf')
    shutil.copyfile(root / 'public/notices/BRICOLAGE.txt', out / 'FONT-LICENSE.txt')
    shutil.copyfile(root / 'docs/SPATIAL-PILOT.md', out / 'report.md')
    (out / 'exact-count-audit.json').write_text(json.dumps(audit, indent=2)+'\n')
    hashes = {str(p.relative_to(out)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.rglob('*')) if p.is_file()}
    (out / 'asset-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n')
    print(json.dumps({'cases':len(cases),'compliant':sum(c['valid'] for c in cases),'rendered':sum(bool(c['images']) for c in cases),'images':220,'assets':len(hashes)}))

if __name__ == '__main__': main()

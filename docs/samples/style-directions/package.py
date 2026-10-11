"""Archive accepted unmodified submissions and audit isolated native sessions."""
from pathlib import Path
import hashlib, json, shutil
from collections import Counter
from PIL import Image
root=Path.cwd();dest=root/'docs/samples/style-directions';runs=root/'.local/style-directions/runs'
protocol=json.loads((dest/'protocol.json').read_text()); extra=json.loads((dest/'extra-protocol.json').read_text()); cases=protocol['cases']+extra['cases']; rows=[]; sessions=set()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for file,digest in protocol['files'].items():
    if sha(root/file)==digest: continue
    formatting=protocol.get('formattingUpdate',{})
    assert file==formatting.get('source') and digest==formatting['originalSha256'] and sha(root/formatting['snapshot'])==digest and sha(root/file)==formatting['formattedSha256'], ('Runner changed',file)
for c in cases:
    runs=root/('.local/style-directions/extra-runs' if c['variant'] in ['repeat-2','repeat-3','syntax'] else '.local/style-directions/runs')
    receipt=runs/(c['id']+'.receipt.json')
    if not receipt.exists(): continue
    receipt=json.loads(receipt.read_text()); p=runs/c['id']/'high'; d=dest/c['id'];d.mkdir(exist_ok=True)
    assert sha(root/'prompts'/c['promptFile'])==c['systemPromptSha256']
    assert sha(root/'prompts'/c['replyPromptFile'])==c['replyPromptSha256']
    result=p/'result.json'
    row={**c,'runnerSha256':protocol['transportUpdate']['initialRunnerSha256'] if c['id'] in protocol['transportUpdate']['initialRunnerCases'] else protocol['files']['scripts/one-shot-build.ts'],'accepted':False,'receipt':receipt,'artifact':str(d.relative_to(root))}
    if not result.exists(): rows.append(row);continue
    r=json.loads(result.read_text()); summary=json.loads((p.parent/'summary.json').read_text())
    assert r['model']=='gpt-6.1-sol' and r['effort']=='high' and r['runner']=='codex'
    assert summary['images']==[] and summary['targetParts']==c['target']
    assert summary['partFactsEnabled']==(c['variant']=='facts')
    assert not list((p/'empty').iterdir()) and all(not a['toolEvents'] for a in r['attempts'])
    ids=[]; searches=[]; blocked=[]
    for attempt in r['attempts']:
        events=[json.loads(x) for x in (p/f"attempt-{attempt['attempt']}.codex.jsonl").read_text().splitlines() if x.strip()]
        sid=next(x['thread_id'] for x in events if x['type']=='thread.started')
        assert sid not in sessions;sessions.add(sid);ids.append(sid)
        rollouts=list(Path('/home/ubuntu/.codex/sessions').glob('*/*/*/*'+sid+'*.jsonl'));assert len(rollouts)==1
        records=[json.loads(x) for x in rollouts[0].read_text().splitlines()]
        meta=next(x['payload'] for x in records if x['type']=='session_meta')
        turns=[x['payload'] for x in records if x['type']=='turn_context']
        assert meta['cwd']==str(p/'empty') and all(x['model']=='gpt-6.1-sol' and x['effort']=='high' for x in turns)
        for event in records:
            if event['type']!='response_item':continue
            payload=event['payload']
            if payload.get('type') in ['function_call','custom_tool_call']:
                replies=[e['payload'] for e in records if e['type']=='response_item' and e['payload'].get('call_id')==payload.get('call_id') and e['payload'].get('type') in ['function_call_output','custom_tool_call_output']]
                assert payload.get('name')=='exec' and len(replies)==1 and replies[0].get('output')=='code-mode host is disabled', ('Unverified native tool execution',c['id'])
                blocked.append(dict(sessionId=sid,name=payload['name'],callId=payload['call_id'],result=replies[0]['output']))
            for content in payload.get('content',[]):
                if isinstance(content,dict):assert content.get('type') not in ['input_image','image']
            if payload.get('role')=='user':
                assert 'AGENTS.md instructions for' not in json.dumps(payload)
                texts=[x.get('text','') for x in payload.get('content',[]) if isinstance(x,dict)]
                for text in texts:
                    if text.startswith('Search results:'): searches.append(dict(attempt=attempt['attempt'],text=text))
    row.update(inputCharacters=len((p/'prompt.md').read_text()),searchFeedbackCharacters=sum(len(s['text']) for s in searches),accepted=r['accepted'],parts=r.get('parts'),seconds=r['seconds'],attempts=r['attemptsUsed'],checks=r['checks'],searches=r['searches'],sessionIds=ids,workingDirectory=str(p/'empty'),sourceEqualsFinalSubmission=False,blockedNativeToolAttempts=blocked,executedNativeTools=[])
    for name in ['prompt.md','result.json']:shutil.copyfile(p/name,d/name)
    shutil.copyfile(p.parent/'summary.json',d/'summary.json')
    checks=[]
    for attempt in r['attempts']:
        for k in range(1,len(attempt['checks'])+1):
            file=p/f"attempt-{attempt['attempt']}.check-{k}.answer.md"
            if file.exists(): checks.append(dict(attempt=attempt['attempt'],check=k,feedback=file.read_text()))
    (d/'checks.json').write_text(json.dumps(checks,indent=2)+'\n')
    # Search feedback is the exact text given to the model, no private reasoning.
    if searches:(d/'searches.json').write_text(json.dumps(searches,indent=2)+'\n')
    if r['accepted']:
        final=(p/f"attempt-{r['attemptsUsed']}.reply.md").read_text(); submission=json.loads(final)
        assert submission['input']['code']==(p/'build.js').read_text()
        assert (p/'build.json').read_bytes()==(p/f"attempt-{r['attemptsUsed']}.json").read_bytes(), 'Accepted expanded script changed during rendering'
        report=p/'build.mpd.report.json'
        if not report.exists():row['renderFailure']='Missing final render report';rows.append(row);continue
        report=json.loads(report.read_text());assert report['ok']
        assert report['stats']['parts']==r['parts'], 'Part count changed during rendering'
        assert not any(x['severity']=='error' for x in report['problems'])
        for name in ['build.js','build.json','build.mpd']:shutil.copyfile(p/name,d/name)
        shutil.copyfile(p/'build.mpd.report.json',d/'compile.json')
        for view in ['iso','front','iso-back','top']:
            f=p/f'views/build-{view}.png'
            if not f.exists():row['renderFailure']='Missing '+view;continue
            im=Image.open(f).convert('RGB');assert im.size==(1280,960);im.save(d/f'{view}.webp',quality=92)
        row.update(title=report['title'],uniquePartTypes=len(report['parts']),compilerErrors=0,warnings=dict(Counter(x['code'] for x in report['problems'] if x['severity']=='warning')),baseplates=sum(x['count'] for x in report['parts'] if 'Baseplate' in x['name']),sourceEqualsFinalSubmission=True,promptSha256=sha(d/'prompt.md'),sourceSha256=sha(d/'build.js'),mpdSha256=sha(d/'build.mpd'))
    rows.append(row)
(dest/'metrics.json').write_text(json.dumps(dict(complete=len(rows)==len(cases),cases=rows,uniqueNativeSessions=len(sessions)),indent=2)+'\n')
print(json.dumps(dict(packaged=len(rows),accepted=sum(r['accepted'] for r in rows))))

from pathlib import Path
import json, subprocess, concurrent.futures, sys, os, hashlib

root=Path.cwd();number=int(sys.argv[1]);out=root/'.local/style-loop'/f'round-{number}-runs'
assert not out.exists(), 'Use a new directory, never reuse a round'
base=json.loads((root/'docs/samples/style-self-improvement/baseline.json').read_text())
subjects=['pelican','piplup','temple','dragon','destroyer','ewok']
cases=[next(c for c in base['cases'] if c['id']==style+'-'+subject) for subject in subjects for style in ['lego','diorama']]
out.mkdir()
def run(case):
    dest=out/case['id'];dest.mkdir();prompt=f'style-loop-{number}-{case["style"]}.md';reply='brick-build.md' if case['style']=='lego' else 'brick-build-diorama.md'
    cmd=['node','node_modules/tsx/dist/cli.mjs','scripts/one-shot-build.ts','--brief',case['brief'],'--model','gpt-6.1-sol','--efforts','high','--attempts','5','--target-parts',str(case['target']),'--prompt',prompt,'--reply-prompt',reply,'--parts-list','on','--search','on','--check','on','--views','iso,front,iso-back,top','--fresh','on','--out',str(dest)]
    record={'id':case['id'],'style':case['style'],'subject':case['subject'],'brief':case['brief'],'target':case['target'],'promptFile':prompt,'replyPromptFile':reply,'systemPromptSha256':hashlib.sha256((root/'prompts'/prompt).read_bytes()).hexdigest(),'replyPromptSha256':hashlib.sha256((root/'prompts'/reply).read_bytes()).hexdigest(),'initialOutputContents':[]}
    print('START round',number,case['id'],flush=True)
    with (out/(case['id']+'.log')).open('w') as log:
        r=subprocess.run(cmd,cwd=root,env={**os.environ,'FORCE_COLOR':'0'},stdout=log,stderr=subprocess.STDOUT,timeout=10800)
    assert r.returncode==0,(case['id'],r.returncode)
    result=json.loads((dest/'high/result.json').read_text());assert result['accepted'],case['id']
    record.update({'exitCode':0,'parts':result['parts'],'seconds':result['seconds'],'accepted':True})
    (out/(case['id']+'.receipt.json')).write_text(json.dumps(record,indent=2)+'\n')
    print('FINISH round',number,case['id'],result['parts'],flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(run,cases))

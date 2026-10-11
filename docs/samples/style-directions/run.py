"""Run isolated text-only ablations. Run from repository root; never reuse output."""
from pathlib import Path
import concurrent.futures, hashlib, json, os, subprocess, time

root = Path.cwd()
out = root / '.local/style-directions/runs'
assert not out.exists(), 'Choose a fresh experiment directory'
out.mkdir(parents=True)
baseline = json.loads((root/'docs/samples/style-self-improvement/baseline.json').read_text())['cases']
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
cases = []
for subject in ['pelican', 'piplup', 'temple', 'dragon', 'destroyer', 'ewok']:
    for variant in ['budget', 'antipattern', 'facts']:
        for style in ['lego', 'diorama']:
            original = next(c for c in baseline if c['id'] == style+'-'+subject)
            prompt = ('build-agent.md' if style == 'lego' else 'build-agent-diorama.md') if variant == 'facts' else f'style-{variant}-{style}.md'
            reply = 'brick-build.md' if style == 'lego' else 'brick-build-diorama.md'
            cases.append(dict(id=f'{variant}-{style}-{subject}', variant=variant, style=style, subject=subject, brief=original['brief'], target=None if variant == 'budget' else original['target'], promptFile=prompt, replyPromptFile=reply, baseline=original['source'], systemPromptSha256=sha(root/'prompts'/prompt), replyPromptSha256=sha(root/'prompts'/reply)))
protocol = dict(model='gpt-6.1-sol', effort='high', cases=cases, baseline='Retained fresh E and diorama; not the rejected loop-1 candidate', input='Original brief only; each case and attempt has a new native session, own empty directory, no sources, images, reviewer feedback or other builds. Repairs may use only that case output and compiler errors.', feedback='10 search replies x 5 queries; 3 draft checks per attempt; 5 attempts. Counts and errors only. Facts arm adds local part geometry, verified connector coordinates and official shortcut co-occurrence; no visual feedback or placement solver.', sizing='Budget arm removes numeric target and count-based corrections. Lego selects plausible commercial set scale; diorama has no requested size cap. Sandbox 10s, 50,000 ops, code size, compiler and application limits remain unchanged.', evaluation='Four Standard views at 1280x960 after acceptance. Compare proportions, finish fidelity, composition, visible support and consistency. Record counts, attempts, warnings, failures, and search usage separately. One generation per cell is exploratory, not causal proof.', files={f:sha(root/f) for f in ['scripts/one-shot-build.ts','scripts/agent-part-facts.ts','src/build-script/part-list.ts']})
(root/'docs/samples/style-directions/protocol.json').write_text(json.dumps(protocol,indent=2)+'\n')

def run(c):
    dest = out/c['id']
    cmd = ['node','node_modules/tsx/dist/cli.mjs','scripts/one-shot-build.ts','--brief',c['brief'],'--model','gpt-6.1-sol','--efforts','high','--attempts','5','--prompt',c['promptFile'],'--reply-prompt',c['replyPromptFile'],'--parts-list','on','--search','on','--check','on','--part-facts','on' if c['variant']=='facts' else 'off','--views','iso,front,iso-back,top','--fresh','on','--out',str(dest)]
    if c['target'] is not None: cmd += ['--target-parts',str(c['target'])]
    start=time.time()
    print('START', c['id'], flush=True)
    record={**c,'initialOutputContents':[], 'command':cmd}
    try:
        with (out/(c['id']+'.log')).open('w') as log:
            proc=subprocess.run(cmd,cwd=root,env={**os.environ,'FORCE_COLOR':'0'},stdout=log,stderr=subprocess.STDOUT,timeout=10800)
        record['exitCode']=proc.returncode
        result=dest/'high/result.json'
        if result.exists():
            r=json.loads(result.read_text());record.update(accepted=r['accepted'],parts=r.get('parts'))
    except Exception as e: record['failure']=str(e)
    record['wallSeconds']=round(time.time()-start)
    (out/(c['id']+'.receipt.json')).write_text(json.dumps(record,indent=2)+'\n')
    print('FINISH', c['id'], record.get('accepted',False),record.get('parts'),record.get('failure',''), flush=True)

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(run,cases))
print('ALL FINISHED', flush=True)

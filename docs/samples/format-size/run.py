"""Reproduce in an unused output directory: python run.py --prepare, then --run.
Run from repository root. Each native run has its own empty working directory.
"""
from pathlib import Path
import concurrent.futures, hashlib, json, os, random, subprocess, sys, time

root = Path.cwd()
dest = root / 'docs/samples/format-size'
out = root / '.local/format-size/runs'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
protocol_path = dest / 'protocol.json'
if sys.argv[1:] == ['--prepare']:
    assert not protocol_path.exists() and not out.exists(), 'Choose a new experiment directory'
    baseline = json.loads((root/'docs/samples/style-self-improvement/baseline.json').read_text())['cases']
    cases = []
    for repeat in [1, 2]:
        for subject in ['pelican', 'piplup', 'temple', 'dragon', 'destroyer', 'ewok']:
            for style in ['lego', 'diorama']:
                original = next(c for c in baseline if c['id'] == style+'-'+subject)
                for variant in ['format', 'reference']:
                    prompt = f'style-size-{variant}-{style}.md'
                    reply = 'brick-build.md' if style == 'lego' else 'brick-build-diorama.md'
                    cases.append(dict(id=f'{variant}-{repeat}-{style}-{subject}', variant=variant, repeat=repeat, style=style, subject=subject, brief=original['brief'], target=None, promptFile=prompt, replyPromptFile=reply, baseline=original['source'], systemPromptSha256=sha(root/'prompts'/prompt), replyPromptSha256=sha(root/'prompts'/reply)))
    random.Random(20261011).shuffle(cases)
    files = ['scripts/one-shot-build.ts', 'scripts/agent-part-facts.ts', 'src/build-script/part-list.ts', 'docs/samples/format-size/supplied-piece-count-summary.md']
    protocol = dict(model='gpt-6.1-sol', effort='high', cases=cases, parentCommit='670056e7', concurrency=8, order='Deterministic shuffle, seed 20261011; all cases specified before generation.', input='Original brief only; independent new native sessions in empty directories; no source builds, images, other outputs or reviewer feedback.', conditions='Format-first sizing alone vs identical format-first sizing plus supplied family reference table. Both omit numeric targets. All other model-visible instructions, examples, tools and limits remain identical within each style.', feedback='Existing text-only parts search and count/error compiler checks. Richer part facts OFF. No visual feedback or added spatial solver.', source='User-supplied summary, archived byte-for-byte; underlying 142-row dataset not supplied or independently verified. All seven rows retained without subject-specific assignments.', limits='Existing sandbox 10s/50000 ops, compiler/application limits, 10 search rounds x 5 queries and 3 draft checks per attempt; at most 5 attempts.', evaluation='Two independent runs per condition, six original briefs, both styles: 48 builds. Review all accepted outputs in four post-generation views, same five 0–4 axes as prior study; record counts/warnings/searches/failures separately. Compare both repetitions, not best-of-two. Retained baseline, its two repeats and previous target-free results are historical context, not contemporaneous controls. Unblinded exploratory review, not statistical or physical certification.', stop='Complete predeclared matrix unless externally blocked; no adaptation or selective reruns based on quality; no automatic promotion.', files={f:sha(root/f) for f in files})
    protocol_path.write_text(json.dumps(protocol, indent=2)+'\n')
    print('Prepared 48 cases; no generation started.')
    sys.exit()
assert sys.argv[1:] == ['--run'], 'Use --prepare or --run'
protocol = json.loads(protocol_path.read_text())
assert not out.exists(), 'Refuse to overwrite or resume an existing batch'
for file, digest in protocol['files'].items(): assert sha(root/file) == digest, file
for case in protocol['cases']:
    assert sha(root/'prompts'/case['promptFile']) == case['systemPromptSha256']
    assert sha(root/'prompts'/case['replyPromptFile']) == case['replyPromptSha256']
out.mkdir(parents=True)

def run(c):
    path = out / c['id']
    cmd = ['node','node_modules/tsx/dist/cli.mjs','scripts/one-shot-build.ts','--brief',c['brief'],'--model','gpt-6.1-sol','--efforts','high','--attempts','5','--prompt',c['promptFile'],'--reply-prompt',c['replyPromptFile'],'--parts-list','on','--search','on','--check','on','--part-facts','off','--views','iso,front,iso-back,top','--fresh','on','--out',str(path)]
    start = time.time()
    print('START', c['id'], flush=True)
    record = {**c, 'initialOutputContents': [], 'command': cmd}
    try:
        with (out/(c['id']+'.log')).open('w') as log:
            proc = subprocess.run(cmd, cwd=root, env={**os.environ, 'FORCE_COLOR':'0'}, stdout=log, stderr=subprocess.STDOUT, timeout=10800)
        record['exitCode'] = proc.returncode
        result = path/'high/result.json'
        if result.exists():
            r = json.loads(result.read_text()); record.update(accepted=r['accepted'], parts=r.get('parts'))
    except Exception as e: record['failure'] = str(e)
    record['wallSeconds'] = round(time.time()-start)
    (out/(c['id']+'.receipt.json')).write_text(json.dumps(record, indent=2)+'\n')
    print('FINISH', c['id'], record.get('accepted',False), record.get('parts'), record.get('failure',''), flush=True)

with concurrent.futures.ThreadPoolExecutor(max_workers=protocol['concurrency']) as pool:
    list(pool.map(run, protocol['cases']))
print('ALL FINISHED', flush=True)

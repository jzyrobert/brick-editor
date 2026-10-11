from pathlib import Path
import json, subprocess, concurrent.futures, sys, hashlib, time

root=Path.cwd()
input_file=Path(sys.argv[1])
out=Path(sys.argv[2]).resolve()
cases=json.loads(input_file.read_text())['cases']
no_tools=['shell_tool','unified_exec','multi_agent','browser_use','browser_use_external','computer_use','apps','image_generation','in_app_browser','code_mode_host','goals','skill_search','tool_suggest','sleep_tool']
def ask(case):
    directory=out/case['id'];directory.mkdir(parents=True,exist_ok=True)
    assert not (directory/'response.md').exists(), 'Do not silently repeat interviews'
    message='''This is a retrospective interview about your final submitted build, not another build request. Answer in concise plain prose, without JSON, code or a replacement build. You have not been given any rendered images. Do not claim to have seen a render.

First describe your own choices before responding to the reviewer observations below:
1. Which choices most determined the final silhouette, proportions, surface treatment, context and supports? Which precise prompt clauses materially influenced them? Quote only the short relevant phrases. Distinguish explicit instruction from your own inference or aesthetic choice; do not assume the prompt caused every weakness.
2. Did you consider a deliberate stepped/brick-sculpted/pixel-like treatment? Did you interpret any instruction as requiring curves, tiles, hiding every stud, removing scenery or adding a display? Which instruction, if any? What worked and should remain?
3. Were any compromises driven by integer coordinates, turn/footprint conventions, curated/search catalogue coverage, part availability, target counting, compiler feedback or code verbosity? Name the exact constraint and why it affected a choice. Explain where zero compiler errors did not establish connected geometry.
4. Now consider the observations below. Which are plausible from your own code, and which cannot you verify without images? Explain the relevant design decision or constraint without inventing certainty.
5. Recommend at most three small build-agnostic edits to the prompt or text-only search/check/code process. No named-subject recipes, prescribed geometry, images, render feedback, extra drafting stages or new geometric solver. Keep the task a spatial reasoning benchmark. Prefer deleting/clarifying conflicting guidance to adding a long checklist. Explain what each edit could harm as well as help.

Reviewer observations (post-generation review; not a diagnosis of prompt causation):
'''+case['issues']+f"\n\nFinal count: {case['parts']} against {case['target']}. Compiler errors: {case['compilerErrors']}; warning records: {json.dumps(case['warnings'])}. Warnings were not supplied during generation. Your retrospective explanation is evidence to investigate, not proof that a prompt edit will improve future generations."
    (directory/'request.md').write_text(message+'\n')
    cwd=Path(case['workingDirectory']);assert cwd.exists() and not list(cwd.iterdir())
    cmd=['codex','exec','resume',case['sessionId'],'--ignore-user-config','--skip-git-repo-check','-m','gpt-6.1-sol','-c','model_reasoning_effort="high"','-c','web_search="disabled"','-c','project_doc_max_bytes=0','-c','sandbox_mode="read-only"']
    for tool in no_tools:cmd+=['--disable',tool]
    cmd+=['--json','-o',str(directory/'response.md'),'-']
    print('START interview',case['id'],flush=True);started=time.time()
    with (directory/'events.jsonl').open('w') as stdout,(directory/'stderr.log').open('w') as stderr:
        result=subprocess.run(cmd,input=message,text=True,cwd=cwd,stdout=stdout,stderr=stderr,timeout=3600)
    assert result.returncode==0,(case['id'],result.returncode)
    events=[json.loads(x) for x in (directory/'events.jsonl').read_text().splitlines() if x.strip()]
    assert events[0]['thread_id']==case['sessionId']
    tool_events=[x for x in events if x.get('item',{}).get('type') in ['command_execution','mcp_tool_call','web_search','image_generation']]
    assert not tool_events and (directory/'response.md').stat().st_size>100
    rollout=list(Path('/home/ubuntu/.codex/sessions').glob('*/*/*/*'+case['sessionId']+'*.jsonl'))
    records=[json.loads(x) for x in rollout[0].read_text().splitlines()]
    turn=[x['payload'] for x in records if x['type']=='turn_context'][-1]
    assert turn['model']=='gpt-6.1-sol' and turn['effort']=='high'
    assert not list(cwd.iterdir())
    audit={'case':case['id'],'resumedSessionId':case['sessionId'],'model':turn['model'],'effort':turn['effort'],'cwd':str(cwd),'nativeToolEvents':[],'inputImages':[],'exitCode':0,'seconds':round(time.time()-started),'sourceUnchanged':True,'requestSha256':hashlib.sha256((directory/'request.md').read_bytes()).hexdigest(),'responseSha256':hashlib.sha256((directory/'response.md').read_bytes()).hexdigest()}
    (directory/'audit.json').write_text(json.dumps(audit,indent=2)+'\n')
    print('FINISH interview',case['id'],flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(ask,cases))

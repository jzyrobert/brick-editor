import json,pathlib,time,subprocess,os
root=pathlib.Path('.local/model-screening-v1')
status=pathlib.Path('.local/screening-postprocess-status.json')
while True:
 try:s=json.loads((root/'status.json').read_text())
 except (FileNotFoundError,json.JSONDecodeError):s={}
 if s.get('state') in ['complete','stopped','quota-stopped']:break
 if (root/'supervisor-error.json').exists():raise SystemExit('Supervisor failed; inspect retained evidence')
 time.sleep(5)
for name,model in s['models'].items():
 runs=model.get('checkpoint')
 if not runs:continue
 out='.local/'+name+'-visual-v1';protocol='fixtures/spatial-benchmark/studies/automatic-facts-pilot/visual-protocol-submitted.json'
 commands=[('render',['npx','tsx','scripts/spatial-benchmark-evaluate.ts','--runs',runs,'--protocol',protocol,'--out',out,'--mode','render']),('review',['npx','tsx','scripts/spatial-benchmark-evaluate.ts','--runs',runs,'--protocol',protocol,'--out',out,'--mode','review']),('report',['npx','tsx','scripts/spatial-benchmark-report.ts','--runs',runs,'--evaluation',out,'--out','.local/'+name+'-report.json'])]
 for stage,cmd in commands:
  status.write_text(json.dumps({'state':stage,'model':name,'runs':runs,'out':out,'startedAt':time.time()},indent=2))
  with open('.local/'+name+'-'+stage+'.log','w') as log:r=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT)
  if r.returncode:
   status.write_text(json.dumps({'state':'failed','stage':stage,'model':name,'returncode':r.returncode,'runs':runs},indent=2));raise SystemExit(r.returncode)
status.write_text(json.dumps({'state':'complete','generation':s},indent=2))

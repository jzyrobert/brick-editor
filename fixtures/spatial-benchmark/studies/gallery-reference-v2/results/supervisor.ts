import {mkdir,readFile,writeFile,appendFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {main as live} from '../scripts/spatial-benchmark-live';
import {main as pool} from '../scripts/spatial-benchmark-pool';
import {readCodexQuota,quotaAllowsNext} from '../scripts/spatial-benchmark/codex-quota';
const root=resolve('.local/gallery-reference-v2-runs');await mkdir(root);
await writeFile(join(root,'supervisor.ts'),await readFile(new URL(import.meta.url)));
const phases:Record<string,string[]>={luna:[],sol:[],astra:[]};const checkpoints:Record<string,string>={};let completed=0,consecutiveInfra=0,largestDrop=0;
for(let round=1;round<=6;round++)for(const model of ['luna','sol','astra']){
 const before=await readCodexQuota();if(!quotaAllowsNext(before,largestDrop))throw new Error('Quota reserve reached');
 const phase=join(root,`${model}-phase-${round}`);const args=['--manifest',`fixtures/spatial-benchmark/studies/gallery-reference-v2/${model}.json`,'--out',phase,'--authorised-cases','1'];if(checkpoints[model])args.push('--remaining-from',checkpoints[model]);
 await writeFile(join(root,'active.json'),JSON.stringify({model,round,completed,phase,weeklyRemaining:before.weeklyRemaining}));
 await live(args);phases[model].push(phase);
 const status=JSON.parse(await readFile(join(phase,'run-status.json'),'utf8'));
 if(!status.completed)throw new Error(`No case completed: ${status.stopReason}`);
 const checkpoint=join(root,`${model}-checkpoint-${round}`);await pool([...phases[model].flatMap(p=>['--phase',p]),'--out',checkpoint]);checkpoints[model]=checkpoint;completed++;
 const result=JSON.parse(await readFile(join(phase,'results.json'),'utf8')).results[0];
 consecutiveInfra=result.status==='infrastructure-failure'?consecutiveInfra+1:0;
 const after=status.lastQuota; if(after)largestDrop=Math.max(largestDrop,before.weeklyRemaining-after.weeklyRemaining);
 await appendFile(join(root,'order.jsonl'),JSON.stringify({completed,model,round,phase,checkpoint,caseId:result.caseId,status:result.status,weeklyRemaining:after?.weeklyRemaining??null})+'\n');
 await writeFile(join(root,'status.json'),JSON.stringify({completed,checkpoints,weeklyRemaining:after?.weeklyRemaining??null,state:completed===18?'complete':'running'},null,2));
 if(!after||!quotaAllowsNext(after,largestDrop)||consecutiveInfra>=3)throw new Error('Quota/infrastructure stop; completed failures retained');
}

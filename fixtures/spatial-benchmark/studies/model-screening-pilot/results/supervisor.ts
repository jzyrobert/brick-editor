import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { main as live } from '../scripts/spatial-benchmark-live';
import { main as pool } from '../scripts/spatial-benchmark-pool';
import { hash } from '../scripts/spatial-benchmark/part-reference';
import { readCodexQuota, quotaAllowsNext } from '../scripts/spatial-benchmark/codex-quota';
const root=resolve('.local/model-screening-v1');
async function main(){
 await mkdir(root); const source=await readFile(new URL(import.meta.url));await writeFile(join(root,'supervisor.ts'),source);
 await writeFile(join(root,'protocol.json'),JSON.stringify({version:'alternating-model-screening/1',declaredAt:new Date().toISOString(),scheduled:32,sourceSha256:hash(source),failedCaseRetries:0,cooldownMs:300000,stopAfterConsecutiveInfrastructureFailures:3,noCreditPurchasesOrResets:true},null,2));
 const state=Object.fromEntries(['luna','astra'].map(name=>[name,{completed:0,phases:[] as string[],checkpoint:undefined as string|undefined,infra:0,stopped:false}]));
 let largestDrop=0;
 while(true){
   const prior=JSON.parse(await readFile('/home/ubuntu/brick-benchmark/.local/automatic-facts-postprocess-status.json','utf8'));
   if(['complete','failed','generation-stopped'].includes(prior.state))break;
   await writeFile(join(root,'status.json'),JSON.stringify({state:'waiting-for-sol-evaluation',priorStage:prior.state},null,2));
   await new Promise(r=>setTimeout(r,5000));
 }
 for(let round=1;round<=16;round++)for(const name of ['luna','astra']){
  const s=state[name];if(s.stopped||s.completed===16)continue;
  const quota=await readCodexQuota();
  if(!quotaAllowsNext(quota,largestDrop)){await writeFile(join(root,'status.json'),JSON.stringify({state:'quota-stopped',quota,largestDrop,models:state},null,2));return;}
  const phase=join(root,name+'-phase-'+round);
  const args=['--manifest',resolve('fixtures/spatial-benchmark/studies/model-screening-pilot/'+name+'.json'),'--out',phase,'--authorised-cases','1'];if(s.checkpoint)args.push('--remaining-from',s.checkpoint);
  await appendFile(join(root,'order.jsonl'),JSON.stringify({at:new Date().toISOString(),kind:'start',model:name,round})+'\n');
  await live(args);s.phases.push(phase);
  const status=JSON.parse(await readFile(join(phase,'run-status.json'),'utf8'));
  s.checkpoint=join(root,name+'-checkpoint-'+round);await pool([...s.phases.flatMap(p=>['--phase',p]),'--out',s.checkpoint]);
  const current=JSON.parse(await readFile(join(s.checkpoint,'results.json'),'utf8'));s.completed=current.completed;
  largestDrop=Math.max(largestDrop,...current.results.map((r:any)=>r.observedAccountDrop??0));
  const infra=status.stopReason==='Infrastructure failure; no automatic retry';s.infra=infra?s.infra+1:0;
  s.stopped=s.infra>=3||!status.completed||(!infra&&status.stopReason&&!status.stopReason.startsWith('Authorised case limit'));
  await writeFile(join(root,'status.json'),JSON.stringify({state:'running',models:state,lastQuota:status.lastQuota,largestDrop},null,2));
  if(infra&&!s.stopped){await appendFile(join(root,'order.jsonl'),JSON.stringify({at:new Date().toISOString(),kind:'cooldown',model:name,milliseconds:300000})+'\n');await new Promise(r=>setTimeout(r,300000));}
 }
 await writeFile(join(root,'status.json'),JSON.stringify({state:Object.values(state).every(s=>s.completed===16)?'complete':'stopped',models:state,lastQuota:await readCodexQuota(),largestDrop},null,2));
}
main().catch(async e=>{await writeFile(join(root,'supervisor-error.json'),JSON.stringify({message:String(e.message)}));console.error(e);process.exitCode=1;});

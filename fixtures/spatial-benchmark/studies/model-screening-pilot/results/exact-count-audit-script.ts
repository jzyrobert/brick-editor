import { readFile,writeFile } from 'node:fs/promises';
import { exactCountAudit } from '../scripts/spatial-benchmark/exact-count-audit';
const base='fixtures/spatial-benchmark/studies/';
const models=[['sol',base+'automatic-facts-pilot/results/report.json'],['luna',base+'model-screening-pilot/results/luna/report.json'],['astra',base+'model-screening-pilot/results/astra/report.json']];
const summaries=[];
for(const [model,file] of models){
 const report=JSON.parse(await readFile(file,'utf8'));
 const rows=report.rows.map((r:any)=>({caseId:r.caseId,originalStatus:r.status,condition:r.condition,exactCount:exactCountAudit(16,r.stats?.parts??null),originalVisualTotal:r.visualTotal}));
 const conditions=report.conditions.map((c:any)=>{const rs=rows.filter((r:any)=>r.condition===c.id);const valid=rs.filter((r:any)=>r.originalStatus==='submitted'&&r.exactCount.status==='verified');const scored=valid.filter((r:any)=>r.originalVisualTotal!==null);return {condition:c.id,scheduled:c.scheduled,runnerSubmitted:c.submitted,strictlyCompliant:valid.length,originallySubmittedCountViolations:rs.filter((r:any)=>r.originalStatus==='submitted'&&r.exactCount.status==='invalid').map((r:any)=>r.caseId),compliantVisualMean24:scored.length?scored.reduce((s:number,r:any)=>s+r.originalVisualTotal,0)/scored.length:null};});
 summaries.push({model,conditions,rows});
}
await writeFile(base+'model-screening-pilot/results/exact-count-audit.json',JSON.stringify({version:'post-evaluation-exact-count-audit/1',declaredAfterEvaluation:true,requirementSource:'All four frozen task briefs explicitly require exactly 16 parts. targetParts is not enforced by the runner; original status and assessments are preserved.',scope:'Exact count only. Compiler acceptance, inventory, physical support and visual quality remain separate.',summaries},null,2)+'\n');

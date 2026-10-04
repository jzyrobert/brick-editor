import { execFileSync } from "node:child_process";
import type { MotionRig } from "../../../src/mechanisms/types";

/** Original repository-owned arrangements of actual source door/car/motor parts.
 * Fixtures go through ordinary native import and source-connection review. */
export function realMechanismsFixture(): {
  bytes: number[];
  rigs: Record<string, MotionRig>;
} {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        "node_modules/tsx/dist/cli.mjs",
        "--eval",
        `
import {occurrences} from './src/core/document';
import {carProject} from './src/catalog/builds/car';
import {importLDraw} from './src/ldraw/io';
import {deriveDoorRigs} from './src/play/auto-doors';
import {encodeNative} from './src/persistence/native';
const project=carProject();
for(const n of project.models[project.rootModelId].nodes) n.transform.position[2]-=200;
const vehicle=project.motionRigs.car;delete project.motionRigs.car;vehicle.id='vehicle';
for(const g of vehicle.groups){g.frame.position[2]-=200;for(const t of Object.values(g.restTransforms))t.position[2]-=200;}
project.motionRigs.vehicle=vehicle;
const door=importLDraw('1 15 0 -152 0 -1 0 0 0 1 0 0 0 -1 60596.dat\\n1 4 32 -152 -5 -1 0 0 0 1 0 0 0 -1 60616a.dat\\n');
for(const [i,node] of door.models[door.rootModelId].nodes.entries()){node.id='real-door-'+i;delete node.sourceRecordId;project.models[project.rootModelId].nodes.push(node);}
const rig=Object.values(deriveDoorRigs(project,{all:occurrences(project),reserved:new Set(),maxRigs:32,maxGroups:128}).rigs)[0];
if(!rig)throw Error('Actual holder/leaf source did not derive a hinge');
rig.id='door';rig.name='Door';rig.joints[0].id='hinge';rig.joints[0].limits=[0,90];
project.motionRigs.door=rig;
encodeNative(project).then(bytes=>process.stdout.write(JSON.stringify({bytes:Array.from(bytes),rigs:project.motionRigs})));
`,
      ],
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    ),
  );
}

export function realMotorFixture(withCrate = false): {
  text: string;
  bytes: number[];
  rig: MotionRig;
} {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        "node_modules/tsx/dist/cli.mjs",
        "--eval",
        `
import {registerFullLibraryFromDisk} from './scripts/full-library-node';
import {physicalMotorFixture} from './src/mechanisms/motor-fixture';
import {importLDraw} from './src/ldraw/io';
import {occurrences} from './src/core/document';
import {encodeNative} from './src/persistence/native';
registerFullLibraryFromDisk();
const {project,text,proposal}=physicalMotorFixture();
if(proposal.unresolved.length)throw Error(JSON.stringify(proposal.unresolved));
if(${withCrate}){const brick=importLDraw('1 14 -120 0 0 1 0 0 0 1 0 0 0 1 3010.dat');const node=brick.models[brick.rootModelId].nodes[0];node.id='physical-crate';delete node.sourceRecordId;project.models[project.rootModelId].nodes.push(node);const o=occurrences(project).find(o=>o.node.id===node.id);project.motionRigs.crate={schemaVersion:1,id:'crate',name:'Loose brick',mode:'kinematic',groups:[{id:'crate',occurrenceIds:[o.id],frame:o.transform,restTransforms:{[o.id]:o.transform}}],joints:[]};}
encodeNative(project).then(bytes=>process.stdout.write(JSON.stringify({text,bytes:Array.from(bytes),rig:proposal.rig})));
`,
      ],
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    ),
  );
}

export function realCombinedMotorFixture(): {
  bytes: number[];
  rigs: MotionRig[];
} {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        "node_modules/tsx/dist/cli.mjs",
        "--eval",
        `
import {registerFullLibraryFromDisk} from './scripts/full-library-node';
import {physicalMotorFixture} from './src/mechanisms/motor-fixture';
import {importLDraw} from './src/ldraw/io';
import {occurrences} from './src/core/document';
import {proposeMechanicalRig} from './src/mechanisms/mechanical-proposals';
import {encodeNative} from './src/persistence/native';
registerFullLibraryFromDisk();
const {text}=physicalMotorFixture();
const rows=text.split('\\n').filter(l=>l.startsWith('1 '));
const shifted=rows.map(l=>{const s=l.split(/\\s+/);s[2]=String(Number(s[2])+400);return s.join(' ');});
const project=importLDraw(['0 Original CC0 independent mounted motor assemblies',...rows,...shifted].join('\\n'));
const all=occurrences(project),rigs=[];
for(let k=0;k<2;k++){
 const offset=k*rows.length,id='drive-'+(k+1);
 const result=proposeMechanicalRig(project,{id,name:'Mounted motor '+(k+1),expectedRevision:project.revision,occurrenceIds:all.slice(offset,offset+rows.length).map(o=>o.id),frameOccurrenceIds:[0,1,10,11,12,13,14].map(i=>all[offset+i].id),motors:{[all[offset+2].id]:{mode:'velocity',target:90,maxEffort:{value:50,unit:'N*m'},binding:{occurrenceId:all[offset+10].id,profile:'power-functions-motor-m-v1'}}}});
 if(result.unresolved.length)throw Error(JSON.stringify(result.unresolved));
 project.motionRigs[id]=result.rig;rigs.push(result.rig);
}
encodeNative(project).then(bytes=>process.stdout.write(JSON.stringify({bytes:Array.from(bytes),rigs})));
`,
      ],
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    ),
  );
}

import { test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { checkPhysicalRefusal } from "./helpers/physical-play-policy";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const fixture = JSON.parse(
  execFileSync(
    process.execPath,
    [
      "node_modules/tsx/dist/cli.mjs",
      "--eval",
      `
import {mechanismFixture} from './src/mechanisms/fixtures';
import {compose} from './src/core/math';
import {encodeNative} from './src/persistence/native';
const project=mechanismFixture();
const pose={position:[180,-120,90],basis:[.8137976813493738,-.4698463103929542,.3420201433256687,.5438381424823255,.823172944645501,-.16317591116653482,-.20487412870286215,.3187957775971678,.9254165783983234]};
const leaf=project.models['door.dat'];delete project.models['door.dat'];
leaf.id='3648b.dat';leaf.name='3648b.dat';project.models[leaf.id]=leaf;
for(const node of project.models[project.rootModelId].nodes){if(node.ref==='door.dat')node.ref='3648b.dat';node.transform=compose(pose,node.transform);}
for(const rig of Object.values(project.motionRigs))for(const group of rig.groups){group.frame=compose(pose,group.frame);for(const id of Object.keys(group.restTransforms))group.restTransforms[id]=compose(pose,group.restTransforms[id]);}
project.motionRigs.door.joints[0].motor={mode:'velocity',target:25,maxEffort:{value:500,unit:'N*m'}};
encodeNative(project).then(bytes=>process.stdout.write(JSON.stringify(Array.from(bytes))));
`,
    ],
    { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  ),
);

for (const dynamic of [false, true])
  test(`an oblique project part named like an official gear cannot borrow physical motor power (${dynamic ? "Dynamic" : "Kinematic"})`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await checkPhysicalRefusal(
      page,
      { bytes: fixture, rigId: "door" },
      /supported motor part/,
      dynamic,
    );
  });

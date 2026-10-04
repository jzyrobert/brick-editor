import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { refusePointerLock } from "./helpers/pointer";

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

for (const dynamic of [false, true]) {
  test(`canonical member capture enters an oblique embedded same-name ${dynamic ? "Dynamic" : "Kinematic"} rig without changing source`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await refusePointerLock(page);
    await page.goto("/?automation=1");
    await page.waitForFunction(() => !!window.brickEditor);
    const result = await page.evaluate(
      async ({ bytes, dynamic }) => {
        const api = window.brickEditor!;
        await api.project.import({ format: "native", bytes });
        await api.ready({ strict: true });
        const before = await api.query(),
          source = await api.project.export({ format: "ldraw" }),
          rigs = await api.mechanisms.list();
        const inventory = await api.inventory.preview({
          expectedRevision: before.revision,
          scope: { kind: "all" },
          format: "bricklink-wanted-xml",
          acceptUnknownColors: true,
          acceptDerivedMappings: true,
          errorPolicy: "export-resolved",
        });
        await api.play.enter({
          rigIds: ["door"],
          ...(dynamic ? { dynamicRigIds: ["door"] } : {}),
          position: [700, -20, 700],
          realtime: false,
          autoDoors: false,
          trains: false,
        });
        const rest = await api.play.snapshot();
        await api.play.stepTicks(90);
        const moved = await api.play.snapshot();
        await api.play.exit();
        const after = await api.query(),
          afterSource = await api.project.export({ format: "ldraw" }),
          afterInventory = await api.inventory.preview({
            expectedRevision: after.revision,
            scope: { kind: "all" },
            format: "bricklink-wanted-xml",
            acceptUnknownColors: true,
            acceptDerivedMappings: true,
            errorPolicy: "export-resolved",
          });
        return {
          before,
          after,
          source: Array.from(source.bytes),
          afterSource: Array.from(afterSource.bytes),
          rigs,
          afterRigs: await api.mechanisms.list(),
          inventory,
          afterInventory,
          rest,
          moved,
        };
      },
      { bytes: fixture, dynamic },
    );
    expect(result.after).toEqual(result.before);
    expect(result.afterSource).toEqual(result.source);
    expect(result.afterRigs).toEqual(result.rigs);
    expect(result.afterInventory).toEqual(result.inventory);
    const rest = result.rest.mechanisms!.door,
      moved = result.moved.mechanisms!.door;
    expect(moved.pose.jointPositions.hinge).toBeGreaterThan(
      rest.pose.jointPositions.hinge + 5,
    );
    expect(moved.mode).toBe(dynamic ? "dynamic" : "kinematic");
    expect(errors).toEqual([]);
    expect(
      result.before.occurrences.find((o) => o.node.ref === "3648b.dat")
        ?.namespace,
    ).toBe("project");
  });
}

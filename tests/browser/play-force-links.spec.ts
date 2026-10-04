import { test } from "@playwright/test";
import {
  checkPhysicalRefusal,
  laboratoryFixture,
} from "./helpers/physical-play-policy";

for (const dynamic of [true])
  test(`authored spring keeps its definition without inventing a physical attachment (${dynamic ? "Dynamic" : "Kinematic"})`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await checkPhysicalRefusal(
      page,
      laboratoryFixture(
        "(()=>{const f=movingPlatformFixture('lift');const r=Object.values((f.project ?? f).motionRigs)[0];delete r.joints[0].motor;r.forceLinks=[{id:'force',kind:'spring',bodyA:r.groups[0].id,bodyB:r.groups[1].id,anchorA:[0,-24,0],anchorB:[0,0,0],restLengthLdu:0,stiffnessNewtonsPerMetre:20,dampingNewtonsSecondsPerMetre:10}];return f;})()",
      ),
      /attachment points/,
      dynamic,
    );
  });

for (const dynamic of [true])
  test(`authored rope keeps its definition without inventing a physical attachment (${dynamic ? "Dynamic" : "Kinematic"})`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await checkPhysicalRefusal(
      page,
      laboratoryFixture(
        "(()=>{const f=movingPlatformFixture('lift');const r=Object.values((f.project ?? f).motionRigs)[0];delete r.joints[0].motor;r.forceLinks=[{id:'force',kind:'rope',bodyA:r.groups[0].id,bodyB:r.groups[1].id,anchorA:[0,-24,0],anchorB:[0,0,0],maxLengthLdu:40}];return f;})()",
      ),
      /attachment points/,
      dynamic,
    );
  });

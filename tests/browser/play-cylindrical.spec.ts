import { test } from "@playwright/test";
import {
  checkPhysicalRefusal,
  laboratoryFixture,
} from "./helpers/physical-play-policy";

for (const dynamic of [false, true])
  test(`a mathematical cylindrical bearing requires a real reviewed connection (${dynamic ? "Dynamic" : "Kinematic"})`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await checkPhysicalRefusal(
      page,
      laboratoryFixture(
        "(()=>{const f=movingPlatformFixture('turntable');const r=Object.values((f.project ?? f).motionRigs)[0];const j=r.joints[0];delete j.motor;j.kind='cylindrical';j.translationLimitsLdu=[-10,20];return f;})()",
      ),
      /physically attached/,
      dynamic,
    );
  });

import { test } from "@playwright/test";
import {
  checkPhysicalRefusal,
  laboratoryFixture,
} from "./helpers/physical-play-policy";

for (const dynamic of [false, true])
  test(`gripper attachments are refused before a normal phone Play session (${dynamic ? "Dynamic" : "Kinematic"})`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await checkPhysicalRefusal(
      page,
      laboratoryFixture("gripperFixture()"),
      /physical grasp/,
      dynamic,
    );
  });

import { test } from "@playwright/test";
import {
  checkPhysicalRefusal,
  laboratoryFixture,
} from "./helpers/physical-play-policy";

for (const dynamic of [false, true])
  test(`proximity gripper stays static without physical jaws (${dynamic ? "Dynamic" : "Kinematic"})`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await checkPhysicalRefusal(
      page,
      laboratoryFixture("gripperFixture()"),
      /real jaws/,
      dynamic,
    );
  });

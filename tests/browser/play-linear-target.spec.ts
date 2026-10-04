import { test } from "@playwright/test";
import {
  checkPhysicalRefusal,
  laboratoryFixture,
} from "./helpers/physical-play-policy";

for (const dynamic of [true])
  test(`an authored linear actuator cannot invent a motor or connection (${dynamic ? "Dynamic" : "Kinematic"})`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await checkPhysicalRefusal(
      page,
      laboratoryFixture("movingPlatformFixture('lift')"),
      /supported motor part/,
      dynamic,
    );
  });

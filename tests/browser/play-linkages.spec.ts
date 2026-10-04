import { test } from "@playwright/test";
import {
  checkPhysicalRefusal,
  laboratoryFixture,
} from "./helpers/physical-play-policy";

for (const dynamic of [false, true])
  test(`four-bar engineering linkage is retained but cannot invent physical joints (${dynamic ? "Dynamic" : "Kinematic"})`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await checkPhysicalRefusal(
      page,
      laboratoryFixture("loopFixture('four-bar')"),
      /physical joints/,
      dynamic,
    );
  });

for (const dynamic of [false, true])
  test(`slider-crank engineering linkage is retained but cannot invent physical joints (${dynamic ? "Dynamic" : "Kinematic"})`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await checkPhysicalRefusal(
      page,
      laboratoryFixture("loopFixture('slider-crank')"),
      /physical joints/,
      dynamic,
    );
  });

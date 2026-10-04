import { test } from "@playwright/test";
import { offlinePhysicalMotion } from "./helpers/offline-physical-motion";
test("cold offline reload manually slides the real two-part rack guide in both modes", async ({
  page,
  context,
}) => {
  test.setTimeout(180000);
  await offlinePhysicalMotion(page, context, "rack-drive");
});

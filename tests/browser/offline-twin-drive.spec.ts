import { test } from "@playwright/test";
import { offlinePhysicalMotion } from "./helpers/offline-physical-motion";

test("fresh offline template opening powers the real twin drive in both modes", async ({
  page,
  context,
}) => {
  test.setTimeout(180000);
  await offlinePhysicalMotion(page, context, "twin-drive");
});

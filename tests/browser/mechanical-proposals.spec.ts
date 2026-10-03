import { expect, test } from "@playwright/test";

test("reviewed ordinary hinge proposal renders its accessory and preserves authored parts", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async () => {
    const api = window.brickEditor!;
    await api.project.import({
      format: "ldraw",
      name: "finger-hinge.ldr",
      text: [
        "0 Original CC0 hinge preview arrangement",
        "1 7 0 0 0 1 0 0 0 1 0 0 0 1 4275b.dat",
        "1 4 60 0 0 -1 0 0 0 1 0 0 0 -1 4276b.dat",
        "1 14 60 -8 0 -1 0 0 0 1 0 0 0 -1 3023.dat",
      ].join("\n"),
    });
    await api.ready({ strict: true });
    const before = await api.query(),
      source = await api.project.export({ format: "ldraw" });
    const proposal = await api.mechanisms.propose({
      id: "reviewed-hinge",
      name: "Reviewed finger hinge",
      expectedRevision: before.revision,
      frameOccurrenceIds: [before.occurrences[0].id],
    });
    const unedited = await api.query(),
      unsaved = await api.mechanisms.list();
    await api.dispatch({
      schemaVersion: 1,
      commandId: "save-reviewed-hinge",
      expectedRevision: before.revision,
      type: "rigs.upsert",
      payload: { rig: proposal.rig! },
    });
    const saved = await api.query();
    await api.ready({ strict: true });
    await api.camera.fit();
    const capture = async () => {
      const image = await api.render.image({
        revision: saved.revision,
        width: 256,
        height: 256,
        format: "png",
        visibility: { mode: "all" },
        background: { type: "solid", color: "#ffffff" },
        quality: "fast",
        strict: true,
      });
      return Array.from(new Uint8Array(await image.blob.arrayBuffer()));
    };
    const closed = await api.mechanisms.enter(proposal.rig!.id),
      closedImage = await capture();
    const opened = await api.mechanisms.setJointPosition(
        proposal.rig!.joints[0].id,
        45,
      ),
      openImage = await capture();
    const posed = await api.mechanisms.exportPosedModel();
    await api.mechanisms.exit();
    return {
      before,
      unedited,
      unsaved,
      saved,
      proposal,
      closed,
      opened,
      closedImage,
      openImage,
      posed,
      source,
      after: await api.project.export({ format: "ldraw" }),
    };
  });
  expect(result.proposal.unresolved).toEqual([]);
  expect(result.unsaved).toEqual([]);
  expect(result.unedited.revision).toBe(result.before.revision);
  expect(result.unedited.occurrences).toEqual(result.before.occurrences);
  expect(result.saved.occurrences).toEqual(result.before.occurrences);
  expect(result.proposal.rig!.groups[1].occurrenceIds).toHaveLength(2);
  expect(result.openImage).not.toEqual(result.closedImage);
  for (const id of result.proposal.rig!.groups[1].occurrenceIds)
    expect(result.opened.transforms[id]).not.toEqual(
      result.closed.transforms[id],
    );
  expect(result.posed.posedOccurrenceIds).toHaveLength(3);
  expect(result.after).toEqual(result.source);
});

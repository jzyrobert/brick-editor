import { BrowserPlay } from "../../src/play/browser";
import { expect, it, vi } from "vitest";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { Editor } from "../../src/core/commands";
import { occurrences } from "../../src/core/document";
import { importLDraw } from "../../src/ldraw/io";
import { proposeMechanicalRig } from "../../src/mechanisms/mechanical-proposals";
import { reviewedProposalProject } from "../../src/mechanisms/proposal-entry";
registerFullLibraryFromDisk();
const source =
  "1 7 0 -100 0 1 0 0 0 1 0 0 0 1 4275b.dat\n1 4 60 -100 0 -1 0 0 0 1 0 0 0 -1 4276b.dat";
it("creates a private complete Play source and rejects stale, uncertain or owned drafts", () => {
  const editor = new Editor(importLDraw(source)),
    project = editor.project;
  const ids = occurrences(project).map((o) => o.id);
  const input = {
    id: "draft",
    name: "Hinge",
    expectedRevision: project.revision,
    occurrenceIds: ids,
    frameOccurrenceIds: [ids[0]],
  };
  const draft = proposeMechanicalRig(project, input),
    before = JSON.stringify(project);
  const copy = reviewedProposalProject(project, input, draft);
  expect(copy.motionRigs.draft).toEqual(draft.rig);
  expect(JSON.stringify(project)).toBe(before);
  copy.motionRigs.draft.name = "Session only";
  expect(draft.rig!.name).toBe("Hinge");
  expect(() =>
    reviewedProposalProject(
      { ...project, revision: project.revision + 1 },
      input,
      draft,
    ),
  ).toThrow("changed");
  expect(() =>
    reviewedProposalProject(project, input, {
      ...draft,
      unresolved: [{ occurrenceIds: [ids[1]], reason: "Unknown contact" }],
    }),
  ).toThrow("uncertain");
  expect(() => reviewedProposalProject(copy, input, draft)).toThrow(
    "already owns",
  );
});

it("cancels an asynchronous proposal entry before allocating a Play world", async () => {
  const project = importLDraw(source),
    ids = occurrences(project).map((o) => o.id);
  const play = new BrowserPlay(
    () => undefined,
    () => project.revision,
    () => {},
    () => project,
  );
  const pending = play.enterProposal({
    id: "draft",
    name: "Hinge",
    expectedRevision: project.revision,
    frameOccurrenceIds: [ids[0]],
    occurrenceIds: ids,
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal("document", {});
  try {
    play.exit();
    await expect(pending).rejects.toThrow("cancelled");
  } finally {
    vi.unstubAllGlobals();
  }
  expect(play.getState().active).toBe(false);
  expect(project.motionRigs).toEqual({});
});

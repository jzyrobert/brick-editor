import { expect, it } from "vitest";
import { pdfStepLayout } from "../../src/instructions/pdf-layout";

const base = {
  imageWidth: 600,
  imageHeight: 450,
  summaryLines: 1,
  operationLines: 1,
  supportingCaptionLines: [1],
  actionLines: 7,
  lotCount: 1,
  measureParts: () => 54,
};
it("uses an actual parts column without shrinking main, receiver or text regions", () => {
  const layout = pdfStepLayout(base);
  expect(layout.main.height).toBe(315);
  expect(layout.main.width / layout.main.height).toBeCloseTo(600 / 450);
  expect(layout.partsColumn).toMatchObject({ x: 215, width: 340 });
  expect(layout.bodyY - base.actionLines * 16).toBeGreaterThanOrEqual(55);
  expect(layout.partsColumn!.rowY - 54).toBeGreaterThan(layout.bodyY);
  expect(layout.partsColumn!.x).toBeGreaterThan(layout.supportingX[0] + 120);
  // Main, operation caption, 90pt receiver, its complete caption and action
  // paragraph occupy separate measured regions.
  expect(layout.operationY + 10).toBeLessThan(layout.main.y);
  expect(layout.supportingY + 90).toBeLessThan(layout.operationY);
  expect(layout.captionY + 8).toBeLessThan(layout.supportingY);
  expect(layout.bodyY + 11).toBeLessThan(layout.captionY);
});
it("fits two actual before/context images and measures multiline captions and long lot names", () => {
  let measured = 0;
  const layout = pdfStepLayout({
    ...base,
    supportingCaptionLines: [1, 3],
    actionLines: 5,
    measureParts: (width) => {
      measured = width;
      return 95;
    },
  });
  expect(measured).toBe(235);
  expect(layout.supportingX).toEqual([40, 180]);
  expect(layout.partsColumn?.x).toBe(320);
  expect(layout.bodyY + 11).toBeLessThan(layout.captionY - 20);
  const rejected = pdfStepLayout({
    ...base,
    supportingCaptionLines: [1, 3],
    measureParts: () => 600,
  });
  expect(rejected.partsColumn).toBeUndefined();
  expect(rejected.supportingX).toEqual([40, 215]);
  expect(rejected.bodyY + 11).toBeLessThan(rejected.captionY - 20);
});
it("reclaims absent rows and wide-image whitespace while preserving original image scale", () => {
  const wide = pdfStepLayout({
    ...base,
    imageWidth: 1200,
    imageHeight: 300,
    operationLines: 0,
    supportingCaptionLines: [],
  });
  expect(wide.main.width).toBe(515);
  expect(wide.main.height).toBe(128.75);
  expect(wide.bodyY).toBeGreaterThan(500);
  expect(wide.bodyY + 11).toBeLessThan(wide.main.y);
  expect(wide.partsColumn).toBeUndefined();
  const portrait = pdfStepLayout({
    ...base,
    imageWidth: 450,
    imageHeight: 900,
  });
  expect(portrait.main.height).toBe(315);
  expect(portrait.main.width).toBe(157.5);
});
it("retains all three incoming/context/before images on zero-new-part joins", () => {
  const layout = pdfStepLayout({
    ...base,
    lotCount: 0,
    supportingCaptionLines: [1, 1, 2],
    operationLines: 2,
  });
  expect(layout.partsColumn).toBeUndefined();
  expect(layout.supportingX).toEqual([40, 215, 390]);
  expect(layout.supportingX[2] + 120).toBeLessThan(555);
  expect(layout.bodyY + 11).toBeLessThan(layout.captionY - 10);
});
it("wraps the fourth supporting receiver into a measured row within the page margins", () => {
  const layout = pdfStepLayout({
    ...base,
    lotCount: 0,
    supportingCaptionLines: [1, 2, 3, 2],
    operationLines: 2,
  });
  expect(layout.supportingPositions).toHaveLength(4);
  const fourth = layout.supportingPositions[3];
  const firstRowBottom = layout.supportingPositions[2].captionY - 20;
  expect(fourth.y + 90).toBeLessThan(firstRowBottom);
  expect(layout.bodyY + 11).toBeLessThan(fourth.captionY - 10);
  for (const position of layout.supportingPositions) {
    expect(position.x).toBeGreaterThanOrEqual(40);
    expect(position.x + 120).toBeLessThanOrEqual(555);
    expect(position.y).toBeGreaterThan(55);
  }
  expect(layout.main).toEqual(pdfStepLayout(base).main);
});
it("reserves the actual printed header without shrinking the accepted main diagram", () => {
  const original = pdfStepLayout(base);
  const corrected = pdfStepLayout({
    ...base,
    summaryLines: 2,
    imageHeaderLines: 1,
  });
  expect(corrected.main.width).toBe(original.main.width);
  expect(corrected.main.height).toBe(original.main.height);
  expect(corrected.main.y).toBe(original.main.y - 13);
  expect(corrected.bodyY).toBe(original.bodyY - 13);
});
it("keeps all short marker legends with mixed lots instead of adopting an orphaning sidebar", () => {
  const layout = pdfStepLayout({
    ...base,
    summaryLines: 2,
    operationLines: 0,
    supportingCaptionLines: [1, 1],
    actionLines: 5,
    explanationLines: 4,
    lotCount: 3,
    measureParts: () => 162,
    measurePartGrid: () => 59,
  });
  expect(layout.partsColumn).toBeUndefined();
  expect(layout.partsGrid).toEqual({
    x: [40, 215, 390],
    width: 165,
    height: 59,
  });
  expect(layout.bodyY - 5 * 16 - 12 - 30 - 59 - 3 * 16).toBeGreaterThanOrEqual(
    55,
  );
  const long = pdfStepLayout({
    ...base,
    explanationLines: 80,
    lotCount: 3,
    measureParts: () => 162,
    measurePartGrid: () => 1000,
  });
  expect(long.partsGrid).toBeUndefined();
});

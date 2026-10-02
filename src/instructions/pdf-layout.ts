/** Measured pictorial PDF regions. These positions never change source diagrams. */
export function pdfStepLayout(options: {
  imageWidth: number;
  imageHeight: number;
  summaryLines: number;
  /** Legacy header allowance preserves the accepted diagram's drawn scale. */
  imageHeaderLines?: number;
  operationLines: number;
  supportingCaptionLines: number[];
  actionLines: number;
  explanationLines?: number;
  lotCount: number;
  measureParts: (width: number) => number;
  measurePartGrid?: (width: number) => number;
}) {
  const count = options.supportingCaptionLines.length;
  const headerAllowance = options.imageHeaderLines ?? options.summaryLines;
  // Retain the previous publisher's main image scale, including its CAD header
  // allowance. Top alignment recovers unused space for wide diagrams.
  const scale = Math.min(
    515 / options.imageWidth,
    (340 - (headerAllowance ? headerAllowance * 13 + 12 : 0)) /
      options.imageHeight,
  );
  const main = {
    x: (595.28 - options.imageWidth * scale) / 2,
    y:
      (options.summaryLines ? 744 - options.summaryLines * 13 : 746) -
      options.imageHeight * scale,
    width: options.imageWidth * scale,
    height: options.imageHeight * scale,
  };
  const operationY = main.y - 15;
  const operationCount = Math.min(2, options.operationLines);
  const rowTop = operationCount
    ? operationY - (operationCount - 1) * 13 - 12
    : main.y - 12;
  const supportingY = rowTop - 90;
  const captionY = supportingY - 13;
  const supportingPositions: { x: number; y: number; captionY: number }[] = [];
  let nextRowTop = rowTop;
  let captionBottom = captionY;
  for (let first = 0; first < count; first += 3) {
    const captions = options.supportingCaptionLines.slice(first, first + 3);
    const y = nextRowTop - 90;
    const rowCaptionY = y - 13;
    captionBottom = rowCaptionY - (Math.max(1, ...captions) - 1) * 10;
    for (let column = 0; column < captions.length; column++)
      supportingPositions.push({
        x: 40 + column * 175,
        y,
        captionY: rowCaptionY,
      });
    nextRowTop = captionBottom - 16;
  }
  let bodyY = count ? captionBottom - 16 : rowTop - 11;
  let partsColumn:
    | { x: number; width: number; headingY: number; rowY: number }
    | undefined;
  let fallbackColumn: typeof partsColumn;
  const actionHeight =
    options.actionLines * 16 + (options.actionLines ? 12 : 0);
  const explanationHeight =
    Math.max(0, (options.explanationLines ?? 0) - 1) * 16;
  const textHeight = actionHeight + explanationHeight;
  if (options.lotCount && (count === 1 || count === 2)) {
    const x = count === 1 ? 215 : 320;
    const width = 555 - x;
    const headingY = rowTop - 14;
    const rowY = headingY - 30;
    const bottom = rowY - options.measureParts(width);
    const candidateBodyY = Math.min(bodyY, bottom - 16);
    // A side column must not displace an ordinary complete action paragraph.
    // Long names/multiple lots can instead keep the full-width parts layout.
    if (options.actionLines * 16 <= candidateBodyY - 55) {
      const candidate = { x, width, headingY, rowY };
      fallbackColumn = candidate;
      if (textHeight <= candidateBodyY - 55) {
        partsColumn = candidate;
        bodyY = candidateBodyY;
      }
    }
  }
  let partsGrid: { x: number[]; width: number; height: number } | undefined;
  if (
    !partsColumn &&
    options.measurePartGrid &&
    options.lotCount >= 2 &&
    options.lotCount <= 3
  ) {
    const count = options.lotCount;
    const width = (515 - (count - 1) * 10) / count;
    const height = options.measurePartGrid(width);
    if (textHeight + 30 + height <= bodyY - 55)
      partsGrid = {
        x: Array.from({ length: count }, (_, n) => 40 + n * (width + 10)),
        width,
        height,
      };
  }
  // Long content can still use an action-fitting column and honest notes
  // continuation when no complete measured arrangement fits the main sheet.
  if (!partsColumn && !partsGrid && fallbackColumn) {
    partsColumn = fallbackColumn;
    bodyY = Math.min(
      bodyY,
      fallbackColumn.rowY - options.measureParts(fallbackColumn.width) - 16,
    );
  }
  const supportingX = Array.from(
    { length: count },
    (_, n) => 40 + (n % 3) * (partsColumn && count === 2 ? 140 : 175),
  );
  supportingPositions.forEach((position, n) => {
    position.x = supportingX[n];
  });
  return {
    main,
    operationY,
    supportingX,
    supportingY,
    captionY,
    supportingPositions,
    bodyY,
    partsColumn,
    partsGrid,
  };
}

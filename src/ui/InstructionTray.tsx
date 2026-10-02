import { useEffect } from "react";
import { loadFullCatalog } from "../catalog/full-library-loader";
import type { Project } from "../core/types";
import { partSpec } from "../catalog/extended";
import { paletteColors } from "../catalog/color-availability";
import { PartThumb, GenericThumb } from "./PartThumbs";
import { instructionLots } from "../instructions/lots";
export function InstructionTray({
  project,
  ids,
  physical = false,
}: {
  project: Project;
  ids: string[];
  physical?: boolean;
}) {
  useEffect(() => {
    void loadFullCatalog().catch(() => undefined);
  }, []);
  const lots = instructionLots(project, ids, {
    named: true,
    physical,
    allowPartial: true,
  });
  return (
    <div aria-label="Parts for this step" className="instruction-part-tray">
      {lots.map((l) => {
        const part = !l.kind ? partSpec(l.thumbnailRef ?? l.ref) : undefined,
          color = paletteColors.find((c) => c.code === l.colorCode);
        return (
          <div
            key={JSON.stringify([l.ref, l.colorCode, l.kind])}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              margin: "8px 0",
              fontSize: 12,
            }}
          >
            {part ? (
              <PartThumb part={part} color={color?.hex} />
            ) : (
              <GenericThumb />
            )}
            <span>
              <strong>
                {l.kind === "drawing" ? "Drawing only: " : l.quantity + " × "}
                {l.name ?? l.ref}
              </strong>
              <br />
              {l.colorName}
              <br />
              <small>
                {l.kind ? "Check physical identity and part breakdown" : l.ref}
              </small>
            </span>
          </div>
        );
      })}
    </div>
  );
}

import {
  mechanismFixture,
  openBenchFixture,
  physicsFixture,
} from "../mechanisms/fixtures";
import { doorRoomSource } from "./door-room";
import { houseSource } from "./builds/house";
import { castleProject } from "./builds/castle";
import { carProject } from "./builds/car";
import { jeepProject } from "./builds/jeep";
import { windmillProject } from "./builds/windmill";
import { cafeProject } from "./builds/cafe";
import { lighthouseProject } from "./builds/lighthouse";
import { playgroundProject } from "./builds/playground";
import type { TemplateName } from "./template-names";
import type { BackdropName } from "../core/scene";
import { explorationSource } from "./exploration";
import { importLDraw } from "../ldraw/io";
import { createProject } from "../core/document";
import { identity, rotationY } from "../core/math";
import { uid, type Vec3 } from "../core/types";
/** Each sample opens on a backdrop that suits it (saved in project.scene). */
export const TEMPLATE_BACKDROPS: Partial<Record<TemplateName, BackdropName>> = {
  house: "grass",
  castle: "grass",
  windmill: "grass",
  car: "street",
  jeep: "street",
  cafe: "street",
  lighthouse: "beach",
  playground: "grass",
};
export function template(name: TemplateName) {
  const project = templateProject(name);
  const backdrop = TEMPLATE_BACKDROPS[name];
  if (backdrop) project.scene = { ...project.scene, backdrop };
  return project;
}
function templateProject(name: TemplateName) {
  if (name === "house") {
    const project = importLDraw(houseSource(), "house-with-garden.mpd");
    project.title = "House with garden";
    return project;
  }
  if (name === "castle") return castleProject();
  if (name === "car") return carProject();
  if (name === "jeep") return jeepProject();
  if (name === "windmill") return windmillProject();
  if (name === "cafe") return cafeProject();
  if (name === "lighthouse") return lighthouseProject();
  if (name === "playground") return playgroundProject();
  if (name === "seated-vehicle") return openBenchFixture();
  if (name === "physics") return physicsFixture();
  if (name === "door-room") {
    const project = importLDraw(doorRoomSource(), "door-room.ldr");
    project.title = "Door room";
    return project;
  }
  if (name === "mechanisms") return mechanismFixture();
  if (name === "explore") {
    const project = importLDraw(explorationSource(), "exploration.mpd");
    project.title = "Exploration room";
    return project;
  }
  const p = createProject(
    name === "blank"
      ? "Untitled build"
      : name === "room"
        ? "Courtyard studio"
        : name === "200"
          ? "200-part conformance build"
          : "Brick wall",
  );
  const nodes = p.models.root.nodes;
  const place = (ref: string, colorCode: string, position: Vec3, angle = 0) =>
    nodes.push({
      id: uid(),
      kind: "part",
      ref,
      colorCode,
      transform: { position, basis: rotationY(angle) },
    });
  if (name === "200") {
    for (let i = 0; i < 200; i++)
      place("3001.dat", i % 2 ? "4" : "15", [
        (i % 20) * 80,
        -24,
        Math.floor(i / 20) * 40,
      ]);
    return p;
  }
  if (name === "wall") {
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 8; x++)
        place("3001.dat", y === 4 ? "0" : "4", [x * 80, -24 * (y + 1), 0]);
    return p;
  }
  if (name === "room") {
    for (let z = 0; z < 6; z++)
      for (let x = 0; x < 5; x++)
        place("3020.dat", "15", [(x - 2) * 80, -8, (z - 2.5) * 40]);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 5; x++)
        place("3001.dat", y === 3 ? "1" : "15", [
          (x - 2) * 80,
          -32 - y * 24,
          -140,
        ]);
      for (let z = 0; z < 3; z++)
        place(
          "3001.dat",
          y === 3 ? "1" : "15",
          [-220, -32 - y * 24, (z - 1) * 80],
          90,
        );
      for (let z = 0; z < 3; z++)
        if (z !== 1 || y >= 3)
          place(
            "3001.dat",
            y === 3 ? "1" : "15",
            [220, -32 - y * 24, (z - 1) * 80],
            90,
          );
    }
    for (let x = 0; x < 2; x++) place("3003.dat", "14", [x * 40 - 20, -32, 40]);
    place("3020.dat", "4", [0, -40, 40]);
  }
  return p;
}

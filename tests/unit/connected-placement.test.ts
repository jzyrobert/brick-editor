// "Snap together" building: which placements and moves hold.
import { describe, expect, it } from "vitest";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { verifiedConnectors } from "../../src/catalog/connectors";
import type { Basis, Transform, Vec3 } from "../../src/core/types";
import {
  checkConnection,
  checkGroup,
  checkMove,
  placementScene,
} from "../../src/edit/connected-placement";
import { hingeCandidates } from "../../src/edit/snap";

const ldr = (lines: string[]) =>
  importLDraw("0 FILE t.ldr\n" + lines.join("\n"));
const I: Basis = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const line = (x: number, y: number, z: number, ref: string) =>
  `1 4 ${x} ${y} ${z} 1 0 0 0 1 0 0 0 1 ${ref}`;
const at = (x: number, y: number, z: number, basis = I): Transform => ({
  position: [x, y, z] as Vec3,
  basis,
});
const sceneOf = (lines: string[]) => placementScene(ldr(lines));

describe("connected placement", () => {
  it("counts the ground, and refuses a floating part", () => {
    const empty = sceneOf([]);
    // A 2 × 4 brick's origin is its body top; 24 LDU tall.
    const ground = checkConnection("3001.dat", at(0, -24, 0), empty);
    expect(ground).toMatchObject({ ok: true, via: "ground", verified: true });
    const floating = checkConnection("3001.dat", at(0, -48, 0), empty);
    expect(floating).toMatchObject({ ok: false, reason: "floating" });
    expect(floating.message).toMatch(/Nothing to connect to here/);
    // Sunk into the ground is not on it either.
    expect(checkConnection("3001.dat", at(0, 8, 0), empty).ok).toBe(false);
  });

  it("holds by studs, and refuses verified parts that only touch", () => {
    const scene = sceneOf([line(0, -24, 0, "3001.dat")]);
    const on = checkConnection("3001.dat", at(0, -48, 0), scene);
    expect(on).toMatchObject({ ok: true, via: "studs", contacts: 8 });
    expect(on.targetIds).toHaveLength(1);
    // Half a stud off the lattice: resting on top, but no stud mates.
    const off = checkConnection("3001.dat", at(10, -48, 0), scene);
    expect(off).toMatchObject({ ok: false, reason: "floating" });
    // Hanging under an overhang: its own studs sit in the anti-studs above.
    const hanging = checkConnection(
      "3004.dat",
      at(60, -48, 10),
      sceneOf([
        line(0, -24, 0, "3001.dat"),
        line(0, -48, 0, "3001.dat"),
        line(40, -72, 0, "3001.dat"),
      ]),
    );
    expect(hanging).toMatchObject({ ok: true, via: "studs", contacts: 2 });
  });

  it("holds on a baseplate's studs, and the baseplate on the ground", () => {
    expect(verifiedConnectors("3811.dat")).not.toBeNull();
    const empty = sceneOf([]);
    // A 32 × 32 baseplate is 4 LDU thick below its origin.
    expect(checkConnection("3811.dat", at(0, -4, 0), empty).via).toBe("ground");
    const scene = sceneOf([line(0, -4, 0, "3811.dat")]);
    expect(checkConnection("3001.dat", at(0, -28, 0), scene)).toMatchObject({
      ok: true,
      via: "studs",
      contacts: 8,
    });
    // One plate higher it would float above the baseplate.
    expect(checkConnection("3001.dat", at(0, -36, 0), scene).ok).toBe(false);
  });

  it("refuses a clash even where studs would mate", () => {
    const scene = sceneOf([line(0, -24, 0, "3001.dat")]);
    const clash = checkConnection("3001.dat", at(20, -24, 0), scene);
    expect(clash).toMatchObject({ ok: false, reason: "clash" });
    expect(clash.message).toMatch(/in the way/);
  });

  it("holds a door seated in its frame by the hinge pins", () => {
    const frame = [line(0, 0, 0, "60596.dat")];
    const scene = sceneOf(frame);
    const [fit] = hingeCandidates("60616a.dat", { point: [-30, 70, 5] }, scene);
    expect(fit).toBeTruthy();
    const check = checkConnection(
      "60616a.dat",
      { position: fit.position, basis: fit.basis },
      scene,
    );
    expect(check).toMatchObject({ ok: true, via: "hinge", verified: true });
    // The same door beside the frame, off the ground, floats.
    expect(checkConnection("60616a.dat", at(200, -20, 0), scene).ok).toBe(
      false,
    );
  });

  it("lets unverified parts rest on a part's top, marked unchecked", () => {
    expect(verifiedConnectors("2450.dat")).toBeNull();
    const scene = sceneOf([line(0, -24, 0, "3001.dat")]);
    const rest = checkConnection("2450.dat", at(0, -32, 0), scene);
    expect(rest).toMatchObject({ ok: true, via: "resting", verified: false });
    expect(rest.message).toMatch(/isn’t checked/);
    // On the ground it holds like any part; in the air it floats.
    expect(checkConnection("2450.dat", at(0, -8, 0), sceneOf([])).via).toBe(
      "ground",
    );
    expect(checkConnection("2450.dat", at(0, -80, 0), scene).ok).toBe(false);
    // Beside the brick (no footprint overlap) it does not rest on it.
    expect(checkConnection("2450.dat", at(200, -32, 0), scene).ok).toBe(false);
  });

  it("lets a verified part rest on an unverified one, but not float above it", () => {
    const scene = sceneOf([
      line(0, -8, 0, "3068b.dat"),
      line(0, -24, 0, "2450.dat"),
    ]);
    // 2450's top sits 24 LDU up; a brick on it is not stud-checked.
    const rest = checkConnection("3001.dat", at(0, -48, 0), scene);
    expect(rest).toMatchObject({ ok: true, via: "resting", verified: false });
    expect(checkConnection("3001.dat", at(0, -64, 0), scene).ok).toBe(false);
  });
});

describe("connected moves", () => {
  const project = ldr([
    line(0, -24, 0, "3001.dat"),
    line(0, -48, 0, "3001.dat"),
    line(200, -24, 0, "3001.dat"),
  ]);
  const [base, top, other] = occurrences(project);
  it("keeps a group that holds outside itself, and refuses one lifted off", () => {
    // Moving the top brick onto the other brick's studs holds.
    expect(checkGroup(project, { [top.id]: at(200, -48, 0) }).via).toBe(
      "studs",
    );
    // Lifting both stacked bricks off the ground floats them: the top one
    // holding on the bottom one does not count (both move).
    const lifted = checkMove(project, {
      [base.id]: at(0, -48, 0),
      [top.id]: at(0, -72, 0),
    });
    expect(lifted).toMatchObject({ ok: false, reason: "floating" });
    // Moved together along the ground they still hold.
    expect(
      checkMove(project, {
        [base.id]: at(0, -24, 100),
        [top.id]: at(0, -48, 100),
      }).ok,
    ).toBe(true);
    expect(checkMove(project, { [other.id]: at(200, -60, 0) }).ok).toBe(false);
  });
  it("moves parts that already floated freely", () => {
    const floating = ldr([line(0, -100, 0, "3001.dat")]);
    const [o] = occurrences(floating);
    const move = checkMove(floating, { [o.id]: at(0, -140, 0) });
    expect(move).toMatchObject({ ok: true, before: false });
  });
});

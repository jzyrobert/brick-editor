import { beforeAll, describe, expect, it } from "vitest";
import {
  BufferAttribute,
  BufferGeometry,
  Line3,
  Matrix4,
  Vector3,
} from "three";
import { MeshBVH } from "three-mesh-bvh";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { mechanicalContactGraph } from "../../src/mechanisms/mechanical-contacts";
import { MECHANICAL_PARTS } from "../../src/mechanisms/mechanical-pack";
import { rackFixture } from "../../src/mechanisms/rack-fixture";
import { meshOf } from "../helpers/play-dynamic-source";

registerFullLibraryFromDisk();

describe("pinned rack bottom-beam mounting and housing end clearance", () => {
  let housing: MeshBVH, rack: MeshBVH, supports: MeshBVH, pinion: MeshBVH;
  const sources = fullLibrarySources([
    "18940.dat",
    "18942.dat",
    "3701.dat",
    "3705.dat",
    "3648b.dat",
    "4265a.dat",
  ]);
  beforeAll(async () => {
    const { project } = rackFixture(),
      all = occurrences(project);
    const trees = await Promise.all(
      [[0], [7], [1, 2], [3, 4, 5, 6]].map(async (indices) => {
        const mesh = await meshOf(
            project,
            indices.map((i) => all[i].id),
            sources,
          ),
          geometry = new BufferGeometry();
        geometry.setAttribute(
          "position",
          new BufferAttribute(mesh.vertices, 3),
        );
        geometry.setIndex(new BufferAttribute(mesh.indices, 1));
        return new MeshBVH(geometry, { maxLeafTris: 8 });
      }),
    );
    [housing, rack, supports, pinion] = trees;
  });

  // The authored rest position is X=-40, Y=-20 relative to the housing. Shared
  // cheek faces may touch: only a nonparallel intersection whose midpoint lies
  // strictly inside both triangles is counted as a transverse source crossing.
  // This surface test is a mounting regression check, not native solver proof.
  function sourceCrossings(aTree: MeshBVH, bTree: MeshBVH, transform: Matrix4) {
    let transverse = 0,
      touching = 0;
    const line = new Line3(),
      normalA = new Vector3(),
      normalB = new Vector3(),
      midpoint = new Vector3(),
      baryA = new Vector3(),
      baryB = new Vector3();
    aTree.bvhcast(bTree, transform, {
      intersectsTriangles(a, b) {
        const parallel =
          Math.abs(a.getNormal(normalA).dot(b.getNormal(normalB))) >= 0.99999;
        if (!a.intersectsTriangle(b, parallel ? undefined : line)) return false;
        touching++;
        if (!parallel && line.distance() > 1e-4) {
          line.getCenter(midpoint);
          a.getBarycoord(midpoint, baryA);
          b.getBarycoord(midpoint, baryB);
          if (
            [baryA.x, baryA.y, baryA.z, baryB.x, baryB.y, baryB.z].every(
              (n) => n > 1e-5,
            )
          )
            transverse++;
        }
        return false;
      },
    });
    return { transverse, touching };
  }
  function crossings(globalX: number, globalY = -20) {
    return sourceCrossings(
      housing,
      rack,
      new Matrix4().makeTranslation(globalX + 40, globalY + 20, 0),
    );
  }

  it("anchors the guide to the source bottom beam, not its narrow tooth web", () => {
    expect(sources["18940.dat"]).toContain(
      "1 16 20 -13 14 80 0 0 0 -1 0 0 0 4 box2-9p.dat",
    );
    expect(sources["18940.dat"]).toContain(
      "1 16 20 -27 14 -80 0 0 0 1 0 0 0 4 box2-9p.dat",
    );
    expect(sources["18942.dat"]).toContain("2 24 -121 -19 -2 -121 -9 -2");
    expect(sources["18942.dat"]).toContain("2 24 -121 -19 2 -121 -9 2");
    expect(sources["18942.dat"]).toContain(
      "1 16 130 0 -10 0 0 -1 1 0 0 0 20 0 axlehol4.dat",
    );
    expect(MECHANICAL_PARTS["18942.dat"].features[0]).toMatchObject({
      kind: "rack-slide",
      center: [0, 0, 0],
      mate: "18942-bottom-beam",
    });
    const { project } = rackFixture(),
      guide = mechanicalContactGraph(project).contacts.find(
        (c) => c.kind === "rack-guide",
      );
    // Guide engagement alone permits -110; pinion tooth support narrows it to
    // -88 in the final proposal. The source housing stop narrows +230 to +10.
    expect(guide).toMatchObject({ kind: "rack-guide", limits: [-110, 10] });
  });

  it("keeps the accepted travel clear of transverse source crossings", () => {
    const { proposal } = rackFixture(),
      limits = proposal.rig!.joints[1].limits!;
    expect(limits).toEqual([-88, 10]);
    for (let localX = limits[0]; localX <= limits[1]; localX++)
      expect(crossings(localX - 40).transverse, `slider ${localX} LDU`).toBe(0);
    for (const localX of [-25 * Math.PI, 8])
      expect(crossings(localX - 40).transverse, `slider ${localX} LDU`).toBe(0);
    expect(crossings(-40).touching).toBeGreaterThan(0);
  }, 15000);

  it("keeps reviewed pinion supports and its angular travel outside the housing", () => {
    expect(sourceCrossings(housing, supports, new Matrix4()).transverse).toBe(
      0,
    );
    // The 24T pinion puts its axle at Y=-75, below the housing lower beam.
    // An 8T pinion at Y=-55 leaves the reviewed bearings crossing that beam.
    const { proposal } = rackFixture(),
      limits = proposal.rig!.joints[1].limits!,
      lowerAngle = (-limits[1] / 30) * (180 / Math.PI),
      upperAngle = (-limits[0] / 30) * (180 / Math.PI),
      angles = [lowerAngle, upperAngle];
    for (let angle = Math.ceil(lowerAngle); angle <= upperAngle; angle++)
      angles.push(angle);
    for (const angle of angles) {
      const rotation = new Matrix4()
        .makeTranslation(4, -235, 0)
        .multiply(new Matrix4().makeRotationZ((angle * Math.PI) / 180))
        .multiply(new Matrix4().makeTranslation(-4, 235, 0));
      expect(
        sourceCrossings(housing, pinion, rotation).transverse,
        `pinion ${angle} degrees`,
      ).toBe(0);
    }
    expect(
      sourceCrossings(
        housing,
        supports,
        new Matrix4().makeTranslation(0, 20, 0),
      ).transverse,
    ).toBeGreaterThan(0);
  });

  it("detects the former mounting interference and actual housing end obstruction", () => {
    expect(crossings(0, -6).transverse).toBeGreaterThan(0);
    expect(crossings(-29).transverse).toBe(0);
    expect(crossings(-28).transverse).toBeGreaterThan(0);
    // Accepted upper travel stops one LDU before the source boundary at X=-29.
    const { project, proposal } = rackFixture(),
      rackNode = project.models[project.rootModelId].nodes[7];
    expect(
      rackNode.transform.position[0] + proposal.rig!.joints[1].limits![1],
    ).toBe(-30);
    rackNode.transform.position[0] = -28;
    const graph = mechanicalContactGraph(project);
    expect(graph.contacts.some((c) => c.kind === "rack-guide")).toBe(false);
    expect(graph.rejected.some((r) => /end clearance/.test(r.reason))).toBe(
      true,
    );
  });
});

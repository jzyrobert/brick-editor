import RAPIER from "@dimforge/rapier3d-compat";
import { ensure } from "../core/types";
import {
  drivingCoordinate,
  sweepDrivingBoxes,
  type DrivingBox,
  type DrivingObstacle,
  type DrivingPose,
  type DrivingSweep,
} from "./vehicle-collision";

/** Complete immutable world-space snapshot. Conversion from LDraw is deliberately
 * outside this adapter; callers must supply Rapier metres and +Y up explicitly. */
export type DrivingTriangleSource = {
  sourceId: string;
  units: "metres";
  up: "+Y";
  owner: DrivingObstacle["owner"];
  vertices: Float32Array;
  indices: Uint32Array;
};
type Bound = [number, number, number, number, number, number];
type Branch = {
  bounds: Bound;
  start: number;
  end: number;
  left?: Branch;
  right?: Branch;
};
export type ObstacleSweep = DrivingSweep & {
  units: "metres";
  totalTriangles: number;
  candidateTriangles: number;
  visitedBvhNodes: number;
  obstacle?: { sourceId: string; triangleIndex: number };
};
const overlaps = (a: Bound, b: Bound) =>
  a[0] <= b[3] &&
  a[3] >= b[0] &&
  a[1] <= b[4] &&
  a[4] >= b[1] &&
  a[2] <= b[5] &&
  a[5] >= b[2];
const freshBounds = (): Bound => [
  Infinity,
  Infinity,
  Infinity,
  -Infinity,
  -Infinity,
  -Infinity,
];

/** BVH contains every triangle, including degenerates and duplicate/back faces.
 * Budget failures reject a complete operation; there is no truncated collider set.
 * This adapter certifies candidate completeness, not vehicle proxy containment. */
export class DrivingObstacleSnapshot {
  private readonly sources: DrivingTriangleSource[];
  private readonly sourceIndex: Uint32Array;
  private readonly triangleIndex: Uint32Array;
  private readonly bounds: Float64Array;
  private readonly order: Uint32Array;
  private readonly root?: Branch;
  readonly totalTriangles: number;
  constructor(
    sources: readonly DrivingTriangleSource[],
    maxTriangles = 200000,
  ) {
    ensure(
      Number.isInteger(maxTriangles) &&
        maxTriangles > 0 &&
        maxTriangles <= 1000000,
      "INVALID_INPUT",
      "Driving triangle budget must be 1–1,000,000",
    );
    ensure(
      sources.length <= 1024,
      "LIMIT_EXCEEDED",
      "Driving obstacle snapshot exceeds 1,024 sources",
    );
    let total = 0,
      vertexCount = 0;
    const ids = new Set<string>();
    for (const source of sources) {
      ensure(
        source.units === "metres" &&
          source.up === "+Y" &&
          typeof source.sourceId === "string" &&
          source.sourceId.length > 0 &&
          !ids.has(source.sourceId),
        "INVALID_INPUT",
        "Driving obstacle sources need distinct IDs and explicit metre/+Y units",
      );
      ids.add(source.sourceId);
      ensure(
        source.owner.kind === "static" ||
          source.owner.kind === "actor" ||
          (source.owner.kind === "rig" &&
            typeof source.owner.rigId === "string"),
        "INVALID_INPUT",
        "Invalid driving collider ownership",
      );
      ensure(
        source.vertices.length % 3 === 0 && source.indices.length % 3 === 0,
        "INVALID_INPUT",
        "Driving triangle arrays must contain complete triples",
      );
      total += source.indices.length / 3;
      vertexCount += source.vertices.length / 3;
      ensure(
        total <= maxTriangles && vertexCount <= maxTriangles * 3,
        "LIMIT_EXCEEDED",
        "Driving obstacle snapshot exceeds complete geometry budget",
      );
      ensure(
        source.vertices.every(drivingCoordinate) &&
          source.indices.every((i) => i < source.vertices.length / 3),
        "INVALID_INPUT",
        "Invalid driving obstacle vertex/index",
      );
    }
    this.sources = sources.map((s) => ({
      ...s,
      owner: { ...s.owner },
      vertices: s.vertices.slice(),
      indices: s.indices.slice(),
    }));
    this.totalTriangles = total;
    this.sourceIndex = new Uint32Array(total);
    this.triangleIndex = new Uint32Array(total);
    this.bounds = new Float64Array(total * 6);
    this.order = new Uint32Array(total);
    let n = 0;
    this.sources.forEach((source, sourceId) => {
      for (
        let triangle = 0;
        triangle < source.indices.length / 3;
        triangle++, n++
      ) {
        this.sourceIndex[n] = sourceId;
        this.triangleIndex[n] = triangle;
        this.order[n] = n;
        const bounds = freshBounds();
        for (let corner = 0; corner < 3; corner++) {
          const index = source.indices[triangle * 3 + corner] * 3;
          for (let axis = 0; axis < 3; axis++) {
            bounds[axis] = Math.min(
              bounds[axis],
              source.vertices[index + axis],
            );
            bounds[axis + 3] = Math.max(
              bounds[axis + 3],
              source.vertices[index + axis],
            );
          }
        }
        this.bounds.set(bounds, n * 6);
      }
    });
    const build = (start: number, end: number): Branch => {
      const bounds = freshBounds();
      for (let i = start; i < end; i++)
        for (let axis = 0; axis < 3; axis++) {
          bounds[axis] = Math.min(
            bounds[axis],
            this.bounds[this.order[i] * 6 + axis],
          );
          bounds[axis + 3] = Math.max(
            bounds[axis + 3],
            this.bounds[this.order[i] * 6 + axis + 3],
          );
        }
      const branch: Branch = { bounds, start, end };
      if (end - start > 8) {
        let axis = 0;
        for (let a = 1; a < 3; a++)
          if (bounds[a + 3] - bounds[a] > bounds[axis + 3] - bounds[axis])
            axis = a;
        this.order
          .subarray(start, end)
          .sort(
            (a, b) =>
              this.bounds[a * 6 + axis] +
                this.bounds[a * 6 + axis + 3] -
                (this.bounds[b * 6 + axis] + this.bounds[b * 6 + axis + 3]) ||
              a - b,
          );
        const mid = start + Math.floor((end - start) / 2);
        branch.left = build(start, mid);
        branch.right = build(mid, end);
      }
      return branch;
    };
    if (total) this.root = build(0, total);
  }
  sweep(
    rigId: string,
    boxes: readonly DrivingBox[],
    from: DrivingPose,
    to: DrivingPose,
    budget: { queries?: number; candidates?: number } = {},
  ): ObstacleSweep {
    // Validate pose/proxy inputs even when the broadphase finds no candidates.
    const empty = sweepDrivingBoxes(rigId, boxes, from, to, []);
    const queryBudget = budget.queries ?? 16384,
      candidateBudget = budget.candidates ?? 512;
    ensure(
      Number.isInteger(queryBudget) &&
        queryBudget >= 0 &&
        queryBudget <= 16384 &&
        Number.isInteger(candidateBudget) &&
        candidateBudget >= 0 &&
        candidateBudget <= 512,
      "INVALID_INPUT",
      "Invalid remaining driving query budget",
    );
    const candidateLimit = Math.min(
      candidateBudget,
      Math.floor(queryBudget / (empty.segments * boxes.length * 2)),
    );
    let radius = 0,
      low = Infinity,
      high = -Infinity;
    for (const box of boxes) {
      radius = Math.max(
        radius,
        Math.hypot(
          Math.abs(box.center[0]) + box.halfExtents[0],
          Math.abs(box.center[2]) + box.halfExtents[2],
        ),
      );
      low = Math.min(low, from.y + box.center[1] - box.halfExtents[1]);
      high = Math.max(high, from.y + box.center[1] + box.halfExtents[1]);
    }
    // Include conservative yaw-envelope overshoot, not only the true geometry.
    const padding = Math.SQRT2 * 0.005 + 0.00001;
    const query: Bound = [
      Math.min(from.x, to.x) - radius - padding,
      low - padding,
      Math.min(from.z, to.z) - radius - padding,
      Math.max(from.x, to.x) + radius + padding,
      high + padding,
      Math.max(from.z, to.z) + radius + padding,
    ];
    const candidates: number[] = [];
    let visited = 0,
      exceeded = !empty.accepted;
    const visit = (branch: Branch) => {
      if (exceeded) return;
      if (++visited > 65536) {
        exceeded = true;
        return;
      }
      if (!overlaps(query, branch.bounds)) return;
      if (branch.left && branch.right) {
        visit(branch.left);
        visit(branch.right);
        return;
      }
      for (let i = branch.start; i < branch.end; i++) {
        const id = this.order[i];
        const source = this.sources[this.sourceIndex[id]];
        if (source.owner.kind === "rig" && source.owner.rigId === rigId)
          continue;
        const bounds = Array.from(
          this.bounds.subarray(id * 6, id * 6 + 6),
        ) as Bound;
        if (overlaps(query, bounds)) {
          if (candidates.length === candidateLimit) {
            exceeded = true;
            return;
          }
          candidates.push(id);
        }
      }
    };
    if (this.root) visit(this.root);
    const report = {
      units: "metres" as const,
      totalTriangles: this.totalTriangles,
      candidateTriangles: candidates.length,
      visitedBvhNodes: visited,
    };
    if (exceeded)
      return {
        ...empty,
        ...report,
        accepted: false,
        queries: 0,
        reason: "work-budget",
      };
    // Transient narrowphase query world, no authored/session world mutation.
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    try {
      const provenance = new Map<
        number,
        { sourceId: string; triangleIndex: number }
      >();
      const obstacles = candidates.map((id) => {
        const source = this.sources[this.sourceIndex[id]],
          triangle = this.triangleIndex[id];
        const vertices = new Float32Array(9);
        for (let corner = 0; corner < 3; corner++) {
          const index = source.indices[triangle * 3 + corner] * 3;
          vertices.set(source.vertices.subarray(index, index + 3), corner * 3);
        }
        const collider = world.createCollider(
          RAPIER.ColliderDesc.trimesh(vertices, new Uint32Array([0, 1, 2])),
        );
        provenance.set(collider.handle, {
          sourceId: source.sourceId,
          triangleIndex: triangle,
        });
        return { collider, owner: source.owner };
      });
      const result = sweepDrivingBoxes(rigId, boxes, from, to, obstacles);
      // Handles belong to the temporary world; expose stable source provenance.
      const { colliderHandle, ...sweep } = result;
      return {
        ...sweep,
        ...report,
        obstacle:
          colliderHandle === undefined
            ? undefined
            : provenance.get(colliderHandle),
      };
    } finally {
      world.free();
    }
  }
}

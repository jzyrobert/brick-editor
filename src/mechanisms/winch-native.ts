import RAPIER from "@dimforge/rapier3d-compat";
import { Group, Mesh, Quaternion, Vector3 } from "three";
import { LDrawLoader } from "three/examples/jsm/loaders/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/examples/jsm/materials/LDrawConditionalLineMaterial.js";
import { occurrences } from "../core/document";
import { add, inverse, mv, orthonormalized } from "../core/math";
import {
  ensure,
  type Occurrence,
  type Project,
  type Vec3,
} from "../core/types";
import { toPhysics, toPhysicsDirection } from "../play/physics-frame";
import type { PlayMemberLocalGeometry } from "../play/types";
import { AngularEquationSolver } from "./angular-equations";
import {
  bindRetainedWinchSources,
  retainedWinch,
  retainedWinchGeometrySources,
  type RetainedWinch,
} from "./retained-winch";
import { winchConvexRegions, winchKeyedBoreProfile } from "./winch-convex";

import { certifyWinchKeyedColumn } from "./winch-keyed-column";

type V = { x: number; y: number; z: number };
type Geometry = { points: Vec3[]; triangles: number[] };
type Region = {
  memberId: string;
  points: Vec3[];
  triangles?: number[];
  tooth: boolean;
  /** Only source shaft triangles inside the literal keyed negative column. */
  keyed: boolean;
  bearings: string[];
};
export type ReviewedRetainedWinchPacket = Readonly<{
  witness: RetainedWinch;
  carrier: readonly Region[];
  input: readonly Region[];
  output: readonly Region[];
  sourceTriangles: number;
  childCount: number;
  captureBinding: "source-constructor-only" | "matched-canonical";
  capPlaneRoundoffLdu: number;
  /** Rotational keying only: both actual shafts retain axial freedom. */
  shaftOwnership: "axially-free-keyed";
  inputStop: Readonly<{
    shaftId: string;
    supportId: string;
    lowerLdu: number;
    positiveHardStop: null;
    numericalUpperDomainMeters: 1_000_000;
  }>;
  keyColumnCertificates: Readonly<{
    input: ReturnType<typeof certifyWinchKeyedColumn>;
    output: ReturnType<typeof certifyWinchKeyedColumn>;
  }>;
}>;
type Packet = ReviewedRetainedWinchPacket;
const packets = new WeakSet<Packet>();
const regionPackets = new WeakMap<Region, Packet>();
const dot = (a: Vec3, b: Vec3) => a.reduce((s, n, i) => s + n * b[i], 0);
const sub = (a: Vec3, b: Vec3) => a.map((n, i) => n - b[i]) as Vec3;
const scale = (a: Vec3, s: number) => a.map((n) => n * s) as Vec3;
const norm = (a: Vec3) => Math.hypot(...a);
const vec = (v: V): Vec3 => [v.x, v.y, v.z];
const rotate = (q: RAPIER.Rotation, v: Vec3) =>
  new Vector3(...v).applyQuaternion(q).toArray() as Vec3;

/** Compile literal canonical closure bytes, once during preflight. No world or
 * native allocation precedes source verification. The loader applies authored
 * subpart transforms (including.707) exactly as in rendering. */
async function compile(
  ref: string,
  sources: Readonly<Record<string, string>>,
): Promise<Geometry> {
  const loader = new LDrawLoader().setConditionalLineMaterial(
    LDrawConditionalLineMaterial,
  );
  loader.setFileMap(
    Object.fromEntries(Object.keys(sources).map((r) => [r, r])),
  );
  (
    loader as unknown as {
      partsCache: { parseCache: { fetchData: (r: string) => Promise<string> } };
    }
  ).partsCache.parseCache.fetchData = async (r) => {
    const text = sources[r.toLowerCase().replaceAll("\\", "/")];
    ensure(text, "INVALID_INPUT", "Missing bound winch geometry: " + r);
    return text;
  };
  const source = `0 FILE __winch__.ldr\n0 !COLOUR WinchGrey CODE 71 VALUE #888888 EDGE #333333\n1 71 0 0 0 1 0 0 0 1 0 0 0 1 ${ref}\n`;
  const group = await new Promise<Group>((ok, fail) =>
    (
      loader.parse as unknown as (
        s: string,
        ok: (g: Group) => void,
        fail: (e: unknown) => void,
      ) => void
    )(source, ok, fail),
  );
  group.updateMatrixWorld(true);
  const points: Vec3[] = [],
    triangles: number[] = [];
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const p = object.geometry.getAttribute("position"),
      offset = points.length;
    for (let i = 0; i < p.count; i++)
      points.push(
        new Vector3()
          .fromBufferAttribute(p, i)
          .applyMatrix4(object.matrixWorld)
          .toArray() as Vec3,
      );
    const indices = object.geometry.index;
    for (let i = 0; i < (indices?.count ?? p.count); i++)
      triangles.push(offset + (indices ? indices.getX(i) : i));
  });
  ensure(
    points.length <= 16_384 && triangles.length / 3 <= 200_000,
    "RESOURCE_LIMIT",
    "Winch canonical geometry budget exceeded.",
  );
  group.traverse((object) => {
    if (object instanceof Mesh) object.geometry.dispose();
  });
  return { points, triangles };
}
/** Source shaft core and R8 head are distinct regions. Only the complete
 * finitely certified intrinsic negative-column core receives angular-key or
 * circular through-bearing labels. Every head triangle remains present. */
function shaftRegions(
  member: Occurrence,
  geometry: Geometry,
  seats: readonly { id: string; station: number; half: number }[],
): Region[] {
  const frame = orthonormalized(member.transform),
    world = geometry.points.map((p) => add(frame.position, mv(frame.basis, p))),
    groups = new Map<boolean, Region>();
  for (let i = 0; i < geometry.triangles.length; i += 3) {
    const triangle = geometry.triangles.slice(i, i + 3).map((j) => world[j]),
      keyed =
        member.node.ref !== "15462.dat" ||
        geometry.triangles
          .slice(i, i + 3)
          .every(
            (j) =>
              Math.hypot(geometry.points[j][1], geometry.points[j][2]) <= 6,
          ),
      region = groups.get(keyed) ?? {
        memberId: member.id,
        points: [],
        triangles: [],
        tooth: false,
        keyed,
        bearings: keyed ? seats.map((s) => s.id) : [],
      };
    const offset = region.points.length;
    region.points.push(...triangle);
    region.triangles!.push(offset, offset + 1, offset + 2);
    groups.set(keyed, region);
  }
  return [...groups.values()];
}

/** Prepare a real retained subsystem, not a universal part or whole-model
 * admission bypass. All carrier/shaft triangles are retained; moving tooth/hub
 * volumes use source-backed convex cells. Source/rest/inventory are read only. */
export async function prepareRetainedWinchNative(
  project: Project,
  wormId: string,
  actualSources: Readonly<Record<string, string>>,
  captured?: Readonly<Record<string, PlayMemberLocalGeometry>>,
): Promise<Packet> {
  // Bound the hardware query by the actual reviewed families, independently
  // of generated cable meshes or unrelated members in the original model.
  // This does not grant ownership to other occurrences or remove world solids.
  const families = new Set([
    "4716.dat",
    "10928.dat",
    "32449.dat",
    "87083.dat",
    "6536.dat",
    "15462.dat",
    "3737.dat",
  ]);
  const all = occurrences(project).filter((o) => families.has(o.node.ref)),
    worm = all.find((o) => o.id === wormId);
  ensure(worm, "INVALID_INPUT", "Missing actual winch occurrence.");
  const binding = await bindRetainedWinchSources(actualSources, project),
    witness = retainedWinch(worm, all, binding),
    sources = retainedWinchGeometrySources(binding);
  const selected = [
      ...witness.carrierMembers,
      ...witness.inputMembers,
      ...witness.outputMembers,
    ],
    members = new Map(
      all.filter((o) => selected.includes(o.id)).map((o) => [o.id, o]),
    );
  const canonical = new Map<string, Geometry>();
  for (const ref of new Set([...members.values()].map((o) => o.node.ref)))
    canonical.set(ref, await compile(ref, sources));
  if (captured)
    for (const member of members.values()) {
      const local = captured[member.id],
        expected = canonical.get(member.node.ref)!;
      ensure(
        local &&
          !local.unsupported &&
          local.namespace === member.namespace &&
          local.occurrenceId === member.id &&
          local.revision === project.revision &&
          JSON.stringify(local.frame) === JSON.stringify(member.transform),
        "INVALID_INPUT",
        "Actual canonical winch context does not match source.",
      );
      const expectedFloats = expected.points.flat();
      ensure(
        triangleSignature(expectedFloats, expected.triangles) ===
          triangleSignature(local.vertices, local.indices),
        "INVALID_INPUT",
        "Actual renderer canonical winch geometry differs from bound source constructor.",
      );
    }
  const carrier = witness.carrierMembers.map((id) => {
    const member = members.get(id)!,
      g = canonical.get(member.node.ref)!,
      frame = orthonormalized(member.transform);
    return {
      memberId: id,
      points: g.points.map((p) => add(frame.position, mv(frame.basis, p))),
      triangles: [...g.triangles],
      tooth: false,
      keyed: false,
      bearings: [],
    };
  });
  const moving = (
    ids: readonly string[],
    port: RetainedWinch["input"],
    input: boolean,
  ): Region[] =>
    ids.flatMap((id) => {
      const member = members.get(id)!,
        frame = orthonormalized(member.transform);
      if (member.node.ref === "4716.dat" || member.node.ref === "10928.dat")
        return winchConvexRegions(binding, member.node.ref).map((r) => ({
          memberId: id,
          points: r.points.map((p) => add(frame.position, mv(frame.basis, p))),
          tooth: r.contactClass === "tooth",
          keyed: false,
          bearings: [],
        }));
      const seats = input
        ? witness.captures[0].supportIds.map((id, i) => ({
            id,
            station: i === 0 ? -30 : 30,
            half: 10,
          }))
        : witness.carrierMembers
            .slice(0, 4)
            .map((id, i) => ({ id, station: [-25, -15, 15, 25][i], half: 5 }));
      return shaftRegions(member, canonical.get(member.node.ref)!, seats);
    });
  const input = moving(witness.inputMembers, witness.input, true),
    output = moving(witness.outputMembers, witness.output, false);
  const hole = winchKeyedBoreProfile(binding),
    keyColumnCertificate = (regions: readonly Region[], gearId: string) => {
      const frame = inverse(orthonormalized(members.get(gearId)!.transform)),
        triangles = regions
          .filter((r) => r.keyed)
          .flatMap((r) =>
            Array.from({ length: r.triangles!.length / 3 }, (_, i) =>
              [0, 1, 2].map((j) =>
                add(
                  frame.position,
                  mv(frame.basis, r.points[r.triangles![3 * i + j]]),
                ),
              ),
            ),
          );
      return certifyWinchKeyedColumn(triangles, hole);
    },
    keyColumnCertificates = Object.freeze({
      input: keyColumnCertificate(input, witness.input.occurrenceId),
      output: keyColumnCertificate(output, witness.output.occurrenceId),
    });
  let capPlaneRoundoffLdu = 0;
  for (let i = 0; i < witness.captures.length; i++) {
    const capture = witness.captures[i],
      port = i === 0 ? witness.input : witness.output;
    const worldPoints = (id: string) => {
      const member = members.get(id)!,
        frame = orthonormalized(member.transform);
      return canonical
        .get(member.node.ref)!
        .points.map((p) => add(frame.position, mv(frame.basis, p)));
    };
    for (const p of worldPoints(capture.memberId)) {
      const station = dot(sub(p, port.center), port.axis);
      capPlaneRoundoffLdu = Math.max(
        capPlaneRoundoffLdu,
        capture.spanLdu[0] - station,
        station - capture.spanLdu[1],
      );
    }
    for (let side = 0; side < 2; side++)
      for (const p of worldPoints(capture.supportIds[side])) {
        const station = dot(sub(p, port.center), port.axis);
        capPlaneRoundoffLdu = Math.max(
          capPlaneRoundoffLdu,
          side === 0
            ? station - capture.spanLdu[0]
            : capture.spanLdu[1] - station,
        );
      }
  }
  ensure(
    capPlaneRoundoffLdu <= 1e-9,
    "INVALID_INPUT",
    "Literal winch cap source halfspaces are not separated.",
  );
  const head = input.filter(
      (r) => r.memberId !== witness.input.occurrenceId && !r.keyed,
    ),
    headMin = Math.min(
      ...head.flatMap((r) =>
        r.points.map((p) =>
          dot(sub(p, witness.input.center), witness.input.axis),
        ),
      ),
    ),
    stopSupportId = witness.captures[0].supportIds[1],
    supportFrame = orthonormalized(members.get(stopSupportId)!.transform),
    lip = add(supportFrame.position, mv(supportFrame.basis, [0, 20, -8])),
    lowerLdu =
      dot(sub(lip, witness.input.center), witness.input.axis) - headMin;
  ensure(
    Number.isFinite(lowerLdu) && Math.abs(lowerLdu) <= 1e-6,
    "INVALID_INPUT",
    "The literal stop-axle head does not seat at the source carrier lip.",
  );
  const inputStop = Object.freeze({
    shaftId: witness.inputMembers[1],
    supportId: stopSupportId,
    lowerLdu,
    positiveHardStop: null,
    numericalUpperDomainMeters: 1_000_000 as const,
  });
  const packet = Object.freeze({
    witness,
    carrier,
    input,
    output,
    capPlaneRoundoffLdu,
    sourceTriangles: [...members.values()].reduce(
      (sum, o) => sum + canonical.get(o.node.ref)!.triangles.length / 3,
      0,
    ),
    childCount: carrier.length + input.length + output.length,
    captureBinding: captured ? "matched-canonical" : "source-constructor-only",
    shaftOwnership: "axially-free-keyed",
    keyColumnCertificates,
    inputStop,
  });
  ensure(
    packet.childCount <= 4096 &&
      [...carrier, ...input, ...output].reduce(
        (sum, r) => sum + (r.triangles?.length ?? 0) / 3,
        0,
      ) <= 200_000,
    "RESOURCE_LIMIT",
    "Winch native packet exceeds existing contact limits.",
  );
  for (const list of [packet.carrier, packet.input, packet.output]) {
    for (const r of list) {
      r.points.forEach(Object.freeze);
      Object.freeze(r.points);
      if (r.triangles) Object.freeze(r.triangles);
      Object.freeze(r.bearings);
      Object.freeze(r);
      regionPackets.set(r, packet);
    }
    Object.freeze(list);
  }
  packets.add(packet);
  return packet;
}

/** Bounded source-derived native prototype. Constructor creates actual retained
 * carrier/input/output bodies and revolute bindings, never poses an output.
 * External assembly ownership/production session entry remains the caller's
 * independent obligation. Manual torque is legal without a fabricated motor. */
export class RetainedWinchNative {
  readonly carrier: RAPIER.RigidBody;
  readonly input: RAPIER.RigidBody;
  readonly output: RAPIER.RigidBody;
  readonly inputShaft: RAPIER.RigidBody;
  readonly outputShaft: RAPIER.RigidBody;
  readonly solver: AngularEquationSolver;
  readonly hooks: RAPIER.PhysicsHooks;
  readonly metadata = new Map<number, Region>();
  private inputAxis: Vec3;
  private outputAxis: Vec3;
  private outputOffset: Vec3;
  private contactAligned = false;
  private bearingAligned = false;
  private keyAligned = new Map<string, boolean>();
  private headSeparated = false;
  private timestep = 0;
  constructor(
    readonly world: RAPIER.World,
    readonly packet: Packet,
    mobileCarrier = false,
  ) {
    ensure(
      packets.has(packet),
      "INVALID_INPUT",
      "Use a verified source winch packet.",
    );
    const w = packet.witness;
    this.inputAxis = vec(toPhysicsDirection(w.input.axis));
    this.outputAxis = vec(toPhysicsDirection(w.output.axis));
    this.outputOffset = vec(toPhysics(sub(w.output.center, w.input.center)));
    const body = (regions: readonly Region[], center: Vec3, fixed: boolean) => {
      const p = toPhysics(center),
        b = world.createRigidBody(
          (fixed
            ? RAPIER.RigidBodyDesc.fixed()
            : RAPIER.RigidBodyDesc.dynamic()
          )
            .setTranslation(p.x, p.y, p.z)
            .setCanSleep(false),
        );
      const points = regions.flatMap((r) => r.points),
        extent = [0, 1, 2].map(
          (i) =>
            (Math.max(...points.map((p) => p[i])) -
              Math.min(...points.map((p) => p[i]))) *
            0.02,
        );
      // Declared ideal mass0.05kg/member and bounding-box inertia, not a LEGO
      // density claim. Geometry is unchanged; each body has a finite native
      // inertia independently of open surface partitions.
      const mass = new Set(regions.map((r) => r.memberId)).size * 0.05;
      b.setAdditionalMassProperties(
        mass,
        { x: 0, y: 0, z: 0 },
        {
          x: (mass * (extent[1] ** 2 + extent[2] ** 2)) / 12,
          y: (mass * (extent[0] ** 2 + extent[2] ** 2)) / 12,
          z: (mass * (extent[0] ** 2 + extent[1] ** 2)) / 12,
        },
        { x: 0, y: 0, z: 0, w: 1 },
        true,
      );
      for (const r of regions) {
        const vertices = Float32Array.from(
          r.points.flatMap((point) => vec(toPhysics(sub(point, center)))),
        );
        const desc = r.triangles
          ? RAPIER.ColliderDesc.trimesh(vertices, new Uint32Array(r.triangles))
          : RAPIER.ColliderDesc.convexHull(vertices);
        ensure(desc, "INVALID_INPUT", "Actual winch native region refused.");
        const collider = world.createCollider(
          desc
            .setMass(0)
            .setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS),
          b,
        );
        this.metadata.set(collider.handle, r);
      }
      b.recomputeMassPropertiesFromColliders();
      return b;
    };
    this.carrier = body(packet.carrier, w.input.center, !mobileCarrier);
    const inputShaft = packet.input.filter(
        (r) => r.memberId !== w.input.occurrenceId,
      ),
      outputShaft = packet.output.filter(
        (r) => r.memberId !== w.output.occurrenceId,
      );
    this.input = body(
      packet.input.filter((r) => r.memberId === w.input.occurrenceId),
      w.input.center,
      false,
    );
    this.output = body(
      packet.output.filter((r) => r.memberId === w.output.occurrenceId),
      w.output.center,
      false,
    );
    this.inputShaft = body(inputShaft, w.input.center, false);
    this.outputShaft = body(outputShaft, w.output.center, false);
    // The literal cross-key carries angular motion, but neither a plain axle
    // nor one stop justifies a bilateral axial weld. A generic native joint
    // leaves axial translation and rotation free; the independent keyed
    // angular equations below couple rotation only. Source head contacts stay.
    for (const [shaft, center, axis] of [
      [this.inputShaft, w.input.center, w.input.axis],
      [this.outputShaft, w.output.center, w.output.axis],
    ] as const) {
      const joint = world.createImpulseJoint(
        RAPIER.JointData.generic(
          toPhysics(sub(center, w.input.center)),
          { x: 0, y: 0, z: 0 },
          toPhysicsDirection(axis),
          RAPIER.JointAxesMask.LinY |
            RAPIER.JointAxesMask.LinZ |
            RAPIER.JointAxesMask.AngY |
            RAPIER.JointAxesMask.AngZ,
        ),
        this.carrier,
        shaft,
        true,
      );
      joint.setContactsEnabled(true);
      if (shaft === this.inputShaft) {
        const stop = new RAPIER.PrismaticImpulseJoint(
          world.impulseJoints.raw,
          world.bodies,
          joint.handle,
        );
        // Only the lower bound is a literal source hard stop. The enormous
        // upper value is an explicit finite numerical domain, not a collar.
        stop.setLimits(
          packet.inputStop.lowerLdu * 0.02,
          packet.inputStop.numericalUpperDomainMeters,
        );
      }
    }
    world
      .createImpulseJoint(
        RAPIER.JointData.revolute(
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 },
          toPhysicsDirection(w.input.axis),
        ),
        this.carrier,
        this.input,
        true,
      )
      .setContactsEnabled(true);
    world
      .createImpulseJoint(
        RAPIER.JointData.revolute(
          toPhysics(sub(w.output.center, w.input.center)),
          { x: 0, y: 0, z: 0 },
          toPhysicsDirection(w.output.axis),
        ),
        this.carrier,
        this.output,
        true,
      )
      .setContactsEnabled(true);
    this.solver = new AngularEquationSolver(
      [
        {
          id: "input",
          body: this.inputShaft,
          carrier: this.carrier,
          axisLocal: this.inputAxis,
        },
        {
          id: "worm-body",
          body: this.input,
          carrier: this.carrier,
          axisLocal: this.inputAxis,
        },
        {
          id: "output-shaft",
          body: this.outputShaft,
          carrier: this.carrier,
          axisLocal: this.outputAxis,
        },
        {
          id: "output",
          body: this.output,
          carrier: this.carrier,
          axisLocal: this.outputAxis,
        },
      ],
      [
        {
          id: "worm",
          terms: [
            { portId: "worm-body", coefficient: -w.ratio },
            { portId: "output", coefficient: 1 },
          ],
          maxTorqueNm: 10,
        },
        {
          id: "input-key",
          terms: [
            { portId: "input", coefficient: 1 },
            { portId: "worm-body", coefficient: -1 },
          ],
          maxTorqueNm: 10,
        },
        {
          id: "output-key",
          terms: [
            { portId: "output", coefficient: 1 },
            { portId: "output-shaft", coefficient: -1 },
          ],
          maxTorqueNm: 10,
        },
      ],
    );
    this.hooks = {
      filterIntersectionPair: () => true,
      filterContactPair: (a, b) =>
        this.idealPair(a, b) ? null : RAPIER.SolverFlags.COMPUTE_IMPULSE,
    };
  }
  /** Full current native pivot/axis envelope. Misalignment restores every
   * source contact; this is not a disabled pair attached to arbitrary bodies. */
  aligned(dt = 0) {
    if (dt !== 0 && !this.aligned()) return false;
    const pose = (body: RAPIER.RigidBody) => {
      const q = new Quaternion().copy(body.rotation());
      if (dt) {
        const omega = vec(body.angvel()),
          speed = norm(omega);
        if (speed)
          q.premultiply(
            new Quaternion().setFromAxisAngle(
              new Vector3(...scale(omega, 1 / speed)),
              speed * dt,
            ),
          ).normalize();
      }
      return {
        position: add(vec(body.translation()), scale(vec(body.linvel()), dt)),
        rotation: q,
      };
    };
    const carrier = this.carrier,
      carrierPose = pose(carrier),
      q = carrierPose.rotation,
      origin = carrierPose.position;
    for (const [body, axis, offset] of [
      [this.input, this.inputAxis, [0, 0, 0] as Vec3],
      [this.output, this.outputAxis, this.outputOffset],
    ] as const) {
      if (
        norm(sub(pose(body).position, add(origin, rotate(q, offset)))) >
          0.05 * 0.02 ||
        norm(sub(rotate(pose(body).rotation, axis), rotate(q, axis))) > 0.002
      )
        return false;
    }
    return true;
  }
  private idealPair(a: number, b: number) {
    const x = this.metadata.get(a),
      y = this.metadata.get(b);
    if (!x || !y || !this.contactAligned) return false;
    const kind = retainedWinchContactKind(this.packet, x, y);
    if (kind === "stop") return this.bearingAligned;
    if (kind === "separated") return this.headSeparated;
    if (kind === "key") {
      const shaft = x.keyed ? x : y;
      return this.keyAligned.get(shaft.memberId) === true;
    }
    return kind !== undefined && (kind !== "bearing" || this.bearingAligned);
  }

  applyManualTorque(torqueNm: number, dt: number) {
    ensure(
      Number.isFinite(torqueNm) &&
        Math.abs(torqueNm) <= 1 &&
        Number.isFinite(dt) &&
        dt > 0 &&
        dt <= 0.1,
      "INVALID_INPUT",
      "Bounded manual winch torque required.",
    );
    const axis = rotate(this.carrier.rotation(), this.inputAxis),
      impulse = scale(axis, torqueNm * dt);
    this.inputShaft.applyTorqueImpulse(
      { x: impulse[0], y: impulse[1], z: impulse[2] },
      true,
    );
    this.carrier.applyTorqueImpulse(
      { x: -impulse[0], y: -impulse[1], z: -impulse[2] },
      true,
    );
  }
  beginStep(dt: number) {
    this.timestep = dt;
    this.prepareContacts();
    this.solver.setEnabled(
      "input-key",
      this.keyAligned.get(this.packet.witness.inputMembers[1]) === true,
    );
    this.solver.setEnabled(
      "output-key",
      this.keyAligned.get(
        this.packet.witness.outputMembers.find(
          (id) => id !== this.packet.witness.output.occurrenceId,
        )!,
      ) === true,
    );
    this.solver.beginStep(dt);
    this.prepareContacts();
  }
  solvePass() {
    this.solver.solvePass();
    this.prepareContacts();
  }
  /** Native bodies must never be queried inside a Rapier hook: the body set
   * is mutably borrowed duringWorld.step. Cache the actual current frame here,
   * outside the callback, after controls/constraint impulses. */
  prepareContacts() {
    this.contactAligned = this.aligned(this.timestep);
    const q = this.carrier.rotation(),
      origin = vec(this.carrier.translation());
    // Original clipped bearing fragments must not receive a rest-only label
    // after an axially free shaft leaves its source window. This narrow gate
    // does not inhibit axial motion; it restores ordinary native contacts.
    let roundAligned = true;
    for (const [
      shaft,
      part,
      axis,
      offset,
      bodyLo,
      bodyHi,
      keyLo,
      keyHi,
      id,
    ] of [
      [
        this.inputShaft,
        this.input,
        this.inputAxis,
        [0, 0, 0] as Vec3,
        -57.5,
        38,
        -20,
        20,
        this.packet.witness.inputMembers[1],
      ],
      [
        this.outputShaft,
        this.output,
        this.outputAxis,
        this.outputOffset,
        -27.5,
        167.5,
        -10,
        10,
        this.packet.witness.outputMembers.find(
          (id) => id !== this.packet.witness.output.occurrenceId,
        )!,
      ],
    ] as const) {
      const expected = add(origin, rotate(q, offset)),
        delta = sub(vec(shaft.translation()), expected),
        direction = rotate(q, axis),
        next = add(
          delta,
          scale(
            sub(vec(shaft.linvel()), vec(this.carrier.linvel())),
            this.timestep,
          ),
        ),
        transverse = (v: Vec3) =>
          norm(sub(v, scale(direction, dot(v, direction)))),
        axial = [dot(delta, direction) / 0.02, dot(next, direction) / 0.02],
        phase = new Quaternion()
          .copy(part.rotation())
          .invert()
          .multiply(new Quaternion().copy(shaft.rotation())),
        phaseAngle =
          2 *
          Math.atan2(Math.hypot(phase.x, phase.y, phase.z), Math.abs(phase.w));
      const radial =
        Math.max(transverse(delta), transverse(next)) <= 0.05 * 0.02 &&
        norm(sub(rotate(shaft.rotation(), axis), direction)) <= 0.002;
      roundAligned &&= radial;
      if (shaft === this.inputShaft)
        this.headSeparated =
          radial &&
          axial.every(
            (s) => s + 38 - 20 > 0.05 + (8 + 12.7) * 0.002 + 0.00035 + 0.00001,
          );
      this.keyAligned.set(
        id,
        radial &&
          phaseAngle <= 0.002 &&
          axial.every(
            (s) => Math.min(bodyHi + s, keyHi) > Math.max(bodyLo + s, keyLo),
          ),
      );
    }
    this.bearingAligned = roundAligned;
  }
}

/** Source classification only. Caller must independently enforce current/next
 * native pose alignment and exact source/body ownership; this does not disable
 * a native pair by itself or admit arbitrary public mechanism joints. */
export function retainedWinchContactKind(
  packet: ReviewedRetainedWinchPacket,
  x: Region,
  y: Region,
): "tooth" | "bearing" | "cap" | "key" | "separated" | "stop" | undefined {
  ensure(
    packets.has(packet),
    "INVALID_INPUT",
    "Use a sealed source winch packet.",
  );
  if (regionPackets.get(x) !== packet || regionPackets.get(y) !== packet)
    return undefined;
  const w = packet.witness;
  const shaft = x.keyed ? x : y.keyed ? y : undefined,
    other = shaft === x ? y : x;
  if (
    shaft &&
    ((shaft.memberId ===
      w.inputMembers.find((id) => id !== w.input.occurrenceId) &&
      other.memberId === w.input.occurrenceId) ||
      (shaft.memberId ===
        w.outputMembers.find((id) => id !== w.output.occurrenceId) &&
        other.memberId === w.output.occurrenceId))
  )
    return "key";
  if (
    (x.memberId === w.inputMembers.find((id) => id !== w.input.occurrenceId) &&
      !x.keyed &&
      y.memberId === w.captures[0].supportIds[1]) ||
    (y.memberId === w.inputMembers.find((id) => id !== w.input.occurrenceId) &&
      !y.keyed &&
      x.memberId === w.captures[0].supportIds[1])
  )
    return "stop";
  if (
    (x.memberId === w.inputMembers.find((id) => id !== w.input.occurrenceId) &&
      !x.keyed &&
      y.memberId === w.input.occurrenceId) ||
    (y.memberId === w.inputMembers.find((id) => id !== w.input.occurrenceId) &&
      !y.keyed &&
      x.memberId === w.input.occurrenceId)
  )
    return "separated";
  if (
    x.tooth &&
    y.tooth &&
    [x.memberId, y.memberId].includes(w.input.occurrenceId) &&
    [x.memberId, y.memberId].includes(w.output.occurrenceId)
  )
    return "tooth";
  if (x.bearings.includes(y.memberId) || y.bearings.includes(x.memberId))
    return "bearing";
  if (
    w.captures.some(
      (c) =>
        (x.memberId === c.memberId && c.supportIds.includes(y.memberId)) ||
        (y.memberId === c.memberId && c.supportIds.includes(x.memberId)),
    )
  )
    return "cap";
  return undefined;
}
export const isPreparedRetainedWinchPacket = (
  packet: ReviewedRetainedWinchPacket,
) => packets.has(packet);
/** Canonical oriented face multiset at the eventual F32 native boundary.
 * Vertex/index order and draw-material grouping do not alter this binding;
 * winding, duplicates, source coordinates or any triangle changes do. */
function triangleSignature(
  vertices: ArrayLike<number>,
  indices: ArrayLike<number>,
) {
  const points = Array.from({ length: vertices.length / 3 }, (_, i) =>
    [0, 1, 2].map((j) => Math.fround(vertices[3 * i + j])).join(","),
  );
  const faces: string[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const p = [
      points[indices[i]],
      points[indices[i + 1]],
      points[indices[i + 2]],
    ];
    faces.push(
      [
        p.join(";"),
        [p[1], p[2], p[0]].join(";"),
        [p[2], p[0], p[1]].join(";"),
      ].sort()[0],
    );
  }
  return faces.sort().join("\n");
}

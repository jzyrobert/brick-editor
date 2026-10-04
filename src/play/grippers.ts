import RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "three";
import { ensure, type Transform } from "../core/types";
import { mv } from "../core/math";
import type { GripperSpec } from "../mechanisms/types";
import { fromPhysics, METRES_PER_LDU, toPhysics } from "./physics-frame";
import type {
  PlayGrabRequest,
  PlayGripRequest,
  PlayGripTarget,
  PlayGripperReport,
} from "./types";

export const GRIP_LIMITS = Object.freeze({
  attachments: 16,
  groups: 64,
  colliderPairs: 4096,
  penetrationLdu: 0.5,
});
export type NativeGripGroup = {
  groupId: string;
  body: RAPIER.RigidBody;
  /** Native bodies start with identity rotation, with this basis baked into shapes. */
  rest: Transform;
  /** Explicitly unanchored, with no authored joint, force link or vehicle role. */
  loose: boolean;
};
export type NativeGripRig = {
  rigId: string;
  definitions: readonly GripperSpec[];
  groups: readonly NativeGripGroup[];
};
const key = ({ rigId, groupId }: PlayGripTarget) =>
  JSON.stringify([rigId, groupId]);
const gripKey = ({ rigId, gripperId }: PlayGripRequest) =>
  JSON.stringify([rigId, gripperId]);
const vector = (p: { x: number; y: number; z: number }) =>
  new Vector3(p.x, p.y, p.z);
const quaternion = (q: { x: number; y: number; z: number; w: number }) =>
  new Quaternion(q.x, q.y, q.z, q.w);

/** One bounded owner of reversible native attachments. No pose/velocity assignment,
 * group merging, contact exemption, authored constraint removal or source writes. */
export class NativeGrippers {
  private groups = new Map<string, NativeGripGroup & PlayGripTarget>();
  private definitions = new Map<
    string,
    {
      spec: GripperSpec;
      holder: NativeGripGroup & PlayGripTarget;
      request: PlayGripRequest;
    }
  >();
  private held = new Map<
    string,
    {
      joint: RAPIER.ImpulseJoint;
      target: NativeGripGroup & PlayGripTarget;
      previousIterations: number;
    }
  >();
  private owners = new Set<string>();
  private holders = new Set<number>();
  private cache = new Map<string, Record<string, PlayGripperReport>>();
  private disposed = false;
  constructor(
    private world: RAPIER.World,
    sources: readonly NativeGripRig[],
  ) {
    for (const source of sources)
      for (const group of source.groups)
        this.groups.set(key({ rigId: source.rigId, groupId: group.groupId }), {
          ...group,
          rigId: source.rigId,
        });
    ensure(
      this.groups.size <= GRIP_LIMITS.groups,
      "LIMIT_EXCEEDED",
      "Grippers share the Dynamic Play limit of sixty-four native groups",
    );
    for (const source of sources)
      for (const spec of source.definitions) {
        const request = { rigId: source.rigId, gripperId: spec.id },
          holder = this.groups.get(
            key({ rigId: source.rigId, groupId: spec.groupId }),
          );
        ensure(
          holder,
          "INVALID_INPUT",
          "Gripper requires an active native body",
        );
        this.holders.add(holder.body.handle);
        this.definitions.set(gripKey(request), {
          spec: structuredClone(spec),
          holder,
          request,
        });
      }
  }
  invalidate() {
    this.cache.clear();
  }
  private alive() {
    ensure(!this.disposed, "INVALID_INPUT", "Gripper session has ended");
  }
  private anchor(def: { spec: GripperSpec; holder: NativeGripGroup }) {
    const local = vector(toPhysics(mv(def.holder.rest.basis, def.spec.anchor)));
    return local
      .applyQuaternion(quaternion(def.holder.body.rotation()))
      .add(vector(def.holder.body.translation()));
  }
  private eligible(
    def: { spec: GripperSpec; holder: NativeGripGroup & PlayGripTarget },
    target: NativeGripGroup & PlayGripTarget,
  ) {
    if (
      target.body.handle === def.holder.body.handle ||
      !target.loose ||
      !target.body.isDynamic() ||
      this.owners.has(key(target)) ||
      this.holders.has(target.body.handle)
    )
      return false;
    const mass = target.body.mass();
    return (
      mass > 0 &&
      mass <= def.spec.maxPayloadMassKg &&
      target.body.numColliders() * def.holder.body.numColliders() <=
        GRIP_LIMITS.colliderPairs &&
      this.anchor(def).distanceTo(vector(target.body.translation())) <=
        def.spec.captureRadiusLdu * METRES_PER_LDU + 1e-8
    );
  }
  report(rigId: string) {
    this.alive();
    if (this.cache.has(rigId)) return structuredClone(this.cache.get(rigId)!);
    const report: Record<string, PlayGripperReport> = {};
    for (const [id, def] of this.definitions)
      if (def.request.rigId === rigId) {
        const anchor = this.anchor(def),
          held = this.held.get(id);
        const candidates =
          held || this.held.size >= GRIP_LIMITS.attachments
            ? []
            : [...this.groups.values()]
                .filter((g) => this.eligible(def, g))
                .map((g) => ({
                  rigId: g.rigId,
                  groupId: g.groupId,
                  massKg: g.body.mass(),
                  distanceLdu:
                    anchor.distanceTo(vector(g.body.translation())) /
                    METRES_PER_LDU,
                }))
                .sort(
                  (a, b) =>
                    a.distanceLdu - b.distanceLdu ||
                    key(a).localeCompare(key(b)),
                );
        report[def.spec.id] = {
          groupId: def.spec.groupId,
          anchorWorldLdu: fromPhysics(anchor),
          state: held ? "holding" : candidates.length ? "ready" : "empty",
          candidates,
          ...(held
            ? {
                held: {
                  rigId: held.target.rigId,
                  groupId: held.target.groupId,
                  massKg: held.target.body.mass(),
                },
              }
            : {}),
        };
      }
    this.cache.set(rigId, report);
    return structuredClone(report);
  }
  grab(request: PlayGrabRequest) {
    this.alive();
    const id = gripKey(request),
      def = this.definitions.get(id),
      target = this.groups.get(key(request.target));
    ensure(def, "INVALID_INPUT", "Unknown active Dynamic gripper");
    ensure(!this.held.has(id), "INVALID_INPUT", "Release the held part first");
    ensure(
      this.held.size < GRIP_LIMITS.attachments,
      "LIMIT_EXCEEDED",
      "Play supports at most sixteen held parts",
    );
    ensure(
      target && this.eligible(def, target),
      "INVALID_INPUT",
      "Choose a nearby loose Dynamic group within this gripper's payload limit",
    );
    // Refuse an already deeply interpenetrating grasp. The finite pair budget is
    // checked before queries; grabbing never hides this overlap from the solver.
    for (let a = 0; a < def.holder.body.numColliders(); a++)
      for (let b = 0; b < target.body.numColliders(); b++) {
        const contact = def.holder.body
          .collider(a)
          .contactCollider(target.body.collider(b), 0);
        ensure(
          !contact ||
            contact.distance >= -GRIP_LIMITS.penetrationLdu * METRES_PER_LDU,
          "INVALID_INPUT",
          "Move the gripper clear of the part before grabbing",
        );
      }
    const holder = def.holder.body,
      payload = target.body,
      anchor = this.anchor(def),
      qa = quaternion(holder.rotation()),
      qb = quaternion(payload.rotation());
    const anchorA = anchor
        .clone()
        .sub(vector(holder.translation()))
        .applyQuaternion(qa.clone().invert()),
      anchorB = anchor
        .clone()
        .sub(vector(payload.translation()))
        .applyQuaternion(qb.clone().invert());
    // Both joint frames represent the holder's current orientation. The payload
    // retains its actual relative orientation instead of snapping to the holder.
    const frameB = qb.clone().invert().multiply(qa),
      data = RAPIER.JointData.fixed(
        anchorA,
        { x: 0, y: 0, z: 0, w: 1 },
        anchorB,
        frameB,
      );
    const joint = this.world.createImpulseJoint(data, holder, payload, true);
    const previousIterations = payload.additionalSolverIterations();
    try {
      joint.setContactsEnabled(true);
      payload.setAdditionalSolverIterations(Math.max(previousIterations, 8));
    } catch (error) {
      this.world.removeImpulseJoint(joint, true);
      throw error;
    }
    this.held.set(id, { joint, target, previousIterations });
    this.owners.add(key(target));
    this.invalidate();
  }
  release(request: PlayGripRequest) {
    this.alive();
    const id = gripKey(request);
    ensure(
      this.definitions.has(id),
      "INVALID_INPUT",
      "Unknown active Dynamic gripper",
    );
    const held = this.held.get(id);
    ensure(held, "INVALID_INPUT", "This gripper is not holding a part");
    this.world.removeImpulseJoint(held.joint, true);
    held.target.body.setAdditionalSolverIterations(held.previousIterations);
    this.held.delete(id);
    this.owners.delete(key(held.target));
    this.invalidate();
  }
  dispose() {
    if (this.disposed) return;
    for (const id of [...this.held.keys()])
      this.release(this.definitions.get(id)!.request);
    this.cache.clear();
    this.definitions.clear();
    this.groups.clear();
    this.holders.clear();
    this.disposed = true;
  }
}

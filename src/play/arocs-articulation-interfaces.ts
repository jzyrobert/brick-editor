import manifest from "./arocs-articulation-sources.json";
import {
  verifyReviewedSourceClosures,
  type ReviewedSourceOptions,
} from "../mechanisms/reviewed-source-closure";
import {
  add,
  inverse,
  mv,
  nearlyPhysical,
  orthonormalized,
} from "../core/math";
import {
  ensure,
  type Occurrence,
  type Transform,
  type Vec3,
} from "../core/types";
import type { SourceAssemblyEdge } from "./source-assembly";
import type { JointSpec, RigidGroup } from "../mechanisms/types";

export type ArocsArticulationRef = keyof typeof manifest;
export type ArocsArticulationBinding = Readonly<{
  refs: readonly ArocsArticulationRef[];
}>;
const bindings = new WeakMap<ArocsArticulationBinding, ReadonlySet<string>>();
const tokens = new WeakSet<ArocsArticulationInterface>();
const fitTokens = new WeakSet<ArocsBallFit>();
const fitOwners = new WeakMap<
  ArocsBallFit,
  { ball: ArocsArticulationInterface; socket: ArocsArticulationInterface }
>();
export async function bindArocsArticulationSources(
  sources: Readonly<Record<string, string>>,
  refs: readonly ArocsArticulationRef[],
  options: ReviewedSourceOptions = {},
): Promise<ArocsArticulationBinding> {
  const bound = await verifyReviewedSourceClosures(
    sources,
    manifest,
    refs,
    options,
  );
  const token = Object.freeze({
    refs: Object.freeze([...bound]) as readonly ArocsArticulationRef[],
  });
  bindings.set(token, new Set(bound));
  return token;
}
export type ArocsBallFeature = {
  id: string;
  localCenter: Vec3;
  sourceCenter: Vec3;
  rigidCenter: Vec3;
  /** The actual sphere and socket both have an 8 LDU nominal radius. */
  radiusLdu: 8;
  role: "ball" | "socket";
};
export type ArocsArticulationInterface = {
  occurrenceId: string;
  ref: ArocsArticulationRef;
  restFrame: Transform;
  features: readonly ArocsBallFeature[];
};
/** Physical connection candidates only. Socket tabs require elastic insertion;
 * these profiles neither supply spring constants nor authorize collision exemptions. */
export function arocsArticulationInterface(
  o: Occurrence,
  binding: ArocsArticulationBinding,
): ArocsArticulationInterface | undefined {
  if (
    o.node.kind !== "part" ||
    o.namespace !== "official" ||
    !bindings.get(binding)?.has(o.node.ref) ||
    !nearlyPhysical(o.transform) ||
    !o.transform.position.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e7)
  )
    return;
  const ref = o.node.ref as ArocsArticulationRef,
    rigid = orthonormalized(o.transform);
  const centers: Vec3[] =
    ref === "6628.dat"
      ? [[-10, 0, 0]]
      : ref === "2736.dat"
        ? [[-12, 0, 0]]
        : ref === "15459.dat"
          ? [[0, 0, -80]]
          : ref === "32005.dat"
            ? [
                [0, 0, 0],
                [0, 0, 100],
              ]
            : [
                [0, 0, 0],
                [0, 0, 160],
              ];
  const result: ArocsArticulationInterface = {
    occurrenceId: o.id,
    ref,
    restFrame: {
      position: [...o.transform.position],
      basis: [...o.transform.basis],
    },
    features: centers.map((localCenter, i) => ({
      id: `${ref}:${i}`,
      localCenter,
      sourceCenter: add(
        o.transform.position,
        mv(o.transform.basis, localCenter),
      ),
      rigidCenter: add(rigid.position, mv(rigid.basis, localCenter)),
      radiusLdu: 8,
      role: ref === "6628.dat" || ref === "2736.dat" ? "ball" : "socket",
    })),
  };
  for (const f of result.features) {
    Object.freeze(f.localCenter);
    Object.freeze(f.sourceCenter);
    Object.freeze(f.rigidCenter);
    Object.freeze(f);
  }
  Object.freeze(result.features);
  Object.freeze(result.restFrame.position);
  Object.freeze(result.restFrame.basis);
  Object.freeze(result.restFrame);
  Object.freeze(result);
  tokens.add(result);
  return result;
}
export const AROCS_ARTICULATION_LIMITS = Object.freeze({
  parts: 256,
  checks: 100000,
});
export type ArocsBallFit = {
  ball: { occurrenceId: string; feature: ArocsBallFeature };
  socket: { occurrenceId: string; feature: ArocsBallFeature };
  sourceGapLdu: number;
  rigidGapLdu: number;
  /** Diagnostic only: applying this would change the assembled pose. */
  idealSocketTranslation: Vec3;
  freedom: "spherical";
  rest: "coincident" | "requires-assembly-alignment";
};
/** No proximity weld: only coincident endpoints generate attachment witnesses.
 * The 3 LDU search is a report of unresolved source assembly fits, not admission. */
export function arocsBallFits(
  parts: readonly ArocsArticulationInterface[],
  limits: { parts?: number; checks?: number } = {},
) {
  const cap = {
    parts: limits.parts ?? AROCS_ARTICULATION_LIMITS.parts,
    checks: limits.checks ?? AROCS_ARTICULATION_LIMITS.checks,
  };
  ensure(
    Number.isInteger(cap.parts) &&
      cap.parts >= 0 &&
      cap.parts <= AROCS_ARTICULATION_LIMITS.parts &&
      Number.isInteger(cap.checks) &&
      cap.checks >= 0 &&
      cap.checks <= AROCS_ARTICULATION_LIMITS.checks,
    "INVALID_INPUT",
    "Arocs articulation limits cannot raise source review caps",
  );
  ensure(
    parts.length <= cap.parts,
    "LIMIT_EXCEEDED",
    "Too many parts for Arocs articulation review",
  );
  ensure(
    parts.every((p) => tokens.has(p)) &&
      new Set(parts.map((p) => p.occurrenceId)).size === parts.length,
    "INVALID_INPUT",
    "Arocs articulation needs actual distinct source interface tokens",
  );
  const balls = parts.flatMap((p) =>
    p.features
      .filter((f) => f.role === "ball")
      .map((feature) => ({ occurrenceId: p.occurrenceId, feature })),
  );
  const fits: ArocsBallFit[] = [],
    unresolved: Array<{
      occurrenceId: string;
      featureId: string;
      reason: string;
    }> = [],
    attachments: SourceAssemblyEdge[] = [];
  let work = 0;
  const distance = (a: Vec3, b: Vec3) =>
    Math.hypot(...a.map((n, k) => n - b[k]));
  for (const p of parts)
    for (const socket of p.features.filter((f) => f.role === "socket")) {
      const candidates = balls.filter((b) => {
        ensure(
          ++work <= cap.checks,
          "LIMIT_EXCEEDED",
          "Arocs articulation connection budget exceeded",
        );
        return distance(b.feature.sourceCenter, socket.sourceCenter) <= 3;
      });
      if (candidates.length !== 1) {
        unresolved.push({
          occurrenceId: p.occurrenceId,
          featureId: socket.id,
          reason: candidates.length ? "ambiguous-ball" : "no-source-ball",
        });
        continue;
      }
      const ball = candidates[0],
        sourceGapLdu = distance(ball.feature.sourceCenter, socket.sourceCenter),
        rigidGapLdu = distance(ball.feature.rigidCenter, socket.rigidCenter);
      const rest =
        sourceGapLdu <= 1e-7 && rigidGapLdu <= 1e-7
          ? "coincident"
          : "requires-assembly-alignment";
      const fit: ArocsBallFit = {
        ball,
        socket: { occurrenceId: p.occurrenceId, feature: socket },
        sourceGapLdu,
        rigidGapLdu,
        idealSocketTranslation: ball.feature.rigidCenter.map(
          (n, k) => n - socket.rigidCenter[k],
        ) as Vec3,
        freedom: "spherical",
        rest,
      };
      Object.freeze(fit.idealSocketTranslation);
      Object.freeze(fit.ball);
      Object.freeze(fit.socket);
      Object.freeze(fit);
      fitTokens.add(fit);
      fitOwners.set(fit, {
        ball: parts.find((p) => p.occurrenceId === ball.occurrenceId)!,
        socket: p,
      });
      fits.push(fit);
      if (rest === "coincident")
        attachments.push({
          a: ball.occurrenceId,
          b: p.occurrenceId,
          kind: "articulated",
          pivot: [...ball.feature.rigidCenter],
          evidence: {
            profile: "arocs-source-ball-socket",
            featureA: ball.feature.id,
            featureB: socket.id,
          },
        });
    }
  return { fits, attachments, unresolved, work };
}

/** A real coincident source connection can be realized as a translationally
 * constrained ball joint. Mismatched source fits need an explicit reviewed
 * rest-closure operation before this constructor can accept them. Neither
 * motor power, angular stops nor mating/contact allowances are inferred. */
export function arocsBallJoint(
  fit: ArocsBallFit,
  ballBody: RigidGroup,
  socketBody: RigidGroup,
  id: string,
): JointSpec {
  ensure(
    fitTokens.has(fit) && fit.rest === "coincident",
    "INVALID_INPUT",
    "Arocs ball joint needs a verified coincident source fit; review assembly alignment first",
  );
  const owners = fitOwners.get(fit)!;
  const matches = (body: RigidGroup, part: ArocsArticulationInterface) => {
    const rest = body.restTransforms[part.occurrenceId];
    return (
      rest &&
      rest.position.every((n, k) => n === part.restFrame.position[k]) &&
      rest.basis.every((n, k) => n === part.restFrame.basis[k])
    );
  };
  ensure(
    matches(ballBody, owners.ball) && matches(socketBody, owners.socket),
    "INVALID_INPUT",
    "Arocs ball joint must preserve its bound source rest frames",
  );
  ensure(
    ballBody.id !== socketBody.id &&
      ballBody.occurrenceIds.includes(fit.ball.occurrenceId) &&
      socketBody.occurrenceIds.includes(fit.socket.occurrenceId) &&
      nearlyPhysical(ballBody.frame) &&
      nearlyPhysical(socketBody.frame),
    "INVALID_INPUT",
    "Arocs ball joint bodies must own the actual source endpoints",
  );
  const local = (body: RigidGroup, point: Vec3): Vec3 => {
    const frame = inverse(orthonormalized(body.frame));
    return add(frame.position, mv(frame.basis, point));
  };
  return {
    id,
    kind: "spherical",
    bodyA: ballBody.id,
    bodyB: socketBody.id,
    anchorA: local(ballBody, fit.ball.feature.rigidCenter),
    anchorB: local(socketBody, fit.socket.feature.rigidCenter),
  };
}

/** Finite source associations for articulated instruction drafts, never fit proof. */
import { libraryLock } from "../catalog/catalog";
import { fullLibraryLock } from "../catalog/full-library";
import { canonical } from "../ldraw/path";
import {
  add,
  compose,
  identity,
  mv,
  orthonormalized,
  physical,
} from "../core/math";
import type {
  Basis,
  CameraSpec,
  Occurrence,
  Project,
  Transform,
  Vec3,
} from "../core/types";

export const ARTICULATED_DISPLAY_TOLERANCE = 0.005;
export const ARTICULATED_DISPLAY_TOLERANCE_MAX = 0.02;
export const ARTICULATED_SOURCE_SHA256: Record<string, string> = {
  "1-16ndis.dat":
    "80fe13f5d5458143a68a5fa9e4cf4eba0d22b3df7cf3c255630276d1687c53a5",
  "1-16tang.dat":
    "3bf6430f99195afabdaaab755a660c0978080851fd6f514f50ef0e578e6f82e2",
  "1-4chrd.dat":
    "ccba3a97b5cc358754e476b78b4ce61cce5f404cd15e37471b73df3e81784aec",
  "1-4cyli.dat":
    "5a7168952a5a3570327873b9a5802fa7b3be40967ab78c03b6a2bfd4419a1f10",
  "1-4cylo.dat":
    "792a01362608c3f385dd7f01a1bd7d19cf9ed8a40f793266345cc86d1d98f3af",
  "1-4edge.dat":
    "9ce2de7e67bbac575d52cfdc771b9d00856efc9b88002d97db8e665e50f4d467",
  "1-4ndis.dat":
    "ff6685838636e7ab6152356d8f09e4f00a38af0d878b0881423f5c45fb868f0c",
  "2-4chrd.dat":
    "3b0dfcf2cb881fae0acfe1e53b703104768878636477e540d0c893fc3fd87f8f",
  "2-4cyli.dat":
    "d486780f0f84893899d9eadcd13150f13a42e15e77a3cda38cdf24ded98862c6",
  "2-4cylo.dat":
    "4fa9f597d775c7f15e3fc66f60e20d914134d13004b485488b7dbff684776232",
  "2-4edge.dat":
    "665400f76566b161c28303cdadce40d17d979a8ff9a8a133675af2d17fbe6763",
  "2-4ring2.dat":
    "dc1748fff34bb0cae3ba1d480921c2f73de4ea1d0532799356b2014a28c8f393",
  "3-16chrd.dat":
    "2bb493e8b5b56a5d63bfa7356a0ed5d6403a68e5e9a983e13a57541783ad19c1",
  "3-16cyli.dat":
    "f50d12a37a22ae4a5f37a017b8e39d1e729577b0a4aa376ca685b210806b49c8",
  "3-16cylo.dat":
    "a5c8370842299035a9cc14308301614c6fb169fb873a7950c888928cd8d9181c",
  "3-16edge.dat":
    "c08dd83bb7fe90b61f7cd0b10ebef0d9a9ba33b497676dedd2e2e968cb8248f9",
  "3-16ndis.dat":
    "abb7da370e72fe9e75faf5d10c637b476202dbd8ced9cb5b0f96433e1f72f529",
  "3-16ring2.dat":
    "39481beacecc688590dff4d877e177657d133fbaee449ad60f346c18ccce3d3d",
  "4-4cyli.dat":
    "4a742c2765b6ebf98245baaf8a160a4ff587fc93d36c8ee2b9074712a2f968c4",
  "4-4cylo.dat":
    "d6ca97ee2e75918b3309a5c88aafcd2455b3a316f7cef8963517c19f1d86b38f",
  "4-4disc.dat":
    "a00b5547776f61a7389d303616987c76b3c4de86ad8ec32f22857e1bd5e5e40f",
  "4-4edge.dat":
    "54a52196e421fd1717d291ff52ea57553b1fb238907c1678cc1f1a84c698b1da",
  "48336.dat":
    "489efe3590aa45106913d2e2fa1fd89cf6dd4a55c4f89c20e07f9a5dc729a24a",
  "5-8cyli.dat":
    "91679da1ed677f4273989f784e212d4a3f332cb4bee317617682b216f6aaf284",
  "5-8edge.dat":
    "ecac980b3e5486dda1363611cd2cbba5e3309b2fccc255363b6d9858f00ce583",
  "60470b.dat":
    "04cb0b662f4d4f9fbe0a5d50a4c285ee318944ff95d9cf02d017fba5360fe31b",
  "box2-5.dat":
    "8f297b754f87da1dbe19eec8704a5ce03a23b794ccd7cd015508e3758a206174",
  "box3u2p.dat":
    "df73118b95f23d693c3b7d25c57c483db3bf61ae017d757848119955d28d59e0",
  "box3u4a.dat":
    "15463f41f9947dd75486dc7af3231b1037704f1b654c2555e3ba705817a2db75",
  "box5.dat":
    "ccb7b8a1d36692335b10ea6aa196849afcad4b15331683ed8112a10b50977318",
  "clip6.dat":
    "814e294097fc0ba433756469579d1267ccd88ff43ef1e5edd0f77e24037f628b",
  "phandle1.dat":
    "3cd5c4eca20ef297d265e4ba7228b04a5fb7f332b89f923ead8366987021d6e2",
  "rect.dat":
    "ffeb2dd3d9b83c38841f18f1f74800fbba9e90c5fb6badfff2a795f08a96cb71",
  "rect2p.dat":
    "faac2b36241a9de0c0108471e59c45734df6c79813332d9cacf97f6391886acc",
  "rect3.dat":
    "07ac46908b6668d993b6de0fb001a34cd996542106b80ebc7de63317d8dde865",
  "stud.dat":
    "db037d518d7c08bcdc1f0e7497f4f98e97d99850531dd62d602965520f3bf8f4",
  "stud3.dat":
    "d29e9160faeaf85b2b72a098e89a81f41e0082517a82065d7b1f149b5fd2addd",
  "stug-2x1.dat":
    "03d08cea230e892e1b6cbfe523c19b568a834c5888aac5c789d1fb8d6ee93d96",
};
const abs = (a: number[]) => a.map(Math.abs);
const plus = (a: number[], b: number[]) => a.map((v, i) => v + b[i]);
const multiply = (a: number[], b: number[]) =>
  Array.from({ length: 9 }, (_, n) =>
    [0, 1, 2].reduce(
      (s, k) => s + a[Math.floor(n / 3) * 3 + k] * b[k * 3 + (n % 3)],
      0,
    ),
  ) as Basis;
const delta = (a: Vec3, b: Vec3) => a.map((v, i) => v - b[i]) as Vec3;
const dot = (a: Vec3, b: Vec3) => a.reduce((s, v, i) => s + v * b[i], 0);
const unit = (a: Vec3) => a.map((v) => v / Math.hypot(...a)) as Vec3;
const point = (t: Transform, p: Vec3) => add(t.position, mv(t.basis, p));
const axis = (t: Transform, p: Vec3) => unit(mv(t.basis, p));
const finite = (t: Transform) =>
  [...t.position, ...t.basis].every(Number.isFinite);
const validBudget = (n: number) =>
  Number.isSafeInteger(n) && n >= 0 && n <= 200000;

export type SourceDisplayFrame = {
  rawTransform: Transform;
  normalizedTransform: Transform;
  /** Componentwise bound on changes caused by normalizing every path frame. */
  positionError: Vec3;
  basisError: Basis;
};
/** A diagnostic discrepancy bound, not an uncertainty bound on a physical pose. */
export const articulatedEndpointError = (
  frame: SourceDisplayFrame,
  local: Vec3,
) =>
  plus(frame.positionError, mv(frame.basisError, abs(local) as Vec3)) as Vec3;

/** Check every original path frame, including large translations between rounded
 * parents. Normalized frames are used only to bound interpretation discrepancy;
 * the project and raw occurrence geometry are never rewritten. */
export function articulatedDisplayFrames(
  project: Project,
  all: Occurrence[],
  maxWork = 200000,
  tolerance = ARTICULATED_DISPLAY_TOLERANCE,
) {
  const frames = new Map<string, SourceDisplayFrame>();
  let work = 0,
    exhausted = false;
  if (!validBudget(maxWork)) return { frames, exhausted: true, work };
  if (
    !Number.isFinite(tolerance) ||
    tolerance <= 0 ||
    tolerance > ARTICULATED_DISPLAY_TOLERANCE_MAX
  )
    return { frames, exhausted, work };
  const cache = new Map<
    string,
    { modelId: string; frame: SourceDisplayFrame }
  >();
  cache.set("[]", {
    modelId: project.rootModelId,
    frame: {
      rawTransform: identity(),
      normalizedTransform: identity(),
      positionError: [0, 0, 0],
      basisError: Array(9).fill(0) as Basis,
    },
  });
  const nodes = new Map<
    string,
    Map<string, Project["models"][string]["nodes"][number]>
  >();
  const tick = () => {
    if (++work > maxWork) exhausted = true;
    return !exhausted;
  };
  for (const o of all) {
    if (!tick()) break;
    if (
      !o.path.length ||
      o.path.length > 64 ||
      o.id !== JSON.stringify(o.path) ||
      !finite(o.transform) ||
      !physical(o.transform, tolerance)
    )
      continue;
    let cursor = cache.get("[]")!,
      valid = true;
    for (let n = 0; n < o.path.length; n++) {
      if (!tick()) {
        valid = false;
        break;
      }
      const key = JSON.stringify(o.path.slice(0, n + 1));
      const cached = cache.get(key);
      if (cached && n < o.path.length - 1) {
        cursor = cached;
        continue;
      }
      let modelNodes = nodes.get(cursor.modelId);
      if (!modelNodes) {
        const model = project.models[cursor.modelId];
        if (!model) {
          valid = false;
          break;
        }
        modelNodes = new Map();
        for (const node of model.nodes) {
          if (!tick()) break;
          modelNodes.set(node.id, node);
        }
        if (exhausted) {
          valid = false;
          break;
        }
        nodes.set(cursor.modelId, modelNodes);
      }
      const node = modelNodes.get(o.path[n]);
      if (
        !node ||
        !finite(node.transform) ||
        !physical(node.transform, tolerance) ||
        (n < o.path.length - 1
          ? node.kind !== "submodel"
          : cursor.modelId !== o.modelId ||
            node.id !== o.node.id ||
            node.kind !== o.node.kind ||
            node.ref !== o.node.ref)
      ) {
        valid = false;
        break;
      }
      const prior = cursor.frame,
        q = orthonormalized(node.transform),
        rawTransform = compose(prior.rawTransform, node.transform),
        normalizedTransform = compose(prior.normalizedTransform, q),
        localError = node.transform.basis.map((v, i) =>
          Math.abs(v - q.basis[i]),
        );
      if (!finite(rawTransform) || !physical(rawTransform, tolerance)) {
        valid = false;
        break;
      }
      const frame: SourceDisplayFrame = {
        rawTransform,
        normalizedTransform,
        positionError: plus(
          prior.positionError,
          mv(prior.basisError, abs(node.transform.position) as Vec3),
        ) as Vec3,
        basisError: plus(
          multiply(prior.basisError, abs(node.transform.basis)),
          multiply(abs(prior.normalizedTransform.basis), localError),
        ) as Basis,
      };
      cursor = {
        modelId: node.kind === "submodel" ? node.ref : cursor.modelId,
        frame,
      };
      if (node.kind === "submodel") cache.set(key, cursor);
    }
    if (
      valid &&
      !exhausted &&
      [
        ...cursor.frame.rawTransform.position,
        ...cursor.frame.rawTransform.basis,
      ].every(
        (v, n) =>
          Math.abs(v - [...o.transform.position, ...o.transform.basis][n]) <=
          1e-8,
      )
    )
      frames.set(o.id, cursor.frame);
    if (exhausted) break;
  }
  if (exhausted) frames.clear();
  return { frames, exhausted, work };
}

export type ArticulatedJawMatch = {
  incomingId: string;
  receiverId: string;
  feature: Vec3;
  landmarks: { position: Vec3; caption: string; occurrenceId: string }[];
  facing: Vec3;
  receivingFacing: Vec3;
  camera: CameraSpec;
  receivingCamera: CameraSpec;
  completedDetail: { occurrenceIds: string[]; camera: CameraSpec };
  sourcePath: string[];
  residuals: {
    radialLDU: number;
    signedAxisDot: number;
    finiteParameters: number[];
  };
  errorBoundLDU: number;
  provenance: {
    kind: "source-feature-candidate";
    sourceHashes: Record<string, string>;
    displayTolerance: number;
    physicalFit: "unknown";
  };
};
const camera = (
  t: Transform,
  target: Vec3,
  facing: Vec3,
  span: number,
): CameraSpec => ({
  space: "ldraw",
  projection: "orthographic",
  target,
  position: add(target, facing.map((v) => v * 240) as Vec3),
  up: axis(t, [0, -1, 0]),
  span,
  fovDeg: 45,
  near: 0.1,
  far: 100000,
});

/** One source plate contains two clips. Both complete clip cylinders must match
 * one finite handle with reciprocal uniqueness; incomplete scans yield no match. */
export function articulatedJawProfiles(
  project: Project,
  all: Occurrence[],
  maxWork = 200000,
) {
  const matches: ArticulatedJawMatch[] = [];
  if (!validBudget(maxWork)) return { matches, exhausted: true };
  if (
    project.library.releaseId !== libraryLock.releaseId ||
    project.library.manifestSha256 !== libraryLock.manifestSha256 ||
    project.library.full?.releaseId !== fullLibraryLock.releaseId ||
    project.library.full?.manifestSha256 !== fullLibraryLock.manifestSha256
  )
    return { matches, exhausted: false };
  let aliasWork = 0;
  for (const [key, model] of Object.entries(project.models))
    for (const name of [key, model.id, model.name]) {
      if (++aliasWork > maxWork) return { matches, exhausted: true };
      try {
        if (Object.hasOwn(ARTICULATED_SOURCE_SHA256, canonical(name)))
          return { matches, exhausted: false };
      } catch {
        return { matches, exhausted: false };
      }
    }
  if (all.length + aliasWork > maxWork) return { matches, exhausted: true };
  const selected = all.filter(
    (o) =>
      o.namespace === "official" &&
      o.node.kind === "part" &&
      (o.node.ref === "48336.dat" || o.node.ref === "60470b.dat"),
  );
  const frames = articulatedDisplayFrames(
    project,
    selected,
    maxWork - all.length - aliasWork,
  );
  if (frames.exhausted) return { matches, exhausted: true };
  let work = all.length + aliasWork + frames.work;
  const handles = selected.filter(
      (o) => o.node.ref === "48336.dat" && frames.frames.has(o.id),
    ),
    clips = selected.filter(
      (o) => o.node.ref === "60470b.dat" && frames.frames.has(o.id),
    );
  const candidates: ArticulatedJawMatch[] = [];
  for (const incoming of clips)
    for (const receiver of handles) {
      if (++work > maxWork) return { matches, exhausted: true };
      const a = frames.frames.get(receiver.id)!,
        b = frames.frames.get(incoming.id)!,
        start = point(a.rawTransform, [-14, 2, -20]),
        end = point(a.rawTransform, [14, 2, -20]),
        rod = delta(end, start),
        length = Math.hypot(...rod),
        signedAxisDot = dot(
          axis(a.rawTransform, [1, 0, 0]),
          axis(b.rawTransform, [1, 0, 0]),
        );
      // The reviewed plate frames point in opposite X directions. Other rolls
      // around this cylinder remain an unverified articulated source pose.
      if (signedAxisDot > -0.999) continue;
      const localPoints: Vec3[] = [-10, 10].flatMap((x) =>
        [-4, 4].map((offset) => [x + offset, 2, -20] as Vec3),
      );
      const receiverError = Math.max(
        ...[-14, 14].map((x) =>
          Math.hypot(...articulatedEndpointError(a, [x, 2, -20])),
        ),
      );
      let radialLDU = 0,
        errorBoundLDU = 0,
        fits = true;
      const finiteParameters: number[] = [];
      for (const local of localPoints) {
        const p = point(b.rawTransform, local),
          t = dot(delta(p, start), rod) / (length * length),
          closest = add(start, rod.map((v) => v * t) as Vec3);
        finiteParameters.push(t);
        radialLDU = Math.max(radialLDU, Math.hypot(...delta(p, closest)));
        errorBoundLDU = Math.max(
          errorBoundLDU,
          receiverError + Math.hypot(...articulatedEndpointError(b, local)),
        );
        if (t < -0.25 / length || t > 1 + 0.25 / length) fits = false;
      }
      if (!fits || radialLDU > 0.25 || errorBoundLDU > 0.25) continue;
      const feature = point(a.rawTransform, [0, 2, -20]),
        facing = axis(a.rawTransform, [-0.1, 0.3, -1]),
        receivingFacing = axis(a.rawTransform, [-0.3, 0.3, -1]);
      candidates.push({
        incomingId: incoming.id,
        receiverId: receiver.id,
        feature,
        landmarks: [-10, 10].map((x, n) => ({
          position: point(a.rawTransform, [x, 2, -20]),
          occurrenceId: receiver.id,
          caption: `Handle segment for clip ${n + 1}; source landmark, fit unverified`,
        })),
        facing,
        receivingFacing,
        camera: camera(a.rawTransform, feature, facing, 180),
        receivingCamera: camera(a.rawTransform, feature, receivingFacing, 85),
        completedDetail: {
          occurrenceIds: [receiver.id, incoming.id],
          camera: camera(a.rawTransform, feature, facing, 100),
        },
        sourcePath: incoming.path.slice(0, -1),
        residuals: { radialLDU, signedAxisDot, finiteParameters },
        errorBoundLDU,
        provenance: {
          kind: "source-feature-candidate",
          sourceHashes: { ...ARTICULATED_SOURCE_SHA256 },
          displayTolerance: ARTICULATED_DISPLAY_TOLERANCE,
          physicalFit: "unknown",
        },
      });
    }
  const incomingCounts = new Map<string, number>(),
    receiverCounts = new Map<string, number>();
  for (const candidate of candidates) {
    incomingCounts.set(
      candidate.incomingId,
      (incomingCounts.get(candidate.incomingId) ?? 0) + 1,
    );
    receiverCounts.set(
      candidate.receiverId,
      (receiverCounts.get(candidate.receiverId) ?? 0) + 1,
    );
  }
  for (const candidate of candidates)
    if (
      incomingCounts.get(candidate.incomingId) === 1 &&
      receiverCounts.get(candidate.receiverId) === 1
    )
      matches.push(candidate);
  return { matches, exhausted: false };
}

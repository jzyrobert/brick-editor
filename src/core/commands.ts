import { flattenInstructionProgramme } from "../instructions/programme";
import {
  assessMaterialization,
  requireMaterialization,
  type Materialization,
} from "./materialization";
import { expansionLimits, type ExpansionOptions } from "./expansion-policy";
import {
  isResourceProfile,
  resourceLimits,
  type ResourceProfileName,
} from "./resource-profile";
import { assertRequestBudget } from "./request-budget";
import { generateInstructions } from "../instructions/generate";
import { insertionFingerprint } from "../instructions/collision";
import { editInstructions } from "../instructions/edit";
import { partKey, setPartDecision } from "../inventory/decisions";
import { updateFullLibraryLock } from "../catalog/library-update";
import { makeSubmodel, sharedDefinitionTargets } from "./models";
import { duplicateLayer, mutateFolder } from "./layers";
import {
  axisRotation,
  KinematicSession,
  rebaseRig,
  validateRig,
} from "../mechanisms/kinematic";
import {
  copyFragment,
  pasteFragment,
  translation,
  type CopyRequest,
  type ClipboardFragment,
} from "./fragments";
import {
  type Project,
  type Command,
  type Node,
  type Occurrence,
  type Transform,
  type Vec3,
  type Basis,
  ensure,
  uid,
} from "./types";
import {
  createProject,
  occurrences,
  validateDocument,
  validateSourceDocument,
  encodePath,
} from "./document";
import { identity, compose, inverse, add, mv } from "./math";
import { validate } from "./validate";
import { applyArchitectureCommand } from "./architecture";
import { applySceneCommand } from "./scene";
import { canonical } from "../ldraw/path";
import { stable } from "./hash";
type Patch = { path: string[]; before: unknown; after: unknown };
function diff(a: any, b: any, path: string[] = []): Patch[] {
  if (stable(a) === stable(b)) return [];
  if (
    a &&
    b &&
    !Array.isArray(a) &&
    !Array.isArray(b) &&
    typeof a === "object" &&
    typeof b === "object"
  )
    return [...new Set([...Object.keys(a), ...Object.keys(b)])]
      .filter((k) => k !== "revision" || path.length > 0)
      .flatMap((k) => diff(a[k], b[k], [...path, k]));
  return [{ path, before: a, after: b }];
}
function applyPatches(p: Project, patches: Patch[], undo: boolean) {
  for (const patch of patches) {
    let obj: any = p;
    for (const key of patch.path.slice(0, -1)) obj = obj[key];
    const key = patch.path.at(-1)!;
    const value = undo ? patch.before : patch.after;
    if (value === undefined) delete obj[key];
    else obj[key] = structuredClone(value);
  }
}
function fields(payload: Record<string, any>, allowed: string[]) {
  ensure(
    Object.keys(payload).every((k) => allowed.includes(k)),
    "INVALID_INPUT",
    "Unknown command payload field",
  );
}
function editable(p: Project, payload: Record<string, any>): Occurrence[] {
  ensure(
    Array.isArray(payload.occurrenceIds) && payload.occurrenceIds.length > 0,
    "INVALID_INPUT",
    "Select at least one occurrence",
  );
  const selectedIds = new Set(payload.occurrenceIds as string[]),
    found = occurrences(p).filter((o) => selectedIds.has(o.id));
  ensure(
    found.length === selectedIds.size,
    "INVALID_INPUT",
    "Unknown occurrence ID",
  );
  for (const o of found) {
    ensure(
      !p.layers[o.layerId].locked,
      "LAYER_LOCKED",
      "Unlock the target layer before editing",
    );
    ensure(
      o.visible || payload.includeHidden === true,
      "INVALID_INPUT",
      "Hidden targets require includeHidden",
    );
    if (payload.activeLayerId)
      ensure(
        o.layerId === payload.activeLayerId,
        "INVALID_INPUT",
        "Target outside active layer",
      );
  }
  return found;
}
// Node IDs are local to definitions. Cloning a definition preserves its local IDs,
// hence all occurrence paths and occurrence-scoped metadata stay stable.
export function uniqueNode(p: Project, o: Occurrence): Node {
  let model = p.models[p.rootModelId];
  for (const id of o.path.slice(0, -1)) {
    const n = model.nodes.find((n) => n.id === id)!;
    let count = 0;
    for (const m of Object.values(p.models))
      count += m.nodes.filter(
        (x) => x.kind === "submodel" && x.ref === n.ref,
      ).length;
    if (count > 1) {
      const cloned = structuredClone(p.models[n.ref]);
      cloned.id = uid();
      cloned.name = `unique-${cloned.id}.ldr`;
      p.models[cloned.id] = cloned;
      n.ref = cloned.id;
    }
    model = p.models[n.ref];
  }
  return model.nodes.find((n) => n.id === o.path.at(-1))!;
}
function mutate(
  p: Project,
  c: Command,
  copyMappings: Record<string, string[]> = {},
  idRemappings: Record<string, string> = {},
) {
  const v = c.payload;
  const scopeFields = ["occurrenceIds", "includeHidden", "activeLayerId"];
  switch (c.type) {
    case "models.makeSubmodel": {
      fields(v, [...scopeFields, "name", "pivot"]);
      const mapping = makeSubmodel(
        p,
        editable(p, v),
        v as { name: string; pivot?: Vec3 },
        uniqueNode,
      );
      for (const key of Object.keys(idRemappings))
        idRemappings[key] = mapping[idRemappings[key]] || idRemappings[key];
      Object.assign(idRemappings, mapping);
      break;
    }
    case "models.makeUnique": {
      fields(v, scopeFields);
      const targets = editable(p, v);
      ensure(
        targets.every((o) => o.path.length > 1),
        "INVALID_INPUT",
        "Select leaves inside a submodel instance to make its definition unique.",
      );
      targets.forEach((o) => uniqueNode(p, o));
      break;
    }
    case "models.editShared": {
      fields(v, [
        "definitionId",
        "nodeIds",
        "confirmShared",
        "includeHidden",
        "activeLayerId",
        "operation",
        "colorCode",
        "delta",
        "axis",
        "degrees",
        "pivot",
      ]);
      ensure(
        v.confirmShared === true,
        "INVALID_INPUT",
        "Shared edits require explicit acknowledgement of all instances.",
      );
      const targets = sharedDefinitionTargets(p, v.definitionId, v.nodeIds);
      editable(p, { ...v, occurrenceIds: targets.map((o) => o.id) });
      if (v.operation === "move" || v.operation === "rotate")
        ensure(
          !Object.values(p.motionRigs).some((r) =>
            r.groups.some((g) =>
              g.occurrenceIds.some((id) => targets.some((o) => o.id === id)),
            ),
          ),
          "INVALID_INPUT",
          "Shared transform would change motion-rig rest geometry. Remove or re-author the affected rig first.",
        );
      const definition = p.models[v.definitionId];
      let rotation: Transform | undefined;
      if (v.operation === "rotate") {
        ensure(
          Math.abs(Math.hypot(...v.axis) - 1) < 1e-6,
          "INVALID_INPUT",
          "Shared rotation axis must be a unit vector in definition-local coordinates.",
        );
        const length = Math.hypot(...v.axis),
          basis = axisRotation(
            v.axis.map((x: number) => x / length) as Vec3,
            v.degrees,
          );
        rotation = {
          basis,
          position: add(
            v.pivot,
            mv(basis, v.pivot.map((x: number) => -x) as Vec3),
          ),
        };
      }
      for (const node of definition.nodes.filter((n) =>
        v.nodeIds.includes(n.id),
      )) {
        if (v.operation === "recolor") node.colorCode = v.colorCode;
        else if (rotation) node.transform = compose(rotation, node.transform);
        else node.transform.position = add(node.transform.position, v.delta);
      }
      break;
    }
    case "scene.set":
      applySceneCommand(p, v);
      break;
    case "library.update":
      fields(v, ["expected"]);
      updateFullLibraryLock(p, v.expected);
      break;
    case "project.rename":
      fields(v, ["title"]);
      ensure(
        typeof v.title === "string" && v.title.length <= 200,
        "INVALID_INPUT",
        "Invalid title",
      );
      p.title = v.title;
      break;
    case "rigs.upsert": {
      fields(v, ["rig", "includeHidden", "activeLayerId"]);
      validateRig(p, v.rig);
      editable(p, {
        occurrenceIds: [
          ...v.rig.groups,
          ...(p.motionRigs[v.rig.id]?.groups ?? []),
        ].flatMap((g: any) => g.occurrenceIds),
        activeLayerId: v.activeLayerId,
        includeHidden: v.includeHidden,
      });
      for (const existing of Object.values(p.motionRigs)) {
        validateRig(p, existing, false);
        if (existing.id !== v.rig.id)
          ensure(
            !existing.groups.some((g) =>
              g.occurrenceIds.some((id) =>
                v.rig.groups.some((g: any) => g.occurrenceIds.includes(id)),
              ),
            ),
            "INVALID_INPUT",
            "An occurrence cannot belong to multiple motion rigs.",
          );
      }
      p.motionRigs[v.rig.id] = structuredClone(v.rig);
      break;
    }
    case "rigs.remove": {
      fields(v, ["rigId", "includeHidden", "activeLayerId"]);
      ensure(p.motionRigs[v.rigId], "INVALID_INPUT", "Unknown motion rig.");
      editable(p, {
        occurrenceIds: p.motionRigs[v.rigId].groups.flatMap(
          (g) => g.occurrenceIds,
        ),
        includeHidden: v.includeHidden,
        activeLayerId: v.activeLayerId,
      });
      delete p.motionRigs[v.rigId];
      break;
    }
    case "rigs.applyPose": {
      fields(v, ["rigId", "sourceRevision", "pose", "includeHidden"]);
      ensure(
        v.sourceRevision === p.revision,
        "REVISION_CONFLICT",
        "Mechanism pose belongs to an older source revision.",
      );
      const session = new KinematicSession(p, v.rigId);
      const snapshot = session.setPose(v.pose);
      const targets = editable(p, {
        occurrenceIds: Object.keys(snapshot.transforms),
        includeHidden: v.includeHidden,
      });
      for (const o of targets) {
        const n = uniqueNode(p, o);
        n.transform = compose(
          inverse(parentTransform(p, o.path)),
          snapshot.transforms[o.id],
        );
      }
      p.motionRigs[v.rigId] = rebaseRig(p.motionRigs[v.rigId], snapshot);
      validateRig(p, p.motionRigs[v.rigId]);
      break;
    }
    case "parts.duplicate": {
      fields(v, [...scopeFields, "delta"]);
      editable(p, v);
      const fragment = copyFragment(p, {
        occurrenceIds: v.occurrenceIds,
        includeHidden: v.includeHidden,
      });
      Object.assign(
        copyMappings,
        pasteFragment(p, fragment, [translation(v.delta ?? [20, 0, 20])]),
      );
      break;
    }
    case "clipboard.paste": {
      fields(v, ["fragment", "delta", "layerId", "maxAdditions"]);
      Object.assign(
        copyMappings,
        pasteFragment(p, v.fragment, [translation(v.delta ?? [0, 0, 0])], v),
      );
      break;
    }
    case "parts.array": {
      fields(v, [
        ...scopeFields,
        "kind",
        "count",
        "delta",
        "center",
        "axis",
        "angleDegrees",
        "maxAdditions",
      ]);
      editable(p, v);
      const fragment = copyFragment(p, {
        occurrenceIds: v.occurrenceIds,
        includeHidden: v.includeHidden,
      });
      const transforms: Transform[] = [];
      for (let i = 1; i <= v.count; i++) {
        if (v.kind === "linear")
          transforms.push(
            translation(v.delta.map((x: number) => x * i) as Vec3),
          );
        else {
          const length = Math.hypot(...v.axis);
          ensure(
            length > 1e-9,
            "INVALID_INPUT",
            "Circular array axis must be nonzero.",
          );
          const [x, y, z] = v.axis.map((n: number) => n / length),
            angle = (v.angleDegrees * i * Math.PI) / 180,
            c = Math.cos(angle),
            s = Math.sin(angle),
            t = 1 - c;
          const basis: Basis = [
            t * x * x + c,
            t * x * y - s * z,
            t * x * z + s * y,
            t * x * y + s * z,
            t * y * y + c,
            t * y * z - s * x,
            t * x * z - s * y,
            t * y * z + s * x,
            t * z * z + c,
          ];
          const rotated = mv(basis, v.center);
          transforms.push({
            basis,
            position: v.center.map(
              (n: number, k: number) => n - rotated[k],
            ) as Vec3,
          });
        }
      }
      Object.assign(
        copyMappings,
        pasteFragment(p, fragment, transforms, {
          maxAdditions: v.maxAdditions,
        }),
      );
      break;
    }
    case "parts.add": {
      fields(v, ["parts", "layerId", "maxAdditions"]);
      ensure(
        Array.isArray(v.parts) &&
          v.parts.length > 0 &&
          v.parts.length <= Math.min(v.maxAdditions ?? 10000, 10000),
        "LIMIT_EXCEEDED",
        "Invalid additions budget",
      );
      const layer = v.layerId || p.defaultLayerId;
      ensure(p.layers[layer], "INVALID_INPUT", "Unknown layer");
      ensure(!p.layers[layer].locked, "LAYER_LOCKED", "Target layer is locked");
      for (const input of v.parts) {
        fields(input, ["ref", "colorCode", "transform"]);
        const n: Node = {
          id: uid(),
          kind: "part",
          ref: canonical(input.ref),
          colorCode: input.colorCode,
          transform: input.transform || identity(),
        };
        ensure(
          typeof n.colorCode === "string",
          "INVALID_INPUT",
          "Color code required",
        );
        p.models[p.rootModelId].nodes.push(n);
        p.layerAssignments[encodePath([n.id])] = layer;
      }
      break;
    }
    case "parts.remove":
    case "parts.recolor":
    case "parts.transform":
    case "parts.replace": {
      const allowed =
        c.type === "parts.recolor"
          ? ["colorCode", "preserveFixedColors"]
          : c.type === "parts.transform"
            ? ["delta", "transform", "space"]
            : c.type === "parts.replace"
              ? ["ref", "anchorOffset"]
              : [];
      fields(v, [...scopeFields, ...allowed]);
      const selected = editable(p, v);
      if (c.type === "parts.recolor")
        ensure(
          typeof v.colorCode === "string" &&
            /^\d+$|^0x2[\da-f]{6}$/i.test(v.colorCode),
          "INVALID_INPUT",
          "Invalid color code",
        );
      if (c.type === "parts.transform")
        ensure(
          (v.space ?? "ldraw") === "ldraw" && (v.delta || v.transform),
          "INVALID_INPUT",
          "Specify an LDraw transform or delta",
        );
      for (const o of selected) {
        const n = uniqueNode(p, o);
        if (c.type === "parts.remove") {
          const owner = Object.values(p.models).find((m) =>
            m.nodes.includes(n),
          )!;
          owner.nodes = owner.nodes.filter((x) => x !== n);
          delete p.layerAssignments[o.id];
          delete p.marketplace.overrides[o.id];
          for (const g of Object.values(p.groups)) {
            const i = g.indexOf(o.id);
            if (i >= 0) g.splice(i, 1);
          }
          for (const plan of Object.values(p.instructionPlans)) {
            flattenInstructionProgramme(plan);
            plan.steps = plan.steps.map((s) => s.filter((id) => id !== o.id));
          }
        }
        if (c.type === "parts.recolor") n.colorCode = v.colorCode;
        if (c.type === "parts.replace") {
          n.ref = canonical(v.ref);
          n.kind = "part";
          // Part-local offset of the new origin, so callers can keep e.g. the bottom
          // face in place when heights differ (LDraw brick origins are at the top).
          if (v.anchorOffset !== undefined) {
            ensure(
              Array.isArray(v.anchorOffset) &&
                v.anchorOffset.length === 3 &&
                v.anchorOffset.every(
                  (x: unknown) =>
                    typeof x === "number" &&
                    Number.isFinite(x) &&
                    Math.abs(x) <= 10000,
                ),
              "INVALID_INPUT",
              "anchorOffset must be three finite LDU values",
            );
            n.transform = {
              ...n.transform,
              position: add(
                n.transform.position,
                mv(n.transform.basis, v.anchorOffset as Vec3),
              ),
            };
          }
        }
        if (c.type === "parts.transform") {
          const parent = parentTransform(p, o.path);
          const world: Transform = v.transform || {
            ...o.transform,
            position: add(o.transform.position, v.delta),
          };
          n.transform = compose(inverse(parent), world);
        }
      }
      break;
    }
    case "layers.duplicate": {
      fields(v, ["layerId", "name", "includeHidden", "maxAdditions"]);
      Object.assign(copyMappings, duplicateLayer(p, v as { layerId: string }));
      break;
    }
    case "layers.folder": {
      fields(v, ["layerId", "parentFolderId"]);
      const layer = p.layers[v.layerId];
      ensure(layer, "INVALID_INPUT", "Unknown layer");
      if (v.parentFolderId) {
        ensure(
          p.layerFolders?.[v.parentFolderId],
          "INVALID_INPUT",
          "Unknown folder",
        );
        layer.parentFolderId = v.parentFolderId;
      } else delete layer.parentFolderId;
      break;
    }
    case "folders.add":
      fields(v, ["name", "parentFolderId"]);
      mutateFolder(p, c.type, v);
      break;
    case "folders.rename":
      fields(v, ["folderId", "name"]);
      mutateFolder(p, c.type, v);
      break;
    case "folders.move":
      fields(v, ["folderId", "parentFolderId"]);
      mutateFolder(p, c.type, v);
      break;
    case "folders.remove":
      fields(v, ["folderId", "mode"]);
      mutateFolder(p, c.type, v);
      break;
    case "layers.add":
      fields(v, ["name"]);
      ensure(
        typeof v.name === "string",
        "INVALID_INPUT",
        "Layer name required",
      );
      {
        const id = uid();
        p.layers[id] = {
          id,
          name: v.name,
          visible: true,
          locked: false,
          order: Object.keys(p.layers).length,
        };
      }
      break;
    case "layers.update":
      fields(v, ["layerId", "name", "visible", "locked"]);
      {
        const l = p.layers[v.layerId];
        ensure(l, "INVALID_INPUT", "Unknown layer");
        for (const key of ["name", "visible", "locked"] as const)
          if (v[key] !== undefined) (l as any)[key] = v[key];
      }
      break;
    case "layers.rename":
      fields(v, ["layerId", "name"]);
      ensure(
        p.layers[v.layerId] && typeof v.name === "string",
        "INVALID_INPUT",
        "Invalid layer name",
      );
      p.layers[v.layerId].name = v.name;
      break;
    case "layers.reorder":
      fields(v, ["layerIds"]);
      ensure(
        Array.isArray(v.layerIds) &&
          v.layerIds.length === Object.keys(p.layers).length &&
          new Set(v.layerIds).size === v.layerIds.length &&
          v.layerIds.every((id: string) => p.layers[id]),
        "INVALID_INPUT",
        "Provide every layer exactly once",
      );
      v.layerIds.forEach((id: string, i: number) => (p.layers[id].order = i));
      break;
    case "layers.remove": {
      fields(v, ["layerId", "mode", "destinationLayerId"]);
      const layer = p.layers[v.layerId];
      ensure(
        layer && !layer.locked,
        "LAYER_LOCKED",
        "Unlock the layer before deleting it",
      );
      ensure(
        Object.keys(p.layers).length > 1,
        "INVALID_INPUT",
        "Keep at least one layer",
      );
      ensure(
        v.mode === "delete-contents" || v.mode === "reassign",
        "INVALID_INPUT",
        "Choose deletion or reassignment explicitly",
      );
      const target = p.layers[v.destinationLayerId];
      ensure(
        target && target.id !== layer.id && !target.locked,
        "LAYER_LOCKED",
        "Choose a different unlocked destination layer",
      );
      const ids = occurrences(p)
        .filter((o) => o.layerId === layer.id)
        .map((o) => o.id);
      if (v.mode === "delete-contents" && ids.length)
        mutate(p, {
          ...c,
          type: "parts.remove",
          payload: { occurrenceIds: ids, includeHidden: true },
        });
      else for (const id of ids) p.layerAssignments[id] = target.id;
      if (p.defaultLayerId === layer.id) p.defaultLayerId = target.id;
      delete p.layers[layer.id];
      break;
    }
    case "groups.create":
      fields(v, ["name", "occurrenceIds"]);
      ensure(
        typeof v.name === "string" &&
          !["__proto__", "constructor", "prototype"].includes(v.name),
        "INVALID_INPUT",
        "Invalid group name",
      );
      {
        const all = new Set(occurrences(p).map((o) => o.id));
        ensure(
          Array.isArray(v.occurrenceIds) &&
            v.occurrenceIds.every((id: string) => all.has(id)),
          "INVALID_INPUT",
          "Invalid group members",
        );
        p.groups[v.name] = [...new Set(v.occurrenceIds as string[])];
      }
      break;
    case "floors.set":
    case "labels.add":
    case "labels.update":
    case "labels.remove":
    case "camera.bookmark.focus":
      applyArchitectureCommand(p, c.type, v);
      break;
    case "camera.bookmark":
      fields(v, ["name", "camera", "floorFocus"]);
      validate("camera", v.camera);
      ensure(
        typeof v.name === "string" &&
          !["__proto__", "constructor", "prototype"].includes(v.name),
        "INVALID_INPUT",
        "Invalid bookmark name",
      );
      p.cameraBookmarks[v.name] = v.camera;
      // Optional floor focus saved with the view ("hide the roof in this camera").
      if (v.floorFocus !== undefined)
        applyArchitectureCommand(p, "camera.bookmark.focus", {
          name: v.name,
          floorFocus: v.floorFocus,
        });
      break;
    case "layers.assign":
      fields(v, [...scopeFields, "layerId"]);
      ensure(
        p.layers[v.layerId] && !p.layers[v.layerId].locked,
        "LAYER_LOCKED",
        "Destination unavailable",
      );
      for (const o of editable(p, v)) p.layerAssignments[o.id] = v.layerId;
      break;
    case "inventory.override":
      if ("part" in v) {
        // Part-level parts-list decision (src/inventory/decisions.ts).
        fields(v, ["part", "decision"]);
        ensure(
          v.decision === null ||
            occurrences(p).some((o) => partKey(o) === v.part),
          "INVALID_INPUT",
          "That part is not in this build",
        );
        setPartDecision(p, v.part, v.decision);
        break;
      }
      fields(v, ["occurrenceId", "mapping"]);
      ensure(
        occurrences(p).some((o) => o.id === v.occurrenceId),
        "INVALID_INPUT",
        "Unknown occurrence",
      );
      if (v.mapping === null) delete p.marketplace.overrides[v.occurrenceId];
      else {
        ensure(
          v.mapping?.acknowledged === true,
          "INVALID_INPUT",
          "Mapping requires acknowledgement",
        );
        p.marketplace.overrides[v.occurrenceId] = v.mapping;
      }
      break;
    case "instructions.create":
    case "instructions.rename":
    case "instructions.remove":
    case "instructions.step.add":
    case "instructions.step.remove":
    case "instructions.step.reorder":
    case "instructions.step.assign":
    case "instructions.step.split":
    case "instructions.step.merge":
    case "instructions.step.update":
      editInstructions(p, c.type, v);
      break;
    case "instructions.installGenerated":
      fields(v, ["plan"]);
      ensure(
        v.plan.generation?.sourceRevision === p.revision,
        "REVISION_CONFLICT",
        "Model changed while generating instructions; generate again.",
      );
      ensure(
        v.plan.generation?.insertionFingerprint ===
          insertionFingerprint(p, v.plan),
        "INVALID_INPUT",
        "Generated instructions do not match this model and programme.",
      );
      ensure(
        v.plan.steps.length <= 2000 &&
          v.plan.steps.flat().length === occurrences(p).length,
        "INVALID_INPUT",
        "Generated instructions must cover the complete model within the step budget.",
      );
      p.instructionPlans[uid()] = structuredClone(v.plan);
      break;
    case "instructions.generate":
      fields(v, ["name", "maxPerStep", "useSourceSteps"]);
      p.instructionPlans[uid()] = generateInstructions(p, v).plan;
      break;
    case "instructions.layers":
      fields(v, ["name", "maxPerStep"]);
      {
        const n = v.maxPerStep ?? 10;
        ensure(
          Number.isInteger(n) && n > 0 && n <= 1000,
          "INVALID_INPUT",
          "Invalid step size",
        );
        const all = occurrences(p);
        const steps: string[][] = [];
        for (const layer of Object.values(p.layers).sort(
          (a, b) => a.order - b.order,
        )) {
          const ids = all
            .filter((o) => o.layerId === layer.id)
            .map((o) => o.id);
          for (let i = 0; i < ids.length; i += n)
            steps.push(ids.slice(i, i + n));
        }
        p.instructionPlans[uid()] = { name: v.name || "By layer", steps };
      }
      break;
    default:
      ensure(false, "INVALID_INPUT", "Unsupported command " + c.type);
  }
}
export function parentTransform(p: Project, path: string[]) {
  let t = identity(),
    m = p.models[p.rootModelId];
  for (const id of path.slice(0, -1)) {
    const n = m.nodes.find((n) => n.id === id)!;
    t = compose(t, n.transform);
    m = p.models[n.ref];
  }
  return t;
}
export class Editor {
  private state: Project;
  private past: Patch[][] = [];
  private future: Patch[][] = [];
  private ledger = new Map<
    string,
    {
      key: string;
      result: any;
      cut?: { key: string; fragment: ClipboardFragment };
    }
  >();
  private listeners = new Set<() => void>();
  historyTruncated = false;
  private availability: Materialization;
  private expansionOptions: ExpansionOptions;
  constructor(p = createProject(), expansionOptions: ExpansionOptions = {}) {
    this.expansionOptions = structuredClone(expansionOptions);
    const effective = expansionLimits(this.expansionOptions),
      defaults = expansionLimits();
    ensure(
      Object.keys(effective).every(
        (key) =>
          effective[key as keyof typeof effective] <=
          defaults[key as keyof typeof defaults],
      ),
      "INVALID_INPUT",
      "Raised Editor expansion limits are not supported across derived consumers yet",
    );
    validate("project", p);
    validateSourceDocument(p);
    this.availability = assessMaterialization(p, expansionOptions);
    this.state = structuredClone(p);
  }
  get materialization() {
    return structuredClone(this.availability);
  }
  requireMaterialization() {
    requireMaterialization(this.availability);
  }
  get resourceProfile(): ResourceProfileName {
    return this.expansionOptions.profile ?? "desktop";
  }
  /** Trusted session policy change. Re-assesses the current document without
   * changing its revision; a stricter profile may leave it source-only. */
  setResourceProfile(profile: ResourceProfileName) {
    ensure(
      isResourceProfile(profile),
      "INVALID_INPUT",
      "Unknown resource profile",
    );
    if (profile === this.resourceProfile) return this.materialization;
    this.expansionOptions = { ...this.expansionOptions, profile };
    this.availability = assessMaterialization(
      this.state,
      this.expansionOptions,
    );
    this.emit();
    return this.materialization;
  }
  get project() {
    return structuredClone(this.state);
  }
  /**
   * The current document itself, not a copy. The editor never mutates a
   * document once installed (commands copy it and install the result), so
   * this stays valid; callers must treat it as immutable. The UI's commit
   * subscriber uses it: deep-copying a 20,000-part document on every commit
   * cost a few hundred ms.
   */
  get snapshot(): Readonly<Project> {
    return this.state;
  }
  /** Cheap reads for hot paths; `project` deep-copies the whole document. */
  get revision() {
    return this.state.revision;
  }
  get projectId() {
    return this.state.id;
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit() {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch (error) {
        console.error("Editor subscriber failed after commit", error);
      }
    }
  }
  /**
   * Replace the document. `trusted` is for a project the caller has just
   * validated (schema and source) and will not mutate afterwards: it skips
   * validating and deep-copying it again (large recovered projects). Only a
   * shallow copy is made, so the caller's object keeps its own revision.
   */
  replace(p: Project, options: { trusted?: boolean } = {}) {
    if (!options.trusted) {
      validate("project", p);
      validateSourceDocument(p);
    }
    const replacement = options.trusted ? { ...p } : structuredClone(p);
    const availability = assessMaterialization(
      replacement,
      this.expansionOptions,
    );
    const revision = Math.max(this.state.revision, p.revision) + 1;
    ensure(
      Number.isSafeInteger(revision),
      "LIMIT_EXCEEDED",
      "Revision counter exhausted",
    );
    replacement.revision = revision;
    availability.revision = revision;
    this.state = replacement;
    this.availability = availability;
    this.past = [];
    this.future = [];
    this.ledger.clear();
    this.emit();
    return {
      revision: this.state.revision,
      materialization: this.materialization,
    };
  }
  copy(request: CopyRequest) {
    this.requireMaterialization();
    return copyFragment(this.state, request);
  }
  cut(request: CopyRequest & { expectedRevision: number; commandId: string }) {
    this.requireMaterialization();
    assertRequestBudget(request);
    fields(request, [
      "occurrenceIds",
      "includeHidden",
      "expectedRevision",
      "commandId",
    ]);
    const key = stable(request),
      previous = this.ledger.get(request.commandId);
    if (previous) {
      ensure(
        previous.cut?.key === key,
        "INVALID_INPUT",
        "Command ID reused with different content",
      );
      return structuredClone({
        ...previous.result,
        fragment: previous.cut.fragment,
      });
    }
    const fragment = copyFragment(this.state, {
      occurrenceIds: request.occurrenceIds,
      includeHidden: request.includeHidden,
    });
    const result = this.dispatch({
      schemaVersion: 1,
      commandId: request.commandId,
      expectedRevision: request.expectedRevision,
      type: "parts.remove",
      payload: {
        occurrenceIds: request.occurrenceIds,
        includeHidden: request.includeHidden,
      },
    });
    const entry = this.ledger.get(request.commandId);
    if (entry) entry.cut = { key, fragment };
    return structuredClone({ ...result, fragment });
  }
  dispatch(c: Command) {
    assertRequestBudget(c);
    return this.transaction({
      commandId: c.commandId,
      expectedRevision: c.expectedRevision,
      commands: [c],
      dryRun: c.dryRun,
    });
  }
  transaction(input: {
    commandId: string;
    expectedRevision: number;
    commands: Command[];
    dryRun?: boolean;
  }) {
    this.requireMaterialization();
    assertRequestBudget(input);
    ensure(
      input && Array.isArray(input.commands),
      "INVALID_INPUT",
      "Transaction commands must be an array",
    );
    ensure(
      input.commands.length > 0 && input.commands.length <= 1000,
      "LIMIT_EXCEEDED",
      "Invalid transaction size",
    );
    for (const c of input.commands) validate("command", c);
    const key = stable(input);
    const previous = this.ledger.get(input.commandId);
    if (previous) {
      ensure(
        previous.key === key,
        "INVALID_INPUT",
        "Command ID reused with different content",
      );
      return structuredClone(previous.result);
    }
    ensure(
      input.expectedRevision === this.state.revision &&
        input.commands.every(
          (c) => c.expectedRevision === input.expectedRevision,
        ),
      "REVISION_CONFLICT",
      "Document changed; refresh before editing",
    );
    const p = structuredClone(this.state);
    const history = input.commands[0].type;
    let undoPatch: Patch[] | undefined;
    const copyMappings: Record<string, string[]> = {};
    const idRemappings: Record<string, string> = {};
    if (history === "history.undo" || history === "history.redo") {
      ensure(
        input.commands.length === 1,
        "INVALID_INPUT",
        "History command must stand alone",
      );
      undoPatch = (history === "history.undo" ? this.past : this.future).at(-1);
      ensure(undoPatch, "INVALID_INPUT", "Nothing to " + history.split(".")[1]);
      applyPatches(p, undoPatch, history === "history.undo");
    } else
      for (const c of input.commands) mutate(p, c, copyMappings, idRemappings);
    requireMaterialization(assessMaterialization(p, this.expansionOptions));
    p.diagnostics = p.diagnostics.filter((d) => d.code !== "REFERENCE_MISSING");
    for (const o of occurrences(p))
      if (o.namespace === "missing")
        p.diagnostics.push({
          code: "REFERENCE_MISSING",
          severity: "warning",
          message: "Unresolved reference: " + o.node.ref,
          occurrenceIds: [o.id],
        });
    validate("project", p);
    validateDocument(p);
    const patches = diff(this.state, p);
    ensure(
      Number.isSafeInteger(p.revision + 1),
      "LIMIT_EXCEEDED",
      "Revision counter exhausted",
    );
    p.revision++;
    const beforeIds = new Set(occurrences(this.state).map((o) => o.id));
    const afterIds = new Set(occurrences(p).map((o) => o.id));
    // Net growth, so regrouping (new IDs, same parts) and undo are not counted as additions.
    if (!undoPatch) {
      const additions = afterIds.size - beforeIds.size,
        limit = resourceLimits(this.resourceProfile).additionsPerCommand;
      ensure(
        additions <= limit,
        "LIMIT_EXCEEDED",
        `This change adds ${additions.toLocaleString("en")} parts; the ${this.resourceProfile} profile allows ${limit.toLocaleString("en")} per command.`,
        {
          resource: "additionsPerCommand",
          limit,
          requiredAtLeast: additions,
          profile: this.resourceProfile,
        },
      );
    }
    const result = {
      revision: p.revision,
      affectedIds: occurrences(p).map((o) => o.id),
      idRemappings,
      copyMappings,
      addedPlanIds: Object.keys(p.instructionPlans).filter(
        (id) => !this.state.instructionPlans[id],
      ),
      addedLayerIds: Object.keys(p.layers).filter(
        (id) => !this.state.layers[id],
      ),
      addedFolderIds: Object.keys(p.layerFolders ?? {}).filter(
        (id) => !this.state.layerFolders?.[id],
      ),
      addedIds: occurrences(p)
        .filter((o) => !beforeIds.has(o.id))
        .map((o) => o.id),
      removedIds: [...beforeIds].filter((id) => !afterIds.has(id)),
      diagnostics: p.diagnostics,
      partCount: occurrences(p).length,
      dryRun: !!input.dryRun,
    };
    if (input.dryRun) return result;
    if (undoPatch) {
      if (history === "history.undo") {
        this.past.pop();
        this.future.push(undoPatch);
      } else {
        this.future.pop();
        this.past.push(undoPatch);
      }
    } else {
      this.past.push(patches);
      this.future = [];
    }
    while (
      this.past.length > 100 ||
      JSON.stringify(this.past).length > 8 * 1024 * 1024
    ) {
      this.past.shift();
      this.historyTruncated = true;
    }
    this.state = p;
    this.availability = assessMaterialization(p, this.expansionOptions);
    this.ledger.set(input.commandId, { key, result });
    if (this.ledger.size > 500)
      this.ledger.delete(this.ledger.keys().next().value!);
    this.emit();
    return result;
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
}

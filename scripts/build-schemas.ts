import Ajv from "ajv";
import { BACKDROP_NAMES, PLAY_HINT_MAX_LENGTH } from "../src/core/scene";
import standaloneCode from "ajv/dist/standalone/index.js";
import { writeFileSync } from "node:fs";
import { buildScriptJsonSchema } from "../src/build-script/spec";
import { RESOURCE_PROFILES } from "../src/core/resource-profile";
import {
  FIXTURE_TEMPLATES,
  SAMPLE_TEMPLATES,
  TEMPLATE_NAMES,
} from "../src/catalog/template-names";
import { _Code } from "ajv/dist/compile/codegen/code.js";
import {
  isOccurrenceId,
  NODE_ID_MAX_CODEPOINTS,
  OCCURRENCE_PATH_MAX_DEPTH,
  OCCURRENCE_ID_MAX_LENGTH,
} from "../src/core/occurrence-id";
const str = { type: "string", maxLength: 4096 },
  num = { type: "number" },
  id = { type: "string", minLength: 1, maxLength: 1024 },
  integer = { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER };
const occurrenceId = {
  type: "string",
  minLength: 5,
  maxLength: OCCURRENCE_ID_MAX_LENGTH,
  format: "occurrence-id",
};
const obj = (
  properties: any,
  required = Object.keys(properties),
  extra = false,
) => ({ type: "object", properties, required, additionalProperties: extra });
/** Default list cap: the largest project's placed occurrences (desktop), so
 * node, occurrence and per-occurrence lists hold any admitted project. */
const MAX_LIST = RESOURCE_PROFILES.desktop.occurrences;
const arr = (items: any, maxItems = MAX_LIST) => ({
  type: "array",
  items,
  maxItems,
});
const vec = { ...arr(num, 3), minItems: 3 },
  basis = { ...arr(num, 9), minItems: 9 };
const transform = obj({ position: vec, basis });
const dictionary = (value: any) => ({
  type: "object",
  maxProperties: 10000,
  additionalProperties: value,
  propertyNames: { not: { enum: ["__proto__", "constructor", "prototype"] } },
});
const occurrenceDictionary = (value: any) => ({
  ...dictionary(value),
  propertyNames: occurrenceId,
});
const node = obj(
  {
    id,
    kind: { enum: ["part", "submodel", "geometry"] },
    ref: id,
    colorCode: id,
    transform,
    sourceRecordId: id,
  },
  ["id", "kind", "ref", "colorCode", "transform"],
);
const camera = obj(
  {
    space: { const: "ldraw" },
    projection: { enum: ["perspective", "orthographic"] },
    position: vec,
    target: vec,
    up: vec,
    fovDeg: { type: "number", exclusiveMinimum: 0, exclusiveMaximum: 180 },
    near: { type: "number", exclusiveMinimum: 0 },
    far: { type: "number", exclusiveMinimum: 0 },
    span: { type: "number", exclusiveMinimum: 0 },
  },
  ["space", "projection", "position", "target", "up", "fovDeg", "near", "far"],
);
const floorGuide = obj({ id, name: { type: "string", maxLength: 60 }, y: num });
const roomLabel = obj(
  { id, text: { type: "string", maxLength: 80 }, position: vec, floorId: id },
  ["id", "text", "position"],
);
const floorFocus = obj({ floorId: id, ghostBelow: { type: "boolean" } });
const diagnostic = obj(
  {
    code: id,
    message: str,
    severity: { enum: ["warning", "error"] },
    occurrenceIds: arr(occurrenceId),
    details: {},
  },
  ["code", "message", "severity", "occurrenceIds"],
);
const scope = {
  oneOf: [
    obj({ kind: { const: "all" } }),
    obj({ kind: { const: "visible" } }),
    obj({ kind: { const: "layers" }, layerIds: arr(id) }),
    obj({ kind: { const: "selection" }, occurrenceIds: arr(occurrenceId) }),
    obj({ kind: { const: "submodel" }, occurrenceId }),
  ],
};
// Parts-list decisions (src/inventory/decisions.ts keeps the same patterns).
const partKey = {
  type: "string",
  pattern: "^(official|project|missing):[^\\s:][^:]{0,1023}$",
};
const brickLinkItem = {
  type: "string",
  pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$",
};
const partDecision = obj(
  {
    itemId: brickLinkItem,
    origin: { enum: ["candidate", "derived", "reviewed", "user"] },
    checked: { type: "boolean" },
    exclude: { type: "boolean" },
    acceptedColors: arr({ type: "string", pattern: "^[0-9]+$" }, 1000),
    acknowledged: { const: true },
  },
  ["acknowledged"],
);
const project = obj({
  schemaVersion: { const: 1 },
  id,
  revision: integer,
  title: str,
  units: { const: "LDU" },
  rootModelId: id,
  library: obj(
    {
      releaseId: id,
      manifestSha256: id,
      colorConfigSha256: id,
      connectorPackId: id,
      connectorPackSha256: id,
      // Complete official library pack used for parts outside the curated pack.
      full: obj(
        {
          releaseId: id,
          manifestSha256: id,
          connectorPackId: id,
          connectorPackSha256: id,
        },
        ["releaseId", "manifestSha256"],
      ),
    },
    ["releaseId", "manifestSha256", "colorConfigSha256"],
  ),
  marketplace: obj(
    {
      mappingPackId: id,
      mappingPackSha256: id,
      overrides: occurrenceDictionary(
        obj({
          itemId: id,
          colorId: id,
          acknowledged: { type: "boolean" },
          substitution: { type: "boolean" },
        }),
      ),
      // Part-level parts-list decisions ("official:3001.dat" → decision).
      partDecisions: {
        ...dictionary(partDecision),
        propertyNames: partKey,
      },
    },
    ["mappingPackId", "mappingPackSha256", "overrides"],
  ),
  models: dictionary(
    obj({
      id,
      name: id,
      nodes: arr(node),
      records: arr(obj({ id, raw: str, nodeId: id }, ["id", "raw"]), 1000000),
      classification: { enum: ["model", "custom"] },
    }),
  ),
  layers: dictionary(
    obj(
      {
        id,
        name: str,
        visible: { type: "boolean" },
        locked: { type: "boolean" },
        order: integer,
        parentFolderId: id,
      },
      ["id", "name", "visible", "locked", "order"],
    ),
  ),
  layerFolders: dictionary(
    obj({ id, name: str, order: integer, parentFolderId: id }, [
      "id",
      "name",
      "order",
    ]),
  ),
  defaultLayerId: id,
  layerAssignments: occurrenceDictionary(id),
  groups: dictionary(arr(occurrenceId)),
  instructionPlans: dictionary(
    obj(
      {
        name: str,
        presentation: { enum: ["pictorial"] },
        steps: arr(arr(occurrenceId)),
        stepMetadata: arr(
          obj(
            {
              notes: str,
              camera,
              contextCamera: camera,
              alternateCamera: camera,
              alternateBeforePlacement: { type: "boolean" },
              alternateDetailIds: {
                ...arr(occurrenceId, 64),
                minItems: 1,
                uniqueItems: true,
              },
              incomingCamera: camera,
              completedDetail: obj(
                {
                  occurrenceIds: {
                    type: "array",
                    items: { type: "string", minLength: 1 },
                    minItems: 1,
                    maxItems: 64,
                    uniqueItems: true,
                  },
                  camera,
                },
                ["occurrenceIds", "camera"],
              ),
              targets: arr(
                obj({ position: vec, label: str, occurrenceId, caption: str }, [
                  "position",
                  "label",
                ]),
                20,
              ),
              insertionChecks: arr(
                obj(
                  {
                    occurrenceIds: { ...arr(occurrenceId, 5000), minItems: 1 },
                    status: { enum: ["clear", "blocked", "unknown"] },
                    scope: { const: "cad-surface-translation" },
                    from: vec,
                    to: vec,
                    blockerIds: arr(occurrenceId, 16),
                    reason: str,
                  },
                  ["occurrenceIds", "status", "scope"],
                ),
                20,
              ),
              axisReference: obj({
                from: vec,
                to: vec,
                sourceRef: str,
                feasibility: { const: "unknown" },
              }),
              assembly: obj({
                type: { enum: ["build", "join"] },
                moduleId: id,
              }),
            },
            [],
          ),
        ),
        modules: dictionary(
          obj(
            {
              name: str,
              occurrenceIds: arr(occurrenceId, 5000),
              feasibility: { const: "unknown" },
              purpose: { enum: ["wheel", "joint", "source"] },
              parentModuleId: id,
              placement: { enum: ["attachment", "scene"] },
              hostIds: arr(occurrenceId, 16),
              receiver: obj({ position: vec, axis: vec }),
            },
            ["name", "occurrenceIds", "feasibility"],
          ),
        ),
        generation: obj(
          {
            algorithm: {
              enum: [
                "connected-bottom-up-v1",
                "connected-bottom-up-v2",
                "connected-bottom-up-v3",
                "connected-bottom-up-v4",
                "connected-bottom-up-v5",
                "connected-bottom-up-v6",
                "connected-bottom-up-v7",
                "connected-bottom-up-v8",
                "connected-bottom-up-v9",
                "connected-bottom-up-v10",
                "connected-bottom-up-v11",
                "connected-bottom-up-v12",
                "connected-bottom-up-v13",
                "connected-bottom-up-v14",
                "connected-bottom-up-v15",
                "connected-bottom-up-v16",
              ],
            },
            sourceRevision: integer,
            sourceGuidance: { const: "hierarchy-and-step-prior" },
            sourceCandidates: integer,
            maxPerStep: { type: "integer", minimum: 1, maximum: 20 },
            total: integer,
            connectorCovered: integer,
            boundsUnknown: integer,
            inferredSupportPairs: integer,
            unanchored: integer,
            lowVisibilitySteps: integer,
            insertionFingerprint: str,
            insertionPrecedences: integer,
            insertionConflicts: integer,
            insertionClear: integer,
            insertionBlocked: integer,
            insertionUnknown: integer,
            insertionTriangleTests: integer,
            insertionBudgetReached: { type: "boolean" },
            axialOperations: integer,
            axialMatchedBushes: integer,
            axialUnmatched: integer,
            axialConflicts: integer,
            displayOperations: integer,
            displayConflicts: integer,
            displaySceneCandidates: integer,
            figureOperations: integer,
            figureConflicts: integer,
            figureCandidates: integer,
            enclosureConstraints: integer,
            accessConflicts: integer,
            warnings: arr(str),
          },
          [
            "algorithm",
            "sourceRevision",
            "maxPerStep",
            "total",
            "connectorCovered",
            "boundsUnknown",
            "inferredSupportPairs",
            "unanchored",
            "lowVisibilitySteps",
            "warnings",
          ],
        ),
        refinement: obj(
          {
            mode: { const: "agent" },
            baselineAlgorithm: str,
            baselinePlanHash: str,
            baselineSourceHash: str,
            insertionFingerprint: str,
            retainedInsertionChecks: integer,
            unknownInsertionChecks: integer,
          },
          [
            "mode",
            "baselineAlgorithm",
            "baselinePlanHash",
            "baselineSourceHash",
            "retainedInsertionChecks",
            "unknownInsertionChecks",
          ],
        ),
      },
      ["name", "steps"],
    ),
  ),
  cameraBookmarks: dictionary(camera),
  architecture: obj({
    floors: arr(floorGuide, 64),
    labels: arr(roomLabel, 500),
    views: dictionary(floorFocus),
  }),
  scene: obj(
    {
      backdrop: { enum: [...BACKDROP_NAMES] },
      playHint: { type: "string", maxLength: PLAY_HINT_MAX_LENGTH },
    },
    [],
  ),
  motionRigs: dictionary({}),
  metadata: dictionary({}),
  assets: dictionary(str),
  diagnostics: arr(diagnostic),
});
project.required = project.required.filter(
  (key: string) =>
    key !== "layerFolders" && key !== "architecture" && key !== "scene",
);
const scoped = {
  occurrenceIds: { ...arr(occurrenceId), minItems: 1, uniqueItems: true },
  includeHidden: { type: "boolean" },
  activeLayerId: id,
};
const effort = (unit: string) =>
  obj({ value: { type: "number", minimum: 0 }, unit: { const: unit } });
const motor = (unit: string) =>
  obj({
    mode: { enum: ["position", "velocity"] },
    target: num,
    maxEffort: effort(unit),
  });
const jointBase = { id, bodyA: id, bodyB: id, anchorA: vec, anchorB: vec };
const mechanicalProposalRequest = obj(
  {
    id: {
      type: "string",
      minLength: 1,
      maxLength: 128,
      not: { enum: ["__proto__", "constructor", "prototype"] },
    },
    name: { type: "string", maxLength: 200 },
    expectedRevision: integer,
    frameOccurrenceIds: {
      ...arr(occurrenceId, 2048),
      minItems: 1,
      uniqueItems: true,
    },
    occurrenceIds: {
      ...arr(occurrenceId, 2048),
      minItems: 1,
      uniqueItems: true,
    },
    includeHidden: { type: "boolean" },
    motors: { ...occurrenceDictionary(motor("N*m")), maxProperties: 100 },
  },
  ["id", "name", "expectedRevision", "frameOccurrenceIds"],
);
const joint = {
  oneOf: [
    obj({ ...jointBase, kind: { enum: ["fixed", "spherical"] } }),
    ...["revolute", "prismatic"].map((kind) =>
      obj(
        {
          ...jointBase,
          kind: { const: kind },
          axisA: vec,
          axisB: vec,
          limits: { ...arr(num, 2), minItems: 2 },
          motor: motor(kind === "revolute" ? "N*m" : "N"),
        },
        [...Object.keys(jointBase), "kind", "axisA", "axisB"],
      ),
    ),
  ],
};
const motionRig = obj(
  {
    schemaVersion: { const: 1 },
    id,
    name: { type: "string", maxLength: 200 },
    mode: { const: "kinematic" },
    groups: {
      ...arr(
        obj({
          id,
          occurrenceIds: {
            ...arr(occurrenceId, 10000),
            minItems: 1,
            uniqueItems: true,
          },
          frame: transform,
          restTransforms: occurrenceDictionary(transform),
        }),
        100,
      ),
      minItems: 1,
    },
    joints: arr(joint, 100),
    transmissions: arr(
      {
        oneOf: [
          obj({
            id,
            kind: { const: "spur" },
            jointA: id,
            jointB: id,
            teethA: { type: "integer", minimum: 4, maximum: 256 },
            teethB: { type: "integer", minimum: 4, maximum: 256 },
            axisSign: { enum: [-1, 1] },
          }),
          obj({
            id,
            kind: { const: "rack" },
            jointA: id,
            jointB: id,
            pitchRadiusLdu: {
              type: "number",
              minimum: -10000,
              maximum: 10000,
              not: { exclusiveMinimum: -0.1, exclusiveMaximum: 0.1 },
            },
          }),
        ],
      },
      100,
    ),
    vehicle: obj(
      {
        chassisGroup: id,
        wheels: {
          ...arr(
            obj({
              groupId: id,
              axis: vec,
              radius: { type: "number", minimum: 0.1 },
              steering: { type: "boolean" },
            }),
            16,
          ),
          minItems: 2,
        },
        wheelbase: { type: "number", minimum: 1 },
        maxSteerDegrees: {
          type: "number",
          exclusiveMinimum: 0,
          exclusiveMaximum: 80,
        },
        maxSpeed: { type: "number", exclusiveMinimum: 0, maximum: 10000 },
        driverSeat: obj({
          id: {
            type: "string",
            minLength: 1,
            maxLength: 128,
            not: { enum: ["__proto__", "constructor", "prototype"] },
          },
          profile: { const: "brick-figure-open-seat-v1" },
          pelvisPosition: {
            ...arr({ type: "number", minimum: -10000, maximum: 10000 }, 3),
            minItems: 3,
          },
          yawDegrees: { type: "number", minimum: -360, maximum: 360 },
          accessPoint: {
            ...arr({ type: "number", minimum: -10000, maximum: 10000 }, 3),
            minItems: 3,
          },
          approachPosition: {
            ...arr({ type: "number", minimum: -10000, maximum: 10000 }, 3),
            minItems: 3,
          },
          exits: {
            ...arr(
              obj({
                position: {
                  ...arr(
                    { type: "number", minimum: -10000, maximum: 10000 },
                    3,
                  ),
                  minItems: 3,
                },
                yawDegrees: { type: "number", minimum: -360, maximum: 360 },
              }),
              4,
            ),
            minItems: 1,
          },
        }),
      },
      ["chassisGroup", "wheels", "wheelbase", "maxSteerDegrees", "maxSpeed"],
    ),
    dynamics: obj(
      {
        groups: {
          ...dictionary(
            obj(
              {
                massKg: { type: "number", minimum: 0.001, maximum: 100000 },
                anchored: { type: "boolean" },
              },
              [],
            ),
          ),
          maxProperties: 100,
        },
        friction: { type: "number", minimum: 0, maximum: 4 },
        suspension: obj({
          restLength: { type: "number", minimum: 0.5, maximum: 200 },
          travel: { type: "number", minimum: 0.5, maximum: 200 },
          stiffness: { type: "number", minimum: 1, maximum: 500 },
          damping: { type: "number", minimum: 0.05, maximum: 50 },
        }),
        engineForce: { type: "number", minimum: 0, maximum: 1000000 },
        startDynamic: { type: "boolean" },
      },
      [],
    ),
  },
  ["schemaVersion", "id", "name", "mode", "groups", "joints"],
);
const mechanismPose = obj(
  {
    jointPositions: dictionary(num),
    vehicle: obj({
      position: vec,
      headingDegrees: num,
      steeringDegrees: num,
      wheelAngles: dictionary(num),
    }),
  },
  ["jointPositions"],
);
const payloads: Record<string, any> = {
  "rigs.upsert": obj(
    {
      rig: { $ref: "motionRig" },
      includeHidden: { type: "boolean" },
      activeLayerId: id,
    },
    ["rig"],
  ),
  "rigs.remove": obj(
    { rigId: id, includeHidden: { type: "boolean" }, activeLayerId: id },
    ["rigId"],
  ),
  "rigs.applyPose": obj(
    {
      rigId: id,
      sourceRevision: integer,
      pose: { $ref: "mechanismPose" },
      includeHidden: { type: "boolean" },
    },
    ["rigId", "sourceRevision", "pose"],
  ),
  "project.rename": obj({ title: { type: "string", maxLength: 200 } }),
  "scene.set": {
    ...obj(
      {
        backdrop: { enum: [...BACKDROP_NAMES, null] },
        playHint: {
          type: ["string", "null"],
          maxLength: PLAY_HINT_MAX_LENGTH,
        },
      },
      [],
    ),
    minProperties: 1,
  },
  "parts.add": obj(
    {
      parts: {
        ...arr(
          obj({ ref: id, colorCode: id, transform }, ["ref", "colorCode"]),
          10000,
        ),
        minItems: 1,
      },
      layerId: id,
      maxAdditions: { ...integer, minimum: 1, maximum: 10000 },
    },
    ["parts"],
  ),
  "models.makeSubmodel": obj(
    {
      ...scoped,
      name: { type: "string", minLength: 1, maxLength: 200 },
      pivot: vec,
    },
    ["occurrenceIds", "name"],
  ),
  "models.makeUnique": obj(scoped, ["occurrenceIds"]),
  "models.editShared": {
    oneOf: [
      obj(
        {
          definitionId: id,
          nodeIds: { ...arr(id), minItems: 1, uniqueItems: true },
          confirmShared: { const: true },
          includeHidden: { type: "boolean" },
          activeLayerId: id,
          operation: { const: "recolor" },
          colorCode: {
            type: "string",
            pattern: "^(?:[0-9]+|0x2[0-9a-fA-F]{6})$",
          },
        },
        ["definitionId", "nodeIds", "confirmShared", "operation", "colorCode"],
      ),
      obj(
        {
          definitionId: id,
          nodeIds: { ...arr(id), minItems: 1, uniqueItems: true },
          confirmShared: { const: true },
          includeHidden: { type: "boolean" },
          activeLayerId: id,
          operation: { const: "move" },
          delta: vec,
        },
        ["definitionId", "nodeIds", "confirmShared", "operation", "delta"],
      ),
      obj(
        {
          definitionId: id,
          nodeIds: { ...arr(id), minItems: 1, uniqueItems: true },
          confirmShared: { const: true },
          includeHidden: { type: "boolean" },
          activeLayerId: id,
          operation: { const: "rotate" },
          axis: vec,
          degrees: { type: "number", minimum: -360000, maximum: 360000 },
          pivot: vec,
        },
        [
          "definitionId",
          "nodeIds",
          "confirmShared",
          "operation",
          "axis",
          "degrees",
          "pivot",
        ],
      ),
    ],
  },
  "parts.remove": obj(scoped, ["occurrenceIds"]),
  "parts.recolor": obj(
    { ...scoped, colorCode: id, preserveFixedColors: { const: true } },
    ["occurrenceIds", "colorCode"],
  ),
  "parts.transform": {
    ...obj({ ...scoped, delta: vec, transform, space: { const: "ldraw" } }, [
      "occurrenceIds",
    ]),
    oneOf: [
      { required: ["delta"], not: { required: ["transform"] } },
      { required: ["transform"], not: { required: ["delta"] } },
    ],
  },
  "parts.replace": obj({ ...scoped, ref: id, anchorOffset: vec }, [
    "occurrenceIds",
    "ref",
  ]),
  "parts.duplicate": obj({ ...scoped, delta: vec }, ["occurrenceIds"]),
  "clipboard.paste": obj(
    {
      fragment: obj({
        schemaVersion: { const: 1 },
        project: { $ref: "project" },
      }),
      delta: vec,
      layerId: id,
      maxAdditions: { type: "integer", minimum: 1, maximum: 10000 },
    },
    ["fragment"],
  ),
  "parts.array": {
    oneOf: [
      obj(
        {
          ...scoped,
          kind: { const: "linear" },
          count: { type: "integer", minimum: 1, maximum: 1000 },
          delta: vec,
          maxAdditions: { type: "integer", minimum: 1, maximum: 10000 },
        },
        ["occurrenceIds", "kind", "count", "delta"],
      ),
      obj(
        {
          ...scoped,
          kind: { const: "circular" },
          count: { type: "integer", minimum: 1, maximum: 1000 },
          center: vec,
          axis: vec,
          angleDegrees: { type: "number", minimum: -360, maximum: 360 },
          maxAdditions: { type: "integer", minimum: 1, maximum: 10000 },
        },
        ["occurrenceIds", "kind", "count", "center", "axis", "angleDegrees"],
      ),
    ],
  },
  "layers.duplicate": obj(
    {
      layerId: id,
      name: str,
      includeHidden: { type: "boolean" },
      maxAdditions: { type: "integer", minimum: 0, maximum: 10000 },
    },
    ["layerId"],
  ),
  "layers.folder": obj({
    layerId: id,
    parentFolderId: { anyOf: [id, { type: "null" }] },
  }),
  "folders.add": obj({ name: str, parentFolderId: id }, ["name"]),
  "folders.rename": obj({ folderId: id, name: str }),
  "folders.move": obj({
    folderId: id,
    parentFolderId: { anyOf: [id, { type: "null" }] },
  }),
  "folders.remove": obj({ folderId: id, mode: { const: "promote-children" } }),
  "layers.add": obj({ name: str }),
  "layers.update": obj(
    {
      layerId: id,
      name: str,
      visible: { type: "boolean" },
      locked: { type: "boolean" },
    },
    ["layerId"],
  ),
  "layers.rename": obj({ layerId: id, name: str }),
  "layers.reorder": obj({ layerIds: { ...arr(id), uniqueItems: true } }),
  "layers.remove": obj({
    layerId: id,
    mode: { enum: ["delete-contents", "reassign"] },
    destinationLayerId: id,
  }),
  "groups.create": obj({
    name: id,
    occurrenceIds: { ...arr(occurrenceId), uniqueItems: true },
  }),
  "camera.bookmark": obj(
    { name: id, camera, floorFocus: { anyOf: [floorFocus, { type: "null" }] } },
    ["name", "camera"],
  ),
  "camera.bookmark.focus": obj({
    name: id,
    floorFocus: { anyOf: [floorFocus, { type: "null" }] },
  }),
  "floors.set": obj({
    floors: arr(
      obj({ id, name: { type: "string", maxLength: 60 }, y: num }, [
        "name",
        "y",
      ]),
      64,
    ),
  }),
  "labels.add": obj(
    {
      id,
      text: { type: "string", maxLength: 80 },
      position: vec,
      floorId: { anyOf: [id, { type: "null" }] },
    },
    ["text", "position"],
  ),
  "labels.update": obj(
    {
      labelId: id,
      text: { type: "string", maxLength: 80 },
      position: vec,
      floorId: { anyOf: [id, { type: "null" }] },
    },
    ["labelId"],
  ),
  "labels.remove": obj({ labelId: id }),
  "layers.assign": obj({ ...scoped, layerId: id }, [
    "occurrenceIds",
    "layerId",
  ]),
  // One occurrence's explicit mapping, or (with `part`) the parts-list
  // decision for every occurrence of one part; null clears either.
  "inventory.override": {
    oneOf: [
      obj({
        occurrenceId,
        mapping: {
          oneOf: [
            { type: "null" },
            obj({
              itemId: id,
              colorId: { type: "string", pattern: "^[0-9]+$" },
              acknowledged: { const: true },
              substitution: { type: "boolean" },
            }),
          ],
        },
      }),
      obj({
        part: partKey,
        decision: { oneOf: [{ type: "null" }, partDecision] },
      }),
    ],
  },
  // Re-pin the complete official library to the current release (the
  // project's previous lock goes to metadata.previousLocks; undoable).
  "library.update": obj({
    expected: obj({ releaseId: id, manifestSha256: id }),
  }),
  "instructions.create": obj({ name: str, occurrenceIds: arr(occurrenceId) }, [
    "name",
  ]),
  "instructions.rename": obj({ planId: id, name: str }),
  "instructions.remove": obj({ planId: id }),
  "instructions.step.add": obj({ planId: id, index: integer }, ["planId"]),
  "instructions.step.remove": obj(
    {
      planId: id,
      index: integer,
      disposition: { enum: ["unassign", "move"] },
      targetIndex: integer,
    },
    ["planId", "index", "disposition"],
  ),
  "instructions.step.reorder": obj({ planId: id, indices: arr(integer) }),
  "instructions.step.assign": obj({
    planId: id,
    index: integer,
    occurrenceIds: arr(occurrenceId),
  }),
  "instructions.step.split": obj({
    planId: id,
    index: integer,
    occurrenceIds: arr(occurrenceId),
  }),
  "instructions.step.merge": obj({ planId: id, index: integer }),
  "instructions.step.update": obj(
    {
      planId: id,
      index: integer,
      notes: str,
      camera: { anyOf: [camera, { type: "null" }] },
    },
    ["planId", "index"],
  ),
  "instructions.generate": obj(
    {
      name: str,
      maxPerStep: { type: "integer", minimum: 1, maximum: 20 },
      useSourceSteps: { type: "boolean" },
    },
    [],
  ),
  "instructions.installGenerated": obj({
    plan: project.properties.instructionPlans.additionalProperties,
  }),
  "instructions.layers": obj(
    { name: str, maxPerStep: { type: "integer", minimum: 1, maximum: 1000 } },
    [],
  ),
  "history.undo": obj({}),
  "history.redo": obj({}),
};
const command = {
  oneOf: Object.entries(payloads).map(([type, payload]) =>
    obj(
      {
        schemaVersion: { const: 1 },
        commandId: id,
        expectedRevision: integer,
        type: { const: type },
        payload,
        dryRun: { type: "boolean" },
      },
      ["schemaVersion", "commandId", "expectedRevision", "type", "payload"],
    ),
  ),
};
const render = obj(
  {
    revision: integer,
    width: { type: "integer", minimum: 1, maximum: 16384 },
    height: { type: "integer", minimum: 1, maximum: 16384 },
    format: { const: "png" },
    visibility: {
      oneOf: [
        obj({ mode: { const: "all" } }),
        obj({ mode: { const: "current" } }),
        obj({ mode: { const: "layers" }, layerIds: arr(id) }),
        obj({
          mode: { const: "occurrences" },
          occurrenceIds: { ...arr(occurrenceId, 5000), uniqueItems: true },
        }),
      ],
    },
    background: {
      oneOf: [
        obj({ type: { const: "transparent" } }),
        obj({
          type: { const: "solid" },
          color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
        }),
      ],
    },
    quality: { enum: ["fast", "balanced", "photo"] },
    qualityControls: obj(
      {
        edges: { enum: ["none", "ordinary", "all"] },
        shadows: { enum: ["off", "soft"] },
        shadowMapSize: { enum: [512, 1024, 2048] },
        pixelRatioCap: { type: "number", minimum: 0.5, maximum: 3 },
        toneMapping: { enum: ["aces", "neutral"] },
        exposure: { type: "number", minimum: 0.1, maximum: 4 },
      },
      [],
    ),
    look: { enum: ["standard", "realistic", "photo"] },
    backdrop: { enum: [...BACKDROP_NAMES] },
    lookControls: obj(
      {
        environment: { enum: ["none", "room", "studio"] },
        materials: { enum: ["ldraw", "plastic"] },
        ambientOcclusion: { enum: ["off", "gtao"] },
        edges: { enum: ["quality", "hidden", "soft"] },
        shadows: { enum: ["quality", "soft"] },
        ground: { enum: ["grid", "shadow"] },
        samples: { type: "integer", minimum: 1, maximum: 64 },
        vignette: { type: "number", minimum: 0, maximum: 0.5 },
        toneMapping: { enum: ["quality", "neutral", "agx"] },
        exposureScale: { type: "number", minimum: 0.25, maximum: 4 },
        renderer: { enum: ["raster", "path"] },
        pathSamples: { type: "integer", minimum: 1, maximum: 4096 },
        depthOfField: { type: "number", minimum: 0, maximum: 1 },
        backdrop: { enum: ["none", "studio", "floor"] },
        grade: { enum: ["none", "film"] },
      },
      [],
    ),
    instructionNewIds: { ...arr(occurrenceId, 5000), uniqueItems: true },
    strict: { type: "boolean" },
  },
  [
    "revision",
    "width",
    "height",
    "format",
    "visibility",
    "background",
    "quality",
  ],
);

const inventory = obj(
  {
    expectedRevision: integer,
    format: { const: "bricklink-wanted-xml" },
    scope,
    buildMultiplier: { ...integer, minimum: 1 },
    condition: { enum: ["any", "new", "used"] },
    wantedListId: { type: "string", pattern: "^[0-9]+$" },
    remarks: { type: "string", maxLength: 1000 },
    excludeAuthoredFigures: { type: "boolean" },
    errorPolicy: { enum: ["block", "export-resolved"] },
    acceptUnknownColors: { type: "boolean" },
    acceptDerivedMappings: { type: "boolean" },
  },
  ["expectedRevision", "format", "scope"],
);
const inventoryExport = obj({
  previewId: id,
  expectedRevision: integer,
  expectedMappingPackSha256: id,
  errorPolicy: { enum: ["block", "export-resolved"] },
});
const importRequest = {
  oneOf: [
    obj(
      {
        format: { const: "ldraw" },
        text: { type: "string", maxLength: 26214400 },
        name: id,
        strict: { type: "boolean" },
      },
      ["format", "text"],
    ),
    obj(
      {
        format: { const: "native" },
        bytes: arr({ type: "integer", minimum: 0, maximum: 255 }, 26214400),
        strict: { type: "boolean" },
      },
      ["format", "bytes"],
    ),
    obj(
      {
        format: { const: "template" },
        template: {
          description:
            `Sample builds (offered in the chooser): ${SAMPLE_TEMPLATES.join(", ")}. ` +
            `Test fixtures (not in the chooser; kept for automation and tests): ${FIXTURE_TEMPLATES.join(", ")}.`,
          enum: [...TEMPLATE_NAMES],
        },
      },
      ["format", "template"],
    ),
  ],
};
const exportRequest = {
  oneOf: [
    obj({ format: { const: "native" } }),
    obj({ format: { const: "ldraw" }, scope }, ["format"]),
  ],
};
const query = obj(
  {
    ref: id,
    colorCode: id,
    layerId: id,
    occurrenceIds: arr(occurrenceId),
    scope,
    selection: { type: "boolean" },
    connectivity: { enum: ["unverified", "verified"] },
    spatial: { type: "boolean" },
    intersectingCandidates: { type: "boolean" },
    bounds: obj({
      min: vec,
      max: vec,
      mode: { enum: ["intersects", "contained"] },
    }),
  },
  [],
);
const colorExistence = [
  "verified",
  "derived",
  "not-produced",
  "not-recorded",
  "unknown",
];
const mappingTiers = [
  "verified",
  "reviewed",
  "derived",
  "ambiguous",
  "unmapped",
  "custom",
];
const inventoryPreview = obj({
  previewId: id,
  documentRevision: integer,
  mappingPackSha256: id,
  projectHash: id,
  sourceOccurrenceCount: integer,
  resolvedPhysicalUnitCount: integer,
  lotCount: integer,
  canExportComplete: { type: "boolean" },
  rows: arr(
    obj({
      itemId: id,
      colorId: id,
      quantity: { ...integer, minimum: 1 },
      occurrenceIds: arr(occurrenceId),
      layers: dictionary(integer),
      verification: { enum: ["verified", "acknowledged"] },
      colorExistence: { enum: colorExistence },
    }),
  ),
  resolution: arr(
    obj(
      {
        part: partKey,
        ref: id,
        namespace: { enum: ["official", "project", "missing"] },
        colorCode: id,
        colorId: id,
        quantity: integer,
        occurrenceIds: arr(occurrenceId),
        tier: { enum: mappingTiers },
        mapping: { enum: [...mappingTiers, "user", "override", "excluded"] },
        itemId: id,
        suggestedItemId: id,
        candidates: arr(id, 100),
        origin: { enum: ["candidate", "derived", "reviewed", "user"] },
        colorExistence: { enum: colorExistence },
        colorAccepted: { type: "boolean" },
        status: { enum: ["ready", "accepted", "needs-attention", "excluded"] },
        problems: arr(id, 100),
      },
      [
        "part",
        "ref",
        "namespace",
        "colorCode",
        "quantity",
        "occurrenceIds",
        "tier",
        "mapping",
        "colorExistence",
        "colorAccepted",
        "status",
        "problems",
      ],
    ),
  ),
  diagnostics: arr(diagnostic),
  excludedOccurrenceIds: arr(occurrenceId),
  substitutions: arr(occurrenceId),
  request: { $ref: "inventory" },
});
const playCameraSettings = obj({
  eyeHeight: { type: "number", minimum: 16, maximum: 100 },
  fovDeg: { type: "number", minimum: 30, maximum: 100 },
  near: { type: "number", minimum: 0.05, maximum: 2 },
  followDistance: { type: "number", minimum: 24, maximum: 400 },
  minPitch: { type: "number", minimum: -1.48, maximum: 0 },
  maxPitch: { type: "number", minimum: 0, maximum: 1.48 },
});
const playSpawn = obj({ position: vec, yaw: num, pitch: num }, ["position"]);
const playWorldProfile = obj({
  excludedLayerIds: { ...arr(id, 10000), uniqueItems: true },
});
const playRequest = obj(
  {
    worldProfile: playWorldProfile,
    cameraSettings: { ...playCameraSettings, required: [] },
    rigId: id,
    rigIds: { ...arr(id, 32), uniqueItems: true },
    dynamicRigIds: { ...arr(id, 14), uniqueItems: true },
    autoDoors: { type: "boolean" },
    trains: { type: "boolean" },
    locomotion: { enum: ["walk", "fly-noclip"] },
    cameraMode: { enum: ["first-person", "third-person"] },
    position: vec,
    yaw: num,
    pitch: num,
    ground: { type: "boolean" },
    realtime: { type: "boolean" },
  },
  [],
);
Object.assign(playRequest, { not: { required: ["rigId", "rigIds"] } });
const playInput = obj(
  {
    moveX: { type: "number", minimum: -1, maximum: 1 },
    moveZ: { type: "number", minimum: -1, maximum: 1 },
    vertical: { type: "number", minimum: -1, maximum: 1 },
    run: { type: "boolean" },
    jump: { type: "boolean" },
    yaw: num,
    pitch: num,
  },
  [],
);
const playTeleport = obj(
  {
    position: vec,
    policy: { enum: ["safe", "free-flight"] },
    yaw: num,
    pitch: num,
  },
  ["position"],
);
const playJointTarget = obj(
  {
    rigId: id,
    jointId: id,
    target: num,
    speed: { type: "number", minimum: 0.001, maximum: 10000 },
  },
  ["jointId", "target", "speed"],
);
const playJointTargetReport = obj(
  {
    current: num,
    target: num,
    speed: num,
    status: { enum: ["moving", "blocked", "complete"] },
    units: { enum: ["degrees", "LDU"] },
    speedUnits: { enum: ["degrees/s", "LDU/s"] },
    blockedReason: str,
  },
  ["current", "target", "speed", "status", "units", "speedUnits"],
);
const playMotorRequest = obj(
  {
    rigId: id,
    jointId: id,
    enabled: { type: "boolean" },
    input: { type: "number", minimum: -1, maximum: 1 },
  },
  ["jointId", "enabled"],
);
const playMotorReport = obj(
  {
    mode: { enum: ["position", "velocity"] },
    target: num,
    enabled: { type: "boolean" },
    status: { enum: ["running", "holding", "blocked", "at-limit", "stopped"] },
    units: { enum: ["degrees", "LDU"] },
    targetUnits: { enum: ["degrees", "LDU", "degrees/s", "LDU/s"] },
    simulation: { enum: ["kinematic-rate", "dynamic-motor"] },
    blockedReason: str,
    input: { type: "number", minimum: -1, maximum: 1 },
  },
  ["mode", "target", "enabled", "status", "units", "targetUnits", "simulation"],
);
const playDynamicsReport = obj(
  {
    engine: str,
    gravity: num,
    bodies: dictionary(
      obj({
        anchored: { type: "boolean" },
        massKg: num,
        colliders: integer,
        sleeping: { type: "boolean" },
        linearVelocity: vec,
        angularSpeed: num,
      }),
    ),
    wheels: dictionary(
      obj({
        contact: { type: "boolean" },
        suspensionLength: num,
        steeringDegrees: num,
        rotationDegrees: num,
      }),
    ),
    speed: num,
  },
  ["engine", "gravity", "bodies"],
);
const playSeatRequest = obj({ rigId: id, seatId: id });
const playSeatExit = obj(
  { exitIndex: { type: "integer", minimum: 0, maximum: 3 } },
  [],
);
const playSnapshot = obj({
  worldProfile: obj({
    ...playWorldProfile.properties,
    includedOccurrenceIds: { ...arr(occurrenceId), uniqueItems: true },
  }),
  cameraSettings: playCameraSettings,
  cameraSafety: obj({
    aspectRatio: num,
    effectiveNear: num,
    collisionRadius: num,
  }),
  sourceRevision: integer,
  tick: integer,
  position: vec,
  positionAnchor: { enum: ["standing-feet", "seated-avatar-root"] },
  velocity: vec,
  yaw: {
    ...num,
    description:
      "Look yaw (radians): the first-person view, or the third-person orbit camera's bearing. Independent of the figure's body yaw (avatar.heading).",
  },
  pitch: num,
  grounded: { type: "boolean" },
  locomotion: { enum: ["walk", "fly-noclip"] },
  cameraMode: { enum: ["first-person", "third-person"] },
  collisionReady: { type: "boolean" },
  avatarReady: { type: "boolean" },
  avatarVisible: { type: "boolean" },
  profile: obj({
    id,
    radius: num,
    height: num,
    eyeHeight: num,
    stepHeight: num,
    maxSlopeDegrees: num,
    walkSpeed: num,
    runSpeed: num,
    flySpeed: num,
    jumpSpeed: num,
    gravity: num,
    strideLength: num,
    scaleMetresPerLdu: num,
  }),
  units: { const: "LDU" },
  simulationHz: { const: 60 },
  warnings: arr(str),
  avatar: obj({
    state: { enum: ["idle", "walk", "run", "jump", "fall", "fly", "seated"] },
    heading: {
      ...num,
      description:
        "Body yaw (radians). Third person: faces the movement and holds still while the camera orbits.",
    },
    phase: num,
    swing: num,
    headYaw: num,
    headPitch: num,
    bob: num,
    leftHip: num,
    rightHip: num,
    leftShoulder: num,
    rightShoulder: num,
    leftWrist: num,
    rightWrist: num,
  }),
});
playSnapshot.properties.occupancy = obj({
  rigId: id,
  seatId: id,
  profile: { const: "brick-figure-open-seat-v1" },
  pelvisWorldLdu: vec,
  avatarRootWorldLdu: vec,
  effectiveEyeWorldLdu: vec,
  localLookYaw: num,
  localLookPitch: num,
});
playSnapshot.properties.autoDoors = obj({
  doors: arr(
    obj({
      rigId: id,
      jointId: id,
      occurrenceId,
      part: id,
      anchorOccurrenceId: occurrenceId,
      pivot: vec,
      axis: vec,
      leaf: vec,
      swing: { enum: ["both", "positive", "negative", "blocked"] },
    }),
    1000,
  ),
  skipped: arr(obj({ occurrenceId, part: id, reason: str })),
});
const trackEnd = obj({ occurrenceId, end: integer });
playSnapshot.properties.trains = obj(
  {
    trains: arr(
      obj(
        {
          id,
          name: str,
          cars: arr(
            obj({
              id,
              locomotive: { type: "boolean" },
              parts: integer,
              bogies: integer,
            }),
            64,
          ),
          throttle: { type: "number", minimum: -1, maximum: 1 },
          speed: num,
          status: {
            enum: ["stopped", "running", "end-of-track", "blocked", "waiting"],
          },
          reason: str,
          odometer: num,
          position: vec,
          heading: vec,
          pieces: arr(occurrenceId, 10000),
        },
        [
          "id",
          "name",
          "cars",
          "throttle",
          "speed",
          "status",
          "odometer",
          "position",
          "heading",
          "pieces",
        ],
      ),
      16,
    ),
    track: obj({
      pieces: integer,
      gaps: arr(obj({ a: trackEnd, b: trackEnd, distance: num, angle: num })),
      deadEnds: integer,
      skipped: arr(obj({ occurrenceId, part: id, reason: str })),
    }),
    switches: arr(
      obj(
        {
          occurrenceId,
          part: id,
          route: { enum: ["straight", "branch"] },
          occupied: { type: "boolean" },
          trailed: { type: "boolean" },
          position: vec,
        },
        ["occurrenceId", "part", "route", "occupied", "position"],
      ),
      10000,
    ),
    skipped: arr(obj({ occurrenceIds: arr(occurrenceId), reason: str })),
    tick: integer,
    riding: id,
  },
  ["trains", "track", "switches", "skipped", "tick"],
);
const playTrainThrottle = obj(
  { trainId: id, throttle: { type: "number", minimum: -1, maximum: 1 } },
  ["throttle"],
);
const playTrainSelect = obj({ trainId: id }, []);
const playTrainRide = obj({ trainId: { anyOf: [id, { type: "null" }] } }, []);
const playPoints = obj(
  { occurrenceId, route: { enum: ["straight", "branch"] } },
  ["occurrenceId"],
);
playSnapshot.properties.spawn = {
  ...playSpawn,
  required: ["position", "yaw", "pitch"],
};
playSnapshot.properties.mechanism = obj(
  {
    sourceRevision: integer,
    rigId: id,
    tick: integer,
    simulationHz: { const: 60 },
    mode: { enum: ["kinematic", "dynamic"] },
    units: { const: "LDU" },
    scaleMetresPerLdu: num,
    pose: mechanismPose,
    motors: dictionary(playMotorReport),
    dynamics: playDynamicsReport,
    groupFrames: dictionary(transform),
    transforms: dictionary(transform),
    warnings: arr(str),
    blocked: { type: "boolean" },
    jointTargets: dictionary(playJointTargetReport),
    vehicleCollision: obj(
      {
        profile: { const: "source-boxes-v1" },
        units: { const: "metres" },
        supported: { type: "boolean" },
        status: { enum: ["ready", "blocked", "unsupported"] },
        reason: str,
        obstacle: obj({
          sourceId: { type: "string", maxLength: 12295 },
          triangleIndex: integer,
        }),
      },
      ["profile", "units", "supported", "status"],
    ),
    blockedReason: str,
  },
  [
    "sourceRevision",
    "rigId",
    "tick",
    "simulationHz",
    "mode",
    "units",
    "scaleMetresPerLdu",
    "pose",
    "groupFrames",
    "transforms",
    "warnings",
    "blocked",
  ],
);
playSnapshot.properties.mechanisms = {
  ...dictionary(playSnapshot.properties.mechanism),
  maxProperties: 32,
};
const exportProfileRequest = obj(
  {
    profile: { enum: ["standard", "portable", "layers", "native"] },
    scope,
    expectedRevision: integer,
    includeCompleteModel: { type: "boolean" },
    includeOfficial: { type: "boolean" },
    acknowledgeScopedMetadata: { type: "boolean" },
  },
  ["profile", "scope"],
);
const api = {
  oneOf: Object.entries({
    "play.enter": { $ref: "playRequest" },
    "play.configureCamera": { ...playCameraSettings, required: [] },
    "play.chooseSpawn": playSpawn,
    "play.useSpawn": obj({}),
    "play.setInput": { $ref: "playInput" },
    "play.setJointTarget": { $ref: "playJointTarget" },
    "play.setMotor": { $ref: "playMotorRequest" },
    "play.setTrainThrottle": { $ref: "playTrainThrottle" },
    "play.stopTrain": { $ref: "playTrainSelect" },
    "play.setPoints": { $ref: "playPoints" },
    "play.rideTrain": { $ref: "playTrainRide" },
    "play.exportPosedModel": obj({}),
    "play.setMechanismJoint": obj({ jointId: id, value: num, rigId: id }, [
      "jointId",
      "value",
    ]),
    "play.setMechanismVehicleInput": obj(
      {
        throttle: { type: "number", minimum: -1, maximum: 1 },
        steering: { type: "number", minimum: -1, maximum: 1 },
        rigId: id,
      },
      ["throttle", "steering"],
    ),
    "play.enterVehicle": { $ref: "playSeatRequest" },
    "play.exitVehicle": { $ref: "playSeatExit" },
    "play.vehicleSeatEligibility": { $ref: "playSeatRequest" },
    "play.teleport": { $ref: "playTeleport" },
    "play.stepTicks": { type: "integer", minimum: 0, maximum: 3600 },
    "play.setCameraMode": { enum: ["first-person", "third-person"] },
    "play.setLocomotion": { enum: ["walk", "fly-noclip"] },
    "play.pause": { type: "boolean" },
    "play.snapshot": obj({}),
    "play.view": obj({}),
    "play.exit": obj({}),
    "clipboard.copy": obj(
      { occurrenceIds: arr(occurrenceId), includeHidden: { type: "boolean" } },
      ["occurrenceIds"],
    ),
    "clipboard.cut": obj(
      {
        occurrenceIds: arr(occurrenceId),
        includeHidden: { type: "boolean" },
        expectedRevision: integer,
        commandId: id,
      },
      ["occurrenceIds", "expectedRevision", "commandId"],
    ),
    "instructions.publish": obj(
      {
        planId: id,
        format: { enum: ["pdf", "png-zip", "html-zip"] },
        dimPrevious: { type: "boolean" },
        width: { type: "integer", minimum: 64, maximum: 16384 },
        height: { type: "integer", minimum: 64, maximum: 16384 },
      },
      ["planId", "format"],
    ),
    "mechanisms.enter": id,
    "mechanisms.propose": { $ref: "mechanicalProposalRequest" },
    "mechanisms.setJointPosition": obj({ jointId: id, value: num }),
    "mechanisms.setVehicleInput": obj(
      {
        throttle: { type: "number", minimum: -1, maximum: 1 },
        steering: { type: "number", minimum: -1, maximum: 1 },
        rigId: id,
      },
      ["throttle", "steering"],
    ),
    "mechanisms.stepTicks": { type: "integer", minimum: 0, maximum: 3600 },
    "mechanisms.snapshot": obj({}),
    "mechanisms.applyPose": obj({}),
    "mechanisms.exit": obj({}),
    "fill.preview": { $ref: "fillRequest" },
    "fill.startPreview": { $ref: "fillRequest" },
    "camera.fit": obj({}),
    "render.quality.get": obj({}),
    "render.quality.set": obj(
      {
        name: render.properties.quality,
        controls: render.properties.qualityControls,
      },
      ["name"],
    ),
    "render.look.get": obj({}),
    "render.look.set": obj(
      {
        name: render.properties.look,
        controls: render.properties.lookControls,
      },
      ["name"],
    ),
    "render.backdrop.get": obj({}),
    "render.backdrop.set": {
      ...obj(
        { name: render.properties.backdrop, grid: { type: "boolean" } },
        [],
      ),
      minProperties: 1,
    },
    "project.status": obj({}),
    "project.import": { $ref: "importRequest" },
    "project.export": { $ref: "exportRequest" },
    "project.exportProfile": { $ref: "exportProfileRequest" },
    query: { $ref: "query" },
    dispatch: { $ref: "command" },
    "camera.set": { $ref: "camera" },
    "render.image": { $ref: "render" },
    "inventory.preview": { $ref: "inventory" },
    "inventory.export": { $ref: "inventoryExport" },
    "library.updateStatus": obj({}),
    "library.update": obj(
      {
        expectedRevision: integer,
        checkpoint: { type: "boolean" },
      },
      ["expectedRevision"],
    ),
    ready: obj({ minRevision: integer, strict: { type: "boolean" } }, []),
    capabilities: obj({}),
    "jobs.status": obj({ id }),
    "jobs.cancel": obj({ id }),
    "jobs.wait": obj({ id }),
    "jobs.list": obj({}),
    // Build scripts: schemas/buildScript.v1.json describes `script`.
    "buildScript.validate": { type: "object" },
    "buildScript.compile": obj(
      {
        script: { type: "object" },
        check: { type: "boolean" },
        includeLDraw: { type: "boolean" },
        targetParts: { type: "integer", minimum: 1 },
      },
      ["script"],
    ),
    "buildScript.apply": obj(
      {
        script: { type: "object" },
        dryRun: { type: "boolean" },
        expectedRevision: integer,
        check: { type: "boolean" },
        targetParts: { type: "integer", minimum: 1 },
      },
      ["script"],
    ),
    "parts.search": obj(
      {
        query: str,
        category: str,
        size: obj(
          {
            w: { type: "integer", minimum: 1 },
            d: { type: "integer", minimum: 1 },
            h: { type: "integer", minimum: 0 },
          },
          [],
        ),
        colour: { anyOf: [str, { type: "integer", minimum: 0 }] },
        availableInColour: { type: "boolean" },
        connectable: { type: "boolean" },
        scope: { enum: ["all", "curated"] },
        limit: { type: "integer", minimum: 1, maximum: 200 },
      },
      [],
    ),
  }).map(([method, input]) =>
    obj({ apiVersion: { const: "1.0" }, method: { const: method }, input }),
  ),
};
const fillRequest = {
  ...obj(
    {
      ref: id,
      allowedRefs: { ...arr(id, 32), minItems: 1, uniqueItems: true },
      orientations: {
        ...arr({ type: "integer", enum: [0, 90, 180, 270] }, 4),
        minItems: 1,
        uniqueItems: true,
      },
      mask: arr({ type: "boolean" }, 10000),
      colorCode: { type: "string", pattern: "^(?:[0-9]+|0x2[0-9a-fA-F]{6})$" },
      columns: { type: "integer", minimum: 1, maximum: 10000 },
      rows: { type: "integer", minimum: 1, maximum: 10000 },
      origin: vec,
      basis,
      layerId: id,
      maxAdditions: { type: "integer", minimum: 1, maximum: 10000 },
    },
    ["colorCode", "columns", "rows", "origin", "layerId", "maxAdditions"],
  ),
  oneOf: [
    {
      required: ["ref"],
      not: {
        anyOf: [
          { required: ["allowedRefs"] },
          { required: ["orientations"] },
          { required: ["mask"] },
        ],
      },
    },
    { required: ["allowedRefs"], not: { required: ["ref"] } },
  ],
};
const schemas = {
  fillRequest,
  motionRig,
  mechanicalProposalRequest,
  mechanismPose,
  playRequest,
  playInput,
  playJointTarget,
  playMotorRequest,
  playTrainThrottle,
  playTrainSelect,
  playTrainRide,
  playPoints,
  playTeleport,
  playSeatRequest,
  playSeatExit,
  playSnapshot,
  api,
  importRequest,
  exportRequest,
  exportProfileRequest,
  query,
  inventoryPreview,
  project,
  command,
  camera,
  render,
  inventory,
  inventoryExport,
  diagnostic,
};
const ajv = new Ajv({
  allErrors: true,
  code: {
    source: true,
    esm: true,
    formats: new _Code(`(() => {
    const NODE_ID_MAX_CODEPOINTS = ${NODE_ID_MAX_CODEPOINTS};
    const OCCURRENCE_PATH_MAX_DEPTH = ${OCCURRENCE_PATH_MAX_DEPTH};
    const OCCURRENCE_ID_MAX_LENGTH = ${OCCURRENCE_ID_MAX_LENGTH};
    return {"occurrence-id": ${isOccurrenceId.toString()}};
  })()`),
  },
  strictNumbers: true,
  strictRequired: false,
});
ajv.addFormat("occurrence-id", isOccurrenceId);
for (const [name, s] of Object.entries(schemas)) {
  const schema = {
    $id: name,
    $schema: "http://json-schema.org/draft-07/schema#",
    ...s,
  };
  writeFileSync(
    `schemas/${name}.v1.json`,
    JSON.stringify(schema, null, 2) + "\n",
  );
  ajv.addSchema(schema, name);
}
// The build script language's schema is generated from its own tables
// (src/build-script/spec.ts, which also validates at run time).
writeFileSync(
  "schemas/buildScript.v1.json",
  JSON.stringify(
    {
      $id: "buildScript",
      $schema: "http://json-schema.org/draft-07/schema#",
      ...buildScriptJsonSchema(),
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  "src/core/validators.js",
  standaloneCode(
    ajv,
    Object.fromEntries(Object.keys(schemas).map((k) => [k, k])),
  ).replace(
    /const (func\d+) = require\("ajv\/dist\/runtime\/ucs2length"\).default;/g,
    "const $1 = (s) => [...s].length;",
  ),
);
// Keep the compiler on a small typed boundary. Inferring the generated AJV
// implementation can exhaust contextual typing across an otherwise valid TS
// program once this standalone module grows beyond a megabyte.
writeFileSync(
  "src/core/validators.d.ts",
  "export type Validator = ((data: unknown) => boolean) & { errors?: unknown };\n" +
    Object.keys(schemas)
      .map((name) => `export declare const ${name}: Validator;`)
      .join("\n") +
    "\n",
);

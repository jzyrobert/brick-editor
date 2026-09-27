import Ajv from "ajv";
import standaloneCode from "ajv/dist/standalone/index.js";
import { writeFileSync } from "node:fs";
const str = { type: "string", maxLength: 4096 },
  num = { type: "number" },
  id = { type: "string", minLength: 1, maxLength: 1024 },
  integer = { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER };
const obj = (
  properties: any,
  required = Object.keys(properties),
  extra = false,
) => ({ type: "object", properties, required, additionalProperties: extra });
const arr = (items: any, maxItems = 100000) => ({
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
const diagnostic = obj(
  {
    code: id,
    message: str,
    severity: { enum: ["warning", "error"] },
    occurrenceIds: arr(id),
    details: {},
  },
  ["code", "message", "severity", "occurrenceIds"],
);
const scope = {
  oneOf: [
    obj({ kind: { const: "all" } }),
    obj({ kind: { const: "visible" } }),
    obj({ kind: { const: "layers" }, layerIds: arr(id) }),
    obj({ kind: { const: "selection" }, occurrenceIds: arr(id) }),
    obj({ kind: { const: "submodel" }, occurrenceId: id }),
  ],
};
const project = obj({
  schemaVersion: { const: 1 },
  id,
  revision: integer,
  title: str,
  units: { const: "LDU" },
  rootModelId: id,
  library: obj({ releaseId: id, manifestSha256: id, colorConfigSha256: id }),
  marketplace: obj({
    mappingPackId: id,
    mappingPackSha256: id,
    overrides: dictionary(
      obj({
        itemId: id,
        colorId: id,
        acknowledged: { type: "boolean" },
        substitution: { type: "boolean" },
      }),
    ),
  }),
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
  layerAssignments: dictionary(id),
  groups: dictionary(arr(id)),
  instructionPlans: dictionary(
    obj(
      {
        name: str,
        steps: arr(arr(id)),
        stepMetadata: arr(obj({ notes: str, camera }, [])),
      },
      ["name", "steps"],
    ),
  ),
  cameraBookmarks: dictionary(camera),
  motionRigs: dictionary({}),
  metadata: dictionary({}),
  assets: dictionary(str),
  diagnostics: arr(diagnostic),
});
project.required = project.required.filter(
  (key: string) => key !== "layerFolders",
);
const scoped = {
  occurrenceIds: { ...arr(id), minItems: 1, uniqueItems: true },
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
          occurrenceIds: { ...arr(id, 10000), minItems: 1, uniqueItems: true },
          frame: transform,
          restTransforms: dictionary(transform),
        }),
        100,
      ),
      minItems: 1,
    },
    joints: arr(joint, 100),
    vehicle: obj({
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
    }),
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
    { rig: { $ref: "motionRig" }, includeHidden: { type: "boolean" } },
    ["rig"],
  ),
  "rigs.remove": obj({ rigId: id }),
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
  "parts.replace": obj({ ...scoped, ref: id }, ["occurrenceIds", "ref"]),
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
    occurrenceIds: { ...arr(id), uniqueItems: true },
  }),
  "camera.bookmark": obj({ name: id, camera }),
  "layers.assign": obj({ ...scoped, layerId: id }, [
    "occurrenceIds",
    "layerId",
  ]),
  "inventory.override": obj({
    occurrenceId: id,
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
  "instructions.create": obj({ name: str, occurrenceIds: arr(id) }, ["name"]),
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
    occurrenceIds: arr(id),
  }),
  "instructions.step.split": obj({
    planId: id,
    index: integer,
    occurrenceIds: arr(id),
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
          occurrenceIds: { ...arr(id, 5000), uniqueItems: true },
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
          enum: ["blank", "room", "wall", "200", "explore", "mechanisms"],
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
  { ref: id, colorCode: id, layerId: id, occurrenceIds: arr(id) },
  [],
);
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
      occurrenceIds: arr(id),
      layers: dictionary(integer),
      verification: { enum: ["verified", "acknowledged"] },
    }),
  ),
  diagnostics: arr(diagnostic),
  excludedOccurrenceIds: arr(id),
  substitutions: arr(id),
  request: { $ref: "inventory" },
});
const playCameraSettings = obj({
  eyeHeight: { type: "number", minimum: 16, maximum: 64 },
  fovDeg: { type: "number", minimum: 30, maximum: 100 },
  near: { type: "number", minimum: 0.05, maximum: 2 },
  followDistance: { type: "number", minimum: 24, maximum: 400 },
  minPitch: { type: "number", minimum: -1.48, maximum: 0 },
  maxPitch: { type: "number", minimum: 0, maximum: 1.48 },
});
const playSpawn = obj({ position: vec, yaw: num, pitch: num }, ["position"]);
const playRequest = obj(
  {
    cameraSettings: { ...playCameraSettings, required: [] },
    rigId: id,
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
const playSnapshot = obj({
  cameraSettings: playCameraSettings,
  cameraSafety: obj({
    aspectRatio: num,
    effectiveNear: num,
    collisionRadius: num,
  }),
  sourceRevision: integer,
  tick: integer,
  position: vec,
  velocity: vec,
  yaw: num,
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
    state: { enum: ["idle", "walk", "run", "jump", "fall"] },
    heading: num,
    phase: num,
    headYaw: num,
    leftHip: num,
    rightHip: num,
    leftShoulder: num,
    rightShoulder: num,
  }),
});
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
    mode: { const: "kinematic" },
    units: { const: "LDU" },
    scaleMetresPerLdu: num,
    pose: mechanismPose,
    groupFrames: dictionary(transform),
    transforms: dictionary(transform),
    warnings: arr(str),
    blocked: { type: "boolean" },
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
    "play.setMechanismJoint": obj({ jointId: id, value: num }),
    "play.setMechanismVehicleInput": obj({
      throttle: { type: "number", minimum: -1, maximum: 1 },
      steering: { type: "number", minimum: -1, maximum: 1 },
    }),
    "play.teleport": { $ref: "playTeleport" },
    "play.stepTicks": { type: "integer", minimum: 0, maximum: 3600 },
    "play.setCameraMode": { enum: ["first-person", "third-person"] },
    "play.setLocomotion": { enum: ["walk", "fly-noclip"] },
    "play.pause": { type: "boolean" },
    "play.snapshot": obj({}),
    "play.exit": obj({}),
    "clipboard.copy": obj(
      { occurrenceIds: arr(id), includeHidden: { type: "boolean" } },
      ["occurrenceIds"],
    ),
    "clipboard.cut": obj(
      {
        occurrenceIds: arr(id),
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
        width: { type: "integer", minimum: 64, maximum: 16384 },
        height: { type: "integer", minimum: 64, maximum: 16384 },
      },
      ["planId", "format"],
    ),
    "mechanisms.enter": id,
    "mechanisms.setJointPosition": obj({ jointId: id, value: num }),
    "mechanisms.setVehicleInput": obj({
      throttle: { type: "number", minimum: -1, maximum: 1 },
      steering: { type: "number", minimum: -1, maximum: 1 },
    }),
    "mechanisms.stepTicks": { type: "integer", minimum: 0, maximum: 3600 },
    "mechanisms.snapshot": obj({}),
    "mechanisms.applyPose": obj({}),
    "mechanisms.exit": obj({}),
    "camera.fit": obj({}),
    "render.quality.get": obj({}),
    "render.quality.set": obj(
      {
        name: render.properties.quality,
        controls: render.properties.qualityControls,
      },
      ["name"],
    ),
    "project.import": { $ref: "importRequest" },
    "project.export": { $ref: "exportRequest" },
    "project.exportProfile": { $ref: "exportProfileRequest" },
    query: { $ref: "query" },
    dispatch: { $ref: "command" },
    "camera.set": { $ref: "camera" },
    "render.image": { $ref: "render" },
    "inventory.preview": { $ref: "inventory" },
    "inventory.export": { $ref: "inventoryExport" },
    ready: obj({ minRevision: integer, strict: { type: "boolean" } }, []),
    capabilities: obj({}),
    "jobs.status": obj({ id }),
    "jobs.cancel": obj({ id }),
    "jobs.wait": obj({ id }),
    "jobs.list": obj({}),
  }).map(([method, input]) =>
    obj({ apiVersion: { const: "1.0" }, method: { const: method }, input }),
  ),
};
const schemas = {
  motionRig,
  mechanismPose,
  playRequest,
  playInput,
  playTeleport,
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
  code: { source: true, esm: true },
  strictNumbers: true,
  strictRequired: false,
});
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

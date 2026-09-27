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
    obj({
      id,
      name: str,
      visible: { type: "boolean" },
      locked: { type: "boolean" },
      order: integer,
    }),
  ),
  defaultLayerId: id,
  layerAssignments: dictionary(id),
  groups: dictionary(arr(id)),
  instructionPlans: dictionary(obj({ name: str, steps: arr(arr(id)) })),
  cameraBookmarks: dictionary(camera),
  motionRigs: dictionary({}),
  metadata: dictionary({}),
  assets: dictionary(str),
  diagnostics: arr(diagnostic),
});
const scoped = {
  occurrenceIds: { ...arr(id), minItems: 1, uniqueItems: true },
  includeHidden: { type: "boolean" },
  activeLayerId: id,
};
const payloads: Record<string, any> = {
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
        template: { enum: ["blank", "room", "wall", "200"] },
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
const api = {
  oneOf: Object.entries({
    "project.import": { $ref: "importRequest" },
    "project.export": { $ref: "exportRequest" },
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
  api,
  importRequest,
  exportRequest,
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

import type { MotionRig } from "../mechanisms/types";
import type { Architecture } from "./architecture";
import type { ProjectScene } from "./scene";
export type Vec3 = [number, number, number];
export type Basis = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
export type Transform = { position: Vec3; basis: Basis };
export type Node = {
  id: string;
  kind: "part" | "submodel" | "geometry";
  ref: string;
  colorCode: string;
  transform: Transform;
  sourceRecordId?: string;
};
export type RecordLine = { id: string; raw: string; nodeId?: string };
export type Model = {
  id: string;
  name: string;
  nodes: Node[];
  records: RecordLine[];
  classification: "model" | "custom";
};
export type LayerFolder = {
  id: string;
  name: string;
  order: number;
  parentFolderId?: string;
};
export type Layer = {
  parentFolderId?: string;
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  order: number;
};
export type Diagnostic = {
  code: string;
  message: string;
  severity: "warning" | "error";
  occurrenceIds: string[];
  details?: unknown;
};
export type InventoryOverride = {
  itemId: string;
  colorId: string;
  acknowledged: boolean;
  substitution: boolean;
};
/**
 * The user's purchasing decision for every occurrence of one part (keyed
 * "namespace:ref"), made in the parts-list resolution list (spec §6.6). An
 * occurrence override (`overrides`) still wins for its own occurrence.
 * Decisions are acknowledged, never catalogue verified.
 */
export type InventoryPartDecision = {
  /** BrickLink item to buy instead of the mapping pack's (none: keep it). */
  itemId?: string;
  /** Where `itemId` came from: one of the part file's ambiguous candidates,
   * the pack's derived or reviewed mapping accepted as is, or typed. */
  origin?: "candidate" | "derived" | "reviewed" | "user";
  /** The user says they checked the number on BrickLink themselves. */
  checked?: boolean;
  /** Leave every occurrence of this part out of the list (reported). */
  exclude?: boolean;
  /** LDraw colour codes of this part whose uncertain existence the user
   * accepted (never a colour known not to be produced). */
  acceptedColors?: string[];
  acknowledged: true;
};
export type InstructionStepMetadata = { notes?: string; camera?: CameraSpec };
export type InstructionPlan = {
  name: string;
  steps: string[][];
  stepMetadata?: InstructionStepMetadata[];
};
export type Project = {
  schemaVersion: 1;
  id: string;
  revision: number;
  title: string;
  units: "LDU";
  rootModelId: string;
  library: {
    releaseId: string;
    manifestSha256: string;
    colorConfigSha256: string;
    /** Connector pack the project's snapping and connectivity were derived with (spec §5). */
    connectorPackId?: string;
    connectorPackSha256?: string;
    /** Complete official library pack resolving parts outside the curated pack. */
    full?: {
      releaseId: string;
      manifestSha256: string;
      /** Connector pack derived from this complete pack (full-connectors.ts). */
      connectorPackId?: string;
      connectorPackSha256?: string;
    };
  };
  marketplace: {
    mappingPackId: string;
    mappingPackSha256: string;
    overrides: Record<string, InventoryOverride>;
    /** Part-level decisions ("official:3001.dat" → decision). */
    partDecisions?: Record<string, InventoryPartDecision>;
  };
  models: Record<string, Model>;
  layers: Record<string, Layer>;
  layerFolders?: Record<string, LayerFolder>;
  defaultLayerId: string;
  layerAssignments: Record<string, string>;
  groups: Record<string, string[]>;
  instructionPlans: Record<string, InstructionPlan>;
  cameraBookmarks: Record<string, CameraSpec>;
  /** Floor guides, room labels and camera floor views (authoring aids, spec §20.2). */
  architecture?: Architecture;
  /** Backdrop and Play hint (view data, native projects only; see scene.ts). */
  scene?: ProjectScene;
  motionRigs: Record<string, MotionRig>;
  metadata: Record<string, unknown>;
  assets: Record<string, string>;
  diagnostics: Diagnostic[];
};
export type Occurrence = {
  id: string;
  path: string[];
  node: Node;
  modelId: string;
  transform: Transform;
  colorCode: string;
  layerId: string;
  namespace: "official" | "project" | "missing";
  visible: boolean;
};
export type Command = {
  schemaVersion: 1;
  commandId: string;
  expectedRevision: number;
  type: string;
  payload: Record<string, any>;
  dryRun?: boolean;
};
export type CameraSpec = {
  space: "ldraw";
  projection: "perspective" | "orthographic";
  position: Vec3;
  target: Vec3;
  up: Vec3;
  fovDeg: number;
  near: number;
  far: number;
  span?: number;
};
export type Scope =
  | { kind: "all" }
  | { kind: "visible" }
  | { kind: "layers"; layerIds: string[] }
  | { kind: "selection"; occurrenceIds: string[] }
  | { kind: "submodel"; occurrenceId: string };
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export function ensure(
  ok: unknown,
  code: string,
  message: string,
  details?: unknown,
): asserts ok {
  if (!ok) throw new AppError(code, message, details);
}
export const uid = () => crypto.randomUUID();

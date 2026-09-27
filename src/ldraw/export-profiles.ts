import { zipSync, strToU8 } from "fflate";
import { type Project, type Scope, ensure } from "../core/types";
import { occurrences } from "../core/document";
import { resolveScope } from "../inventory/service";
import { exportLDraw, scopedLDraw, importLDraw } from "./io";
import { canonical } from "./path";
import { libraryLock } from "../catalog/catalog";
import { sha256 } from "../core/hash";
import { validate } from "../core/validate";
import { encodeNative } from "../persistence/native";
export type ExportProfile = "standard" | "portable" | "layers" | "native";
export type ExportRequest = {
  expectedRevision?: number;
  profile: ExportProfile;
  scope: Scope;
  includeCompleteModel?: boolean;
  includeOfficial?: boolean;
  acknowledgeScopedMetadata?: boolean;
};
export type ExportOptions = {
  signal?: AbortSignal;
  readAsset?: (path: string, signal?: AbortSignal) => Promise<Uint8Array>;
  progress?: (message: string) => void;
};
export const PORTABLE_INSTRUCTIONS =
  "Extract the ZIP, open model.mpd, and add the included ldraw folder as a parts-library search path in the receiving editor. This editor imports the extracted model.mpd, not the archive. Official references retain their purchasing identity; imported project-local overrides remain custom.";
const MAX_BYTES = 32 * 1024 * 1024;
const safeName = (s: string) =>
  s.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 70) || "model";
const check = (options: ExportOptions) => {
  ensure(!options.signal?.aborted, "CANCELLED", "Export cancelled.");
};
const size = (bytes: Uint8Array) => {
  ensure(bytes.length <= MAX_BYTES, "LIMIT_EXCEEDED", "Export exceeds 32 MiB.");
  return bytes;
};
async function read(path: string, options: ExportOptions) {
  check(options);
  if (options.readAsset)
    return size(await options.readAsset(path, options.signal));
  const r = await fetch(import.meta.env.BASE_URL + path, {
    signal: options.signal,
  });
  ensure(r.ok, "REFERENCE_MISSING", "Export dependency unavailable: " + path);
  return size(new Uint8Array(await r.arrayBuffer()));
}
function modelText(p: Project, ids: string[], all: boolean, ack: boolean) {
  return all ? exportLDraw(p) : scopedLDraw(p, ids, ack);
}
function customClosure(text: string) {
  const p = importLDraw(text),
    keep = new Set<string>();
  const visit = (id: string) => {
    if (keep.has(id)) return;
    keep.add(id);
    for (const n of p.models[id].nodes)
      if (n.kind !== "geometry" && p.models[n.ref]) visit(n.ref);
  };
  visit(p.rootModelId);
  p.models = Object.fromEntries([...keep].map((id) => [id, p.models[id]]));
  return exportLDraw(p);
}
type LibraryFile = {
  path: string;
  sha256: string;
  bytes: number;
  source: string;
  license: string[];
  authors: string[];
};
async function officialClosure(text: string, options: ExportOptions) {
  const base = "libraries/" + libraryLock.releaseId + "/",
    manifestBytes = await read(base + "manifest.json", options);
  ensure(
    (await sha256(manifestBytes)) === libraryLock.manifestSha256,
    "INVALID_INPUT",
    "Pinned dependency manifest hash mismatch.",
  );
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as {
    files: LibraryFile[];
  };
  const files = new Map<string, LibraryFile>();
  for (const f of manifest.files) {
    files.set(canonical(f.path), f);
    files.set(canonical(f.path.replace(/^(parts|p)\//, "")), f);
  }
  const project = importLDraw(text),
    embedded = new Set(
      Object.values(project.models).map((m) => canonical(m.name)),
    ),
    needed = new Map<
      string,
      { file: LibraryFile; text: string; bytes: Uint8Array }
    >();
  let total = manifestBytes.length;
  const visit = async (ref: string) => {
    check(options);
    const name = canonical(ref);
    if (embedded.has(name) || needed.has(name)) return;
    const file = files.get(name);
    ensure(
      file,
      "REFERENCE_MISSING",
      "Portable export lacks dependency: " + ref,
    );
    ensure(
      file.license.some((l) => /CC BY 4\.0/.test(l)),
      "INVALID_INPUT",
      "Dependency has no audited redistribution license: " + ref,
    );
    const bytes = await read(base + file.path, options);
    total += bytes.length;
    ensure(
      total <= MAX_BYTES,
      "LIMIT_EXCEEDED",
      "Dependency closure exceeds 32 MiB.",
    );
    ensure(
      bytes.length === file.bytes && (await sha256(bytes)) === file.sha256,
      "INVALID_INPUT",
      "Dependency hash mismatch: " + file.path,
    );
    const body = new TextDecoder().decode(bytes);
    needed.set(name, { file, text: body, bytes });
    ensure(
      needed.size <= 256,
      "LIMIT_EXCEEDED",
      "Dependency closure exceeds 256 definitions.",
    );
    options.progress?.("Verified " + file.path);
    for (const line of body.split(/\r?\n/)) {
      const match = line.trim().match(/^1\s+\S+(?:\s+\S+){12}\s+(.+)$/);
      if (match) await visit(match[1]);
    }
  };
  for (const model of Object.values(project.models))
    for (const node of model.nodes)
      if (node.kind !== "geometry" && !project.models[node.ref])
        await visit(node.ref);
  const notices = [
    ...new Map([...needed.values()].map((v) => [v.file.path, v.file])).values(),
  ];
  const attribution =
    "Official LDraw dependency closure\nSource library: " +
    libraryLock.releaseId +
    "\nLicense: Creative Commons Attribution 4.0 International\nhttps://creativecommons.org/licenses/by/4.0/\nNo source geometry modifications. Original author and license headers retained.\n\n" +
    notices
      .map(
        (f) =>
          f.path +
          "\nAuthors: " +
          f.authors.map((a) => a.trim()).join(", ") +
          "\nSource: " +
          f.source +
          "\nSHA-256: " +
          f.sha256 +
          "\n" +
          f.license.map((x) => x.trim()).join("\n"),
      )
      .join("\n\n");
  return {
    files: notices,
    entries: Object.fromEntries(
      [...needed.values()].map((v) => ["ldraw/" + v.file.path, v.bytes]),
    ),
    attribution,
  };
}
async function archive(
  entries: Record<string, Uint8Array>,
  manifest: { files: Record<string, string> },
  options: ExportOptions,
) {
  for (const [path, bytes] of Object.entries(entries)) {
    check(options);
    manifest.files[path] = await sha256(bytes);
  }
  entries["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  ensure(
    Object.values(entries).reduce((n, b) => n + b.length, 0) <= MAX_BYTES,
    "LIMIT_EXCEEDED",
    "Archive including manifest and notices exceeds 32 MiB.",
  );
  check(options);
  return size(zipSync(entries));
}
export async function exportProfile(
  project: Project,
  request: ExportRequest,
  options: ExportOptions = {},
) {
  validate("exportProfileRequest", request);
  check(options);
  ensure(
    request.expectedRevision === undefined ||
      request.expectedRevision === project.revision,
    "REVISION_CONFLICT",
    "Export revision changed.",
  );
  const p = structuredClone(project),
    selected = resolveScope(p, request.scope),
    ids = selected.map((o) => o.id),
    warnings: string[] = [];
  ensure(
    ["standard", "portable", "layers", "native"].includes(request.profile),
    "INVALID_INPUT",
    "Unknown export profile.",
  );
  ensure(
    !request.includeOfficial || request.profile === "portable",
    "INVALID_INPUT",
    "Official closure is available only with the portable profile.",
  );

  const manifest = {
    schemaVersion: 1,
    profile: request.profile,
    projectId: p.id,
    revision: p.revision,
    scope: request.scope,
    coordinateSpace: "LDraw",
    recentered: false,
    occurrenceCount: ids.length,
    occurrenceIds: ids,
    library: p.library,
    warnings,
    layers: [] as {
      id: string;
      name: string;
      file: string;
      occurrenceIds: string[];
      sha256: string;
    }[],
    officialFiles: [] as LibraryFile[],
    files: {} as Record<string, string>,
  };
  if (request.profile === "native") {
    ensure(
      request.scope.kind === "all",
      "INVALID_INPUT",
      "Native project export always includes the complete project.",
    );
    const bytes = size(await encodeNative(p));
    check(options);
    return {
      name: safeName(p.title) + ".brickproj",
      mime: "application/octet-stream",
      bytes,
      manifest,
    };
  }
  if (request.scope.kind !== "all")
    warnings.push(
      "Scoped LDraw retains geometry/source context, but native groups, layer memberships, overrides, assets and rigs require the native project.",
    );
  if (request.profile === "layers") {
    const entries: Record<string, Uint8Array> = {};
    let total = 0;
    for (const [index, layer] of Object.values(p.layers)
      .sort((a, b) => a.order - b.order)
      .entries()) {
      check(options);
      const layerIds = selected
        .filter((o) => o.layerId === layer.id)
        .map((o) => o.id);
      if (request.scope.kind !== "all" && !layerIds.length) continue;
      const file =
          String(index + 1).padStart(3, "0") +
          "-" +
          safeName(layer.name) +
          ".mpd",
        bytes = size(
          strToU8(
            scopedLDraw(p, layerIds, !!request.acknowledgeScopedMetadata),
          ),
        );
      entries[file] = bytes;
      total += bytes.length;
      ensure(
        total <= MAX_BYTES,
        "LIMIT_EXCEEDED",
        "Layer archive exceeds 32 MiB.",
      );
      manifest.layers.push({
        id: layer.id,
        name: layer.name,
        file,
        occurrenceIds: layerIds,
        sha256: await sha256(bytes),
      });
      options.progress?.("Exported " + layer.name);
    }
    if (request.includeCompleteModel) {
      entries["complete-model.mpd"] = size(strToU8(exportLDraw(p)));
      total += entries["complete-model.mpd"].length;
      ensure(
        total <= MAX_BYTES,
        "LIMIT_EXCEEDED",
        "Layer archive exceeds 32 MiB.",
      );
    }

    entries["README.txt"] = strToU8(
      "Each layer retains world coordinates and embedded custom definitions. Import layer files together without recentering to recombine the selected geometry. Complete-model.mpd, when requested, includes all authored parts regardless of the selected scope. MPD does not retain native layer, group, marketplace or motion-rig metadata. Official parts remain external references to the pinned library.",
    );
    check(options);
    return {
      name: safeName(p.title) + "-layers.zip",
      mime: "application/zip",
      bytes: await archive(entries, manifest, options),
      manifest,
    };
  }
  let text = modelText(
    p,
    ids,
    request.scope.kind === "all",
    !!request.acknowledgeScopedMetadata,
  );
  if (request.profile === "portable") text = customClosure(text);
  if (request.includeOfficial) {
    ensure(
      p.library.manifestSha256 === libraryLock.manifestSha256 &&
        p.library.releaseId === libraryLock.releaseId,
      "INVALID_INPUT",
      "Portable dependency pack must match the project library lock.",
    );
    const closure = await officialClosure(text, options);
    manifest.officialFiles = closure.files;
    warnings.push(PORTABLE_INSTRUCTIONS);
    warnings.push(
      "LDConfig colour configuration is supplied by the recipient LDraw installation; this archive includes only licensed geometry dependencies.",
    );
    const entries = {
      ...closure.entries,
      "model.mpd": size(strToU8(text)),

      "README.txt": strToU8(
        PORTABLE_INSTRUCTIONS +
          "\nThe ldraw/parts and ldraw/p directories use standard LDraw search paths, including parts/s subparts. Use your recipient LDraw colour configuration. Native layer/rig/inventory-override metadata requires a native project backup.",
      ),
      "ldraw/CAreadme.txt": strToU8(closure.attribution),
    };
    ensure(
      Object.values(entries).reduce((n, b) => n + b.length, 0) <= MAX_BYTES,
      "LIMIT_EXCEEDED",
      "Portable archive exceeds 32 MiB.",
    );
    check(options);
    return {
      name: safeName(p.title) + "-portable.zip",
      mime: "application/zip",
      bytes: await archive(entries, manifest, options),
      manifest,
    };
  } else if (request.profile === "portable")
    warnings.push(
      "Custom dependency closure is embedded. Official/external references still require the recipient library.",
    );
  check(options);
  return {
    name:
      safeName(p.title) +
      (request.profile === "portable" ? "-portable" : "") +
      ".mpd",
    mime: "text/plain",
    bytes: size(strToU8(text)),
    manifest,
  };
}

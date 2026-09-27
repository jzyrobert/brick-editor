import { Editor } from "../core/commands";
import { occurrences } from "../core/document";
import { compose, identity, physical } from "../core/math";
import { ensure, uid, type Command, type Transform } from "../core/types";
export type TransformSelection = {
  occurrenceIds: string[];
  activeLayerId?: string;
  includeHidden?: boolean;
};
export interface TransformPreviewRenderer {
  beginTransientPose(): () => void;
  applyTransientPose(transforms: Record<string, Transform>): void;
}
/** One frozen semantic edit per gesture. Preview never mutates the editor document. */
export class TransformGesture {
  private state?: {
    revision: number;
    request: TransformSelection;
    baseline: Record<string, Transform>;
    delta: Transform;
    restore: () => void;
  };
  private unsubscribe: () => void;
  constructor(
    private editor: Editor,
    private renderer: TransformPreviewRenderer,
  ) {
    this.unsubscribe = editor.subscribe(() => {
      if (this.state && editor.project.revision !== this.state.revision)
        this.cancel();
    });
  }
  get active() {
    return !!this.state;
  }
  begin(request: TransformSelection) {
    this.cancel();
    ensure(
      request.occurrenceIds.length > 0 && request.occurrenceIds.length <= 1000,
      "LIMIT_EXCEEDED",
      "Transform handles support 1–1,000 selected occurrences.",
    );
    const project = this.editor.project;
    this.editor.dispatch({
      schemaVersion: 1,
      commandId: uid(),
      expectedRevision: project.revision,
      type: "parts.transform",
      payload: { ...request, delta: [0, 0, 0] },
      dryRun: true,
    });
    const ids = new Set(request.occurrenceIds),
      baseline = Object.fromEntries(
        occurrences(project)
          .filter((o) => ids.has(o.id))
          .map((o) => [o.id, structuredClone(o.transform)]),
      );
    this.state = {
      revision: project.revision,
      request: structuredClone(request),
      baseline,
      delta: identity(),
      restore: this.renderer.beginTransientPose(),
    };
    return { revision: project.revision, count: ids.size };
  }
  preview(delta: Transform) {
    const s = this.current();
    ensure(
      delta &&
        delta.position.length === 3 &&
        delta.basis.length === 9 &&
        [...delta.position, ...delta.basis].every(Number.isFinite) &&
        physical(delta),
      "INVALID_TRANSFORM",
      "Handle preview requires a finite rigid world-space delta.",
    );
    const transforms = Object.fromEntries(
      Object.entries(s.baseline).map(([id, rest]) => [
        id,
        compose(delta, rest),
      ]),
    );
    this.renderer.applyTransientPose(transforms);
    s.delta = structuredClone(delta);
    return transforms;
  }
  private current() {
    ensure(this.state, "INVALID_INPUT", "Start a transform gesture first.");
    ensure(
      this.editor.project.revision === this.state.revision,
      "REVISION_CONFLICT",
      "Selection changed during the transform.",
    );
    return this.state;
  }
  commit() {
    const s = this.current(),
      same = [...s.delta.position, ...s.delta.basis].every(
        (v, i) => Math.abs(v - [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1][i]) < 1e-10,
      );
    if (same) {
      this.cancel();
      return { revision: s.revision, unchanged: true };
    }
    const transactionId = uid(),
      commands: Command[] = Object.entries(s.baseline).map(([id, rest]) => ({
        schemaVersion: 1,
        commandId: uid(),
        expectedRevision: s.revision,
        type: "parts.transform",
        payload: {
          occurrenceIds: [id],
          transform: compose(s.delta, rest),
          space: "ldraw",
          includeHidden: s.request.includeHidden,
          ...(s.request.activeLayerId
            ? { activeLayerId: s.request.activeLayerId }
            : {}),
        },
      }));
    const input = {
      commandId: transactionId,
      expectedRevision: s.revision,
      commands,
    };
    this.editor.transaction({ ...input, dryRun: true });
    this.cancel();
    return this.editor.transaction(input);
  }
  cancel() {
    const s = this.state;
    this.state = undefined;
    s?.restore();
  }
  dispose() {
    this.cancel();
    this.unsubscribe();
  }
}

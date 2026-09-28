import type { Editor } from "../core/commands";
import { ensure, uid } from "../core/types";
import type { SceneAdapter } from "../render/adapter";
import { KinematicSession } from "./kinematic";
import type { MechanismSnapshot } from "./types";
import { posedLDraw } from "./posed-export";
export type MechanismViewState = {
  active: boolean;
  loading: boolean;
  report?: MechanismSnapshot;
  error?: string;
};
/** Browser presentation is transient; only applyPose invokes an authored command. */
export class MechanismBrowser {
  private session?: KinematicSession;
  private restore?: () => void;
  private listeners = new Set<() => void>();
  private state: MechanismViewState = { active: false, loading: false };
  private epoch = 0;
  private unsubscribe: () => void;
  constructor(
    private editor: Editor,
    private render: SceneAdapter | (() => SceneAdapter | undefined),
  ) {
    this.unsubscribe = editor.subscribe(() => {
      if (
        this.session &&
        this.session.snapshot().sourceRevision !== editor.revision
      ) {
        this.exit();
        this.emit({
          error: "The project changed. Re-enter the mechanism preview.",
        });
      }
    });
  }
  getState = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  get active() {
    return this.state.active;
  }
  private emit(patch: Partial<MechanismViewState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  private renderer() {
    const renderer =
      typeof this.render === "function" ? this.render() : this.render;
    ensure(renderer, "WEBGL_UNAVAILABLE", "Mechanism preview requires WebGL2.");
    return renderer;
  }
  private current() {
    ensure(this.session, "INVALID_INPUT", "Enter a mechanism preview first.");
    ensure(
      this.session.snapshot().sourceRevision === this.editor.revision,
      "REVISION_CONFLICT",
      "Project changed; re-enter the mechanism.",
    );
    return this.session;
  }
  async enter(rigId: string) {
    this.exit();
    const epoch = ++this.epoch;
    this.emit({ loading: true, error: undefined });
    try {
      const project = this.editor.project,
        session = new KinematicSession(project, rigId),
        renderer = this.renderer();
      await renderer.ready(project.revision, true);
      ensure(
        epoch === this.epoch,
        "CANCELLED",
        "Mechanism preview was cancelled.",
      );
      ensure(
        this.editor.revision === project.revision,
        "REVISION_CONFLICT",
        "Project changed while preparing the mechanism.",
      );
      this.restore = renderer.beginTransientPose();
      this.session = session;
      this.emit({ active: true, loading: false });
      return this.update();
    } catch (error) {
      if (epoch === this.epoch) {
        this.exit();
        this.emit({
          error: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  }
  private update() {
    const report = this.current().snapshot();
    this.renderer().applyTransientPose(report.transforms);
    this.emit({ report, error: undefined });
    return report;
  }
  setJointPosition(id: string, value: number) {
    this.current().setJointPosition(id, value);
    return this.update();
  }
  setVehicleInput(input: { throttle: number; steering: number }) {
    this.current().setVehicleInput(input);
    return this.update();
  }
  setPose(pose: MechanismSnapshot["pose"]) {
    this.current().setPose(pose);
    return this.update();
  }
  stepTicks(count: number) {
    this.current().stepTicks(count);
    return this.update();
  }
  snapshot() {
    return this.current().snapshot();
  }
  /** Static posed LDraw snapshot of the previewed pose; nothing is edited. */
  exportPosedModel() {
    const report = this.current().snapshot();
    const posed = posedLDraw(this.editor.project, report.transforms);
    return {
      format: "ldraw-mpd" as const,
      text: posed.text,
      sourceRevision: report.sourceRevision,
      tick: report.tick,
      rigIds: [report.rigId],
      posedOccurrenceIds: posed.posedOccurrenceIds,
      warnings: posed.warnings,
    };
  }
  applyPose() {
    const report = this.current().snapshot(),
      command = {
        schemaVersion: 1 as const,
        commandId: uid(),
        expectedRevision: report.sourceRevision,
        type: "rigs.applyPose",
        payload: {
          rigId: report.rigId,
          sourceRevision: report.sourceRevision,
          pose: report.pose,
        },
      };
    this.editor.dispatch({ ...command, dryRun: true });
    this.exit();
    return this.editor.dispatch(command);
  }
  exit() {
    this.epoch++;
    this.session = undefined;
    this.restore?.();
    this.restore = undefined;
    this.emit({ active: false, loading: false, report: undefined });
  }
  dispose() {
    this.exit();
    this.unsubscribe();
    this.listeners.clear();
  }
}

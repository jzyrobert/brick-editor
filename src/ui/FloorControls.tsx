import { useState } from "react";
import type { Project } from "../core/types";
import {
  architectureOf,
  sortedFloors,
  type FloorGuide,
} from "../core/architecture";
import { detectFloors } from "../edit/floors";
import { Icon } from "./icons";

/** LDraw −Y is up; heights are shown in plates (8 LDU) above y = 0. */
const plates = (y: number) => Math.round((-y / 8) * 10) / 10;
/** A typical storey: six bricks. */
const STOREY = 144;

/** Floor guides, floor focus and room labels (spec §20.2): the Floors tab of the
 * camera-views popover, so phones keep the canvas clear. Every edit is an undoable document command;
 * focus and overlay visibility are view settings only. */
export function FloorControls({
  project,
  command,
  run,
  focusFloorId,
  setFocusFloorId,
  ghostBelow,
  setGhostBelow,
  guides,
  setGuides,
  labels,
  setLabels,
  sectionHeight,
  exploded,
  modelBottom,
  onPlaceLabel,
  onStatus,
}: {
  project: Project;
  command: (type: string, payload: Record<string, unknown>) => unknown;
  run: (fn: () => unknown) => Promise<unknown>;
  focusFloorId: string | null;
  setFocusFloorId: (id: string | null) => void;
  ghostBelow: boolean;
  setGhostBelow: (ghost: boolean) => void;
  guides: boolean;
  setGuides: (show: boolean) => void;
  labels: boolean;
  setLabels: (show: boolean) => void;
  sectionHeight: number | null;
  exploded: boolean;
  modelBottom: () => number | null;
  onPlaceLabel: (text: string) => void;
  onStatus: (message: string) => void;
}) {
  const a = architectureOf(project),
    floors = sortedFloors(a.floors);
  const [labelText, setLabelText] = useState("");
  const setFloors = (next: FloorGuide[], message: string, showGuides = false) =>
    void run(() => {
      command("floors.set", { floors: next });
      if (showGuides) setGuides(true);
      onStatus(message);
    });
  const detect = () => {
    const found = detectFloors(project);
    if (!found.length) {
      onStatus(
        "No floors found: split the model into submodels or layers per floor, or add floors by hand.",
      );
      return;
    }
    setFloors(
      found,
      `Found ${found.length} floor${found.length === 1 ? "" : "s"} from the model's submodels or layers.`,
      true,
    );
  };
  const addFloor = () => {
    const top = floors.at(-1);
    const y = sectionHeight ?? (top ? top.y - STOREY : (modelBottom() ?? 0));
    setFloors(
      [
        ...floors,
        {
          id: crypto.randomUUID(),
          name: floors.length ? `Floor ${floors.length}` : "Ground floor",
          y,
        },
      ],
      sectionHeight !== null
        ? "Floor added at the section cut."
        : "Floor added. Adjust its height in plates.",
      true,
    );
  };
  const floorActions = (
    <div className="floor-actions">
      <button onClick={detect}>Detect floors</button>
      <button onClick={addFloor}>
        {sectionHeight !== null ? "Add floor at cut" : "Add floor"}
      </button>
    </div>
  );
  return (
    <div className="floor-control">
      {floors.length === 0 ? (
        <>
          <p className="view-hint">
            Mark each floor to see one at a time and lift off the roof.
          </p>
          {floorActions}
        </>
      ) : (
        <>
          <div className="floor-chips" role="group" aria-label="Floor focus">
            <button
              aria-pressed={focusFloorId === null}
              onClick={() => {
                setFocusFloorId(null);
                onStatus("Showing every floor.");
              }}
            >
              All floors
            </button>
            {[...floors].reverse().map((floor) => (
              <button
                key={floor.id}
                aria-pressed={focusFloorId === floor.id}
                onClick={() => {
                  setFocusFloorId(floor.id);
                  onStatus(
                    `Showing ${floor.name}: floors above are hidden${ghostBelow ? ", floors below ghosted" : ""}. Nothing is deleted.`,
                  );
                }}
              >
                {floor.name}
              </button>
            ))}
          </div>
          <div className="floor-checks">
            <label className="floor-check">
              <input
                type="checkbox"
                checked={ghostBelow}
                onChange={(e) => setGhostBelow(e.target.checked)}
              />
              Ghost floors below
            </label>
            <label className="floor-check">
              <input
                type="checkbox"
                checked={guides}
                onChange={(e) => setGuides(e.target.checked)}
              />
              Floor guides
            </label>
          </div>
          <details className="floor-edit">
            <summary>Edit floors ({floors.length})</summary>
            {[...floors].reverse().map((floor) => (
              <div className="floor-row" key={floor.id + ":" + floor.y}>
                <input
                  aria-label="Floor name"
                  defaultValue={floor.name}
                  maxLength={60}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (!name || name === floor.name) {
                      e.target.value = floor.name;
                      return;
                    }
                    setFloors(
                      floors.map((f) =>
                        f.id === floor.id ? { ...f, name } : f,
                      ),
                      "Floor renamed.",
                    );
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
                <input
                  aria-label={`${floor.name} height in plates`}
                  type="number"
                  step={1}
                  defaultValue={plates(floor.y)}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n) || n === plates(floor.y)) return;
                    setFloors(
                      floors.map((f) =>
                        f.id === floor.id ? { ...f, y: -n * 8 } : f,
                      ),
                      `${floor.name} moved to ${n} plates.`,
                    );
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
                <button
                  aria-label={`Remove ${floor.name}`}
                  onClick={() =>
                    setFloors(
                      floors.filter((f) => f.id !== floor.id),
                      `${floor.name} removed. Its parts are untouched.`,
                    )
                  }
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
            {floorActions}
          </details>
        </>
      )}
      <details className="floor-edit">
        <summary>Room labels ({a.labels.length})</summary>
        <form
          className="label-form"
          onSubmit={(e) => {
            e.preventDefault();
            const text = labelText.trim();
            if (!text) {
              onStatus("Type a room name first.");
              return;
            }
            if (exploded) {
              onStatus("Assemble the floors before placing a room label.");
              return;
            }
            onPlaceLabel(text);
            setLabelText("");
          }}
        >
          <input
            aria-label="Room label"
            placeholder="Room name, e.g. Kitchen"
            maxLength={80}
            value={labelText}
            onChange={(e) => setLabelText(e.target.value)}
          />
          <button type="submit">Place label</button>
        </form>
        {a.labels.length > 0 && (
          <>
            <label className="floor-check">
              <input
                type="checkbox"
                checked={labels}
                onChange={(e) => setLabels(e.target.checked)}
              />
              Show room labels
            </label>
            {a.labels.map((label) => (
              <div
                className="floor-row"
                key={label.id + ":" + label.text + ":" + label.floorId}
              >
                <input
                  aria-label="Label text"
                  defaultValue={label.text}
                  maxLength={80}
                  onBlur={(e) => {
                    const text = e.target.value.trim();
                    if (!text || text === label.text) {
                      e.target.value = label.text;
                      return;
                    }
                    void run(() =>
                      command("labels.update", {
                        labelId: label.id,
                        text,
                      }),
                    );
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
                {floors.length > 0 && (
                  <select
                    aria-label={`${label.text} floor`}
                    value={label.floorId ?? ""}
                    onChange={(e) =>
                      void run(() =>
                        command("labels.update", {
                          labelId: label.id,
                          floorId: e.target.value || null,
                        }),
                      )
                    }
                  >
                    <option value="">Any floor</option>
                    {floors.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  aria-label={`Remove label ${label.text}`}
                  onClick={() =>
                    void run(() => {
                      command("labels.remove", { labelId: label.id });
                      onStatus(`Label “${label.text}” removed.`);
                    })
                  }
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
          </>
        )}
      </details>
    </div>
  );
}

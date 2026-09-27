import type { Layer } from "../core/types";
export function PlayWorldSettings({
  layers,
  excluded,
  ground,
  onExcluded,
  onGround,
}: {
  layers: Record<string, Layer>;
  excluded: string[];
  ground: boolean;
  onExcluded: (ids: string[]) => void;
  onGround: (value: boolean) => void;
}) {
  return (
    <details className="play-world-settings">
      <summary>World included in Play</summary>
      <p>
        All layers are included by default, even those hidden in the editor.
        Excluded layers are absent from both the Play view and collision. These
        choices apply when you enter Play; your build stays unchanged.
      </p>
      <label>
        <input
          type="checkbox"
          checked={ground}
          onChange={(e) => onGround(e.target.checked)}
        />
        Temporary ground plane
      </label>
      {Object.values(layers)
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
        .map((layer) => (
          <label key={layer.id}>
            <input
              type="checkbox"
              checked={!excluded.includes(layer.id)}
              onChange={(e) =>
                onExcluded(
                  e.target.checked
                    ? excluded.filter((id) => id !== layer.id)
                    : [...excluded, layer.id],
                )
              }
            />
            <span>
              {layer.name}
              {!layer.visible ? " · hidden in editor" : ""}
            </span>
          </label>
        ))}
      <p>
        Moving mechanisms require every layer containing their parts. To exclude
        one of those layers, choose Static build or another mechanism.
      </p>
    </details>
  );
}

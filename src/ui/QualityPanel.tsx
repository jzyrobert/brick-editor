import { useState } from "react";
import type { SceneAdapter } from "../render/adapter";
import type { QualityName, QualityControls } from "../render/quality";
export function QualityPanel({
  renderer,
}: {
  renderer: SceneAdapter | undefined;
}) {
  const [profile, setProfile] = useState(renderer?.currentQuality());
  const [message, setMessage] = useState("");
  if (!profile || !renderer) return null;
  const change = (
    name: QualityName,
    controls: Partial<QualityControls> = {},
  ) => {
    try {
      renderer.setQuality(name, controls);
      setProfile(renderer.currentQuality());
      setMessage("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };
  const controls: QualityControls = {
    edges: profile.edges,
    shadows: profile.shadows,
    shadowMapSize: profile.shadowMapSize,
    pixelRatioCap: profile.pixelRatioCap,
    toneMapping: profile.toneMapping,
    exposure: profile.exposure,
  };
  return (
    <section>
      <h3>Render quality</h3>
      <label>
        Quality preset
        <select
          value={profile.name}
          onChange={(e) => change(e.target.value as QualityName)}
        >
          <option value="fast">Fast</option>
          <option value="balanced">Balanced</option>
          <option value="photo">Photo</option>
        </select>
      </label>
      <details>
        <summary>Lighting and edges</summary>
        <label>
          Edges
          <select
            value={profile.edges}
            onChange={(e) =>
              change(profile.name, {
                ...controls,
                edges: e.target.value as QualityControls["edges"],
              })
            }
          >
            <option value="none">None</option>
            <option value="ordinary">Ordinary lines</option>
            <option value="all">All supported lines</option>
          </select>
        </label>
        <label>
          Shadows
          <select
            value={profile.shadows}
            onChange={(e) =>
              change(profile.name, {
                ...controls,
                shadows: e.target.value as QualityControls["shadows"],
              })
            }
          >
            <option value="off">Off</option>
            <option value="soft">Soft</option>
          </select>
        </label>
        <label>
          Exposure
          <input
            type="range"
            min="0.1"
            max="4"
            step="0.1"
            value={profile.exposure}
            onChange={(e) =>
              change(profile.name, {
                ...controls,
                exposure: Number(e.target.value),
              })
            }
          />
        </label>
      </details>
      <p role="status">{message}</p>
    </section>
  );
}

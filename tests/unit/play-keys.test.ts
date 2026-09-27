import { expect, it, vi } from "vitest";
import {
  defaultPlayKeys,
  validatePlayKeys,
  playKeyAction,
  loadPlayKeys,
  savePlayKeys,
} from "../../src/play/keys";
it("validates unambiguous single-key actions while retaining a fixed Escape pause", () => {
  const keys = validatePlayKeys({
    ...defaultPlayKeys,
    forward: "arrowup",
    backward: "ArrowDown",
    left: "arrowleft",
    right: "ArrowRight",
    jump: "",
    camera: "c",
  });
  expect(playKeyAction("ArrowUp", keys)).toBe("forward");
  expect(playKeyAction("C", keys)).toBe("camera");
  expect(playKeyAction("w", keys)).toBeUndefined();
  expect(playKeyAction(" ", keys)).toBeUndefined();
  expect(playKeyAction("Shift", keys)).toBe("run");
  expect(() => validatePlayKeys({ ...keys, backward: "ArrowUp" })).toThrow(
    /already assigned/,
  );
  expect(() => validatePlayKeys({ ...keys, forward: "Escape" })).toThrow(
    /always pauses/,
  );
  expect(() => validatePlayKeys({ ...keys, forward: "Mod+W" })).toThrow(
    /single/,
  );
  expect(() => validatePlayKeys({ ...keys, unknown: "K" })).toThrow(
    /each action/,
  );
});
it("keeps malformed local preferences from breaking Play and reports unavailable persistence", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => '{"forward":"ArrowUp"}',
    setItem: () => {
      throw new Error("storage unavailable");
    },
  });
  try {
    expect(loadPlayKeys()).toEqual(defaultPlayKeys);
    expect(savePlayKeys({ ...defaultPlayKeys })).toBe(false);
  } finally {
    vi.unstubAllGlobals();
  }
});
it("migrates existing remaps without stealing an assigned interaction key", () => {
  const { interact: _, ...old } = defaultPlayKeys;
  vi.stubGlobal("localStorage", {
    getItem: () => JSON.stringify({ ...old, forward: "E" }),
  });
  try {
    expect(loadPlayKeys().forward).toBe("E");
    expect(loadPlayKeys().interact).toBe("");
  } finally {
    vi.unstubAllGlobals();
  }
});

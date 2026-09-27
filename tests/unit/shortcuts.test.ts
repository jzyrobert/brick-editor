import { expect, it } from "vitest";
import {
  defaultShortcuts,
  normalizeShortcut,
  validateShortcuts,
  shortcutAction,
} from "../../src/edit/shortcuts";
it("normalizes platform modifiers and rejects duplicates/unknown actions without ambiguity", () => {
  expect(normalizeShortcut("ctrl+shift+z")).toBe("Mod+Shift+Z");
  expect(normalizeShortcut("Cmd+c")).toBe("Mod+C");
  expect(
    shortcutAction(
      {
        key: "C",
        ctrlKey: false,
        metaKey: true,
        altKey: false,
        shiftKey: false,
      },
      defaultShortcuts,
    ),
  ).toBe("copy");
  expect(
    shortcutAction(
      {
        key: "c",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: true,
      },
      defaultShortcuts,
    ),
  ).toBeUndefined();
  expect(() => validateShortcuts({ ...defaultShortcuts, copy: "V" })).toThrow(
    "already assigned",
  );
  expect(() =>
    validateShortcuts({ ...defaultShortcuts, copy: "Foo+C" }),
  ).toThrow();
  expect(validateShortcuts({ ...defaultShortcuts, paint: "" }).paint).toBe("");
});

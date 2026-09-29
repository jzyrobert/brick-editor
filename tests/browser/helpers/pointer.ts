import type { Page } from "@playwright/test";

/**
 * On a desktop, entering Play captures the mouse (pointer lock), after which
 * mouse clicks go to the view rather than buttons, as in any browser game.
 * Tests that drive Play's buttons with a mouse run as if the browser refused
 * pointer lock, which keeps drag-to-look and clickable buttons.
 */
export function refusePointerLock(page: Page) {
  return page.addInitScript(() => {
    Element.prototype.requestPointerLock = function () {
      return Promise.reject(
        new DOMException(
          "Pointer lock refused for this test",
          "NotSupportedError",
        ),
      );
    } as Element["requestPointerLock"];
  });
}

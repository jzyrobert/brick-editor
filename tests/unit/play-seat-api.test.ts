import { expect, it, vi } from "vitest";
import { createAPI } from "../../src/automation/api";
import { Editor } from "../../src/core/commands";
import { mechanismFixture } from "../../src/mechanisms/fixtures";

it("preflights seat requests before accessing a Play session or evaluating input getters", async () => {
  const player = vi.fn(() => undefined);
  const getter = vi.fn(() => "vehicle");
  const api = createAPI(
    new Editor(mechanismFixture()),
    () => undefined,
    player,
  );
  const accessor = {
    get rigId() {
      return getter();
    },
    seatId: "driver",
  };
  await expect(api.play.enterVehicle(accessor)).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  await expect(api.play.vehicleSeatEligibility(accessor)).rejects.toMatchObject(
    { code: "INVALID_INPUT" },
  );
  await expect(api.play.exitVehicle({ exitIndex: 4 })).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  await expect(
    api.play.enterVehicle({
      rigId: "vehicle",
      seatId: "driver",
      unexpected: true,
    } as never),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  expect(getter).not.toHaveBeenCalled();
  expect(player).not.toHaveBeenCalled();
});

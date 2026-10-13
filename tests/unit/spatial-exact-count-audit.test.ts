import { expect, it } from "vitest";
import { exactCountAudit } from "../../scripts/spatial-benchmark/exact-count-audit";
it("separates exact brief compliance from inventory maxima and compiler acceptance", () => {
  expect(exactCountAudit(16, 16).status).toBe("verified");
  expect(exactCountAudit(16, 14).status).toBe("invalid");
  expect(exactCountAudit(16, 17).status).toBe("invalid");
  expect(exactCountAudit(16, null).status).toBe("unknown");
  expect(() => exactCountAudit(16, NaN)).toThrow();
});

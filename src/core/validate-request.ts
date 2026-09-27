import { assertRequestBudget } from "./request-budget";
import { validate } from "./validate";

/** Request-only limits; persisted documents and result reports have separate budgets. */
export function validateRequest(
  name: Parameters<typeof validate>[0],
  value: unknown,
) {
  assertRequestBudget(value);
  return validate(name, value);
}

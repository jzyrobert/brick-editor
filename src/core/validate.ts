import * as validators from "./validators.js";
import { ensure } from "./types";
export function validate(name: keyof typeof validators, value: unknown) {
  const fn = validators[name] as ((x: unknown) => boolean) & {
    errors?: unknown;
  };
  ensure(fn(value), "INVALID_INPUT", "Invalid " + name, fn.errors);
  return value;
}

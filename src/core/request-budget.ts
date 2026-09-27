import { ensure } from "./types";

export const MAX_REQUEST_BYTES = 25 * 1024 * 1024;
const MAX_REQUEST_VALUES = 1_000_000;
const MAX_REQUEST_DEPTH = 128;

/** Bound JSON-shaped external input before validation, cloning or serialization.
 * Shared objects are charged at every occurrence; only ancestor cycles are invalid.
 * Undefined optional fields are conservatively charged as JSON null.
 */
export function assertRequestBudget(
  input: unknown,
  maxBytes = MAX_REQUEST_BYTES,
) {
  let bytes = 0,
    work = 0;
  const charge = (amount: number) => {
    bytes += amount;
    ensure(bytes <= maxBytes, "LIMIT_EXCEEDED", "Request exceeds byte budget");
  };
  const string = (value: string) => {
    charge(2);
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code === 34 || code === 92 || [8, 9, 10, 12, 13].includes(code))
        charge(2);
      else if (code < 32) charge(6);
      else if (code < 128) charge(1);
      else if (code < 2048) charge(2);
      else if (
        code >= 0xd800 &&
        code <= 0xdbff &&
        i + 1 < value.length &&
        value.charCodeAt(i + 1) >= 0xdc00 &&
        value.charCodeAt(i + 1) <= 0xdfff
      ) {
        charge(4);
        i++;
      } else if (code >= 0xd800 && code <= 0xdfff) charge(6);
      else charge(3);
    }
  };
  type Frame = {
    value: object;
    keys?: string[];
    length: number;
    index: number;
  };
  const stack: Frame[] = [];
  const ancestors = new WeakSet<object>();
  const visit = (value: unknown) => {
    ensure(
      ++work <= MAX_REQUEST_VALUES,
      "LIMIT_EXCEEDED",
      "Request exceeds work budget",
    );
    if (value === null || value === undefined) charge(4);
    else if (typeof value === "string") string(value);
    else if (typeof value === "boolean") charge(value ? 4 : 5);
    else if (typeof value === "number") {
      ensure(
        Number.isFinite(value),
        "INVALID_INPUT",
        "Request numbers must be finite",
      );
      charge(String(value).length);
    } else {
      ensure(
        typeof value === "object",
        "INVALID_INPUT",
        "Request must contain JSON values",
      );
      const object = value as object;
      ensure(
        !ancestors.has(object),
        "INVALID_INPUT",
        "Request contains a cycle",
      );
      ensure(
        stack.length < MAX_REQUEST_DEPTH,
        "LIMIT_EXCEEDED",
        "Request exceeds nesting budget",
      );
      const array = Array.isArray(object);
      ensure(
        array
          ? Object.getPrototypeOf(object) === Array.prototype
          : Object.getPrototypeOf(object) === Object.prototype ||
              Object.getPrototypeOf(object) === null,
        "INVALID_INPUT",
        "Request must contain plain objects",
      );
      const keys = array ? undefined : Object.keys(object);
      const length = array ? object.length : keys!.length;
      ensure(
        length <= MAX_REQUEST_VALUES - work,
        "LIMIT_EXCEEDED",
        "Request exceeds work budget",
      );
      charge(2 + Math.max(0, length - 1));
      ancestors.add(object);
      stack.push({ value: object, keys, length, index: 0 });
    }
  };
  visit(input);
  while (stack.length) {
    const frame = stack[stack.length - 1];
    if (frame.index === frame.length) {
      ancestors.delete(frame.value);
      stack.pop();
      continue;
    }
    const key = frame.keys ? frame.keys[frame.index++] : String(frame.index++);
    if (frame.keys) {
      string(key);
      charge(1);
    }
    const descriptor = Object.getOwnPropertyDescriptor(frame.value, key);
    ensure(
      !descriptor || "value" in descriptor,
      "INVALID_INPUT",
      "Request accessors are unsupported",
    );
    visit(descriptor?.value);
  }
  return bytes;
}

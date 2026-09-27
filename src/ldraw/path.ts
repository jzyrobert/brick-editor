import { ensure } from "../core/types";
export function canonical(input: string) {
  ensure(
    input.length < 1024 &&
      !/[\x00-\x1f:?#]/.test(input) &&
      !/^[/\\]/.test(input),
    "INVALID_INPUT",
    "Unsafe reference path",
  );
  const out: string[] = [];
  for (const p of input.replaceAll("\\", "/").toLowerCase().split("/")) {
    if (p === "..") {
      ensure(out.length, "INVALID_INPUT", "Reference escapes namespace");
      out.pop();
    } else if (p && p !== ".") {
      ensure(
        !["__proto__", "constructor", "prototype"].includes(p),
        "INVALID_INPUT",
        "Reserved path",
      );
      out.push(p);
    }
  }
  ensure(out.length, "INVALID_INPUT", "Empty reference");
  return out.join("/");
}

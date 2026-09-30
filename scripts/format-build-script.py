#!/usr/bin/env python3
"""Compact, readable layout for build scripts: one op per line.

    python3 scripts/format-build-script.py fixtures/build-scripts/*.json
"""
import json
import sys


def one(v):
    return json.dumps(v, ensure_ascii=False, separators=(", ", ": "))


def ops(items, indent):
    pad = " " * indent
    lines = []
    for op in items:
        nested = op.get("ops") if isinstance(op, dict) else None
        if nested and len(one(op)) > 110:
            head = {k: v for k, v in op.items() if k != "ops"}
            text = one(head)[:-1] + ', "ops": [\n'
            text += ops(nested, indent + 2) + "\n" + pad + "]}"
            lines.append(pad + text)
        else:
            lines.append(pad + one(op))
    return ",\n".join(lines)


def fmt(script):
    out = ["{"]
    keys = list(script.keys())
    for i, key in enumerate(keys):
        value = script[key]
        comma = "," if i < len(keys) - 1 else ""
        if key == "sections":
            out.append('  "sections": [')
            for j, s in enumerate(value):
                head = {k: v for k, v in s.items() if k != "ops"}
                out.append("    " + one(head)[:-1] + ', "ops": [')
                out.append(ops(s["ops"], 6))
                out.append("    ]}" + ("," if j < len(value) - 1 else ""))
            out.append("  ]" + comma)
        elif key == "components":
            out.append('  "components": {')
            names = list(value.keys())
            for j, name in enumerate(names):
                c = value[name]
                head = {k: v for k, v in c.items() if k != "ops"}
                out.append(
                    "    " + json.dumps(name) + ": " + one(head)[:-1]
                    + (', "ops": [' if head else '"ops": [')
                )
                out.append(ops(c["ops"], 6))
                out.append("    ]}" + ("," if j < len(names) - 1 else ""))
            out.append("  }" + comma)
        elif isinstance(value, dict) and len(one(value)) > 100:
            out.append("  " + json.dumps(key) + ": {")
            items = list(value.items())
            for j, (k, v) in enumerate(items):
                out.append("    " + json.dumps(k) + ": " + one(v) + ("," if j < len(items) - 1 else ""))
            out.append("  }" + comma)
        else:
            out.append("  " + json.dumps(key) + ": " + one(value) + comma)
    out.append("}")
    return "\n".join(out) + "\n"


for path in sys.argv[1:]:
    with open(path) as f:
        script = json.load(f)
    text = fmt(script)
    assert json.loads(text) == script
    with open(path, "w") as f:
        f.write(text)

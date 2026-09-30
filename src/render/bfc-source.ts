import { ensure } from "../core/types";

/** Versioned render-only BFC normalization for Three r174's missing branch state.
 * Authored text is never modified. Variants retain local colours and geometry;
 * only reference filenames and BFC commands change. Physical parts reset state.
 */
export function normalizeBfcSource(text: string) {
  const files = new Map<
    string,
    { name: string; lines: string[]; part: boolean }
  >();
  let current: { name: string; lines: string[]; part: boolean } | undefined;
  const key = (name: string) => name.trim().replace(/\\/g, "/").toLowerCase();
  for (const line of text.split(/\r?\n/)) {
    const file = line.trim().match(/^0\s+FILE\s+(.+)$/i);
    if (file) {
      current = { name: file[1], lines: [], part: false };
      files.set(key(file[1]), current);
    } else if (current && !/^0\s+NOFILE\s*$/i.test(line.trim())) {
      current.lines.push(line);
      if (/^0\s+!LDRAW_ORG\s+(?:Unofficial_)?Part(?:\s|$)/i.test(line.trim()))
        current.part = true;
    }
  }
  const first = files.values().next().value;
  if (!first) return text;
  const variants = new Map<string, { name: string; lines: string[] }>();
  let size = 0;
  const visit = (
    name: string,
    inheritedCull: boolean,
    inheritedInvert: boolean,
    depth: number,
    nonsingular = true,
  ): string => {
    ensure(depth < 64, "LIMIT_EXCEEDED", "Render BFC branch exceeds 64 levels");
    const file = files.get(key(name));
    if (!file) return name; // Existing loader reports unresolved dependencies.
    if (file.part) {
      inheritedCull = nonsingular;
      inheritedInvert = false;
    }
    const id = `${key(name)}:${inheritedCull}:${inheritedInvert}:${nonsingular}`;
    const existing = variants.get(id);
    if (existing) return existing.name;
    ensure(
      variants.size < 20000,
      "LIMIT_EXCEEDED",
      "Render BFC variant budget exceeded",
    );
    const variant = {
      name: `__bfc_v1_${variants.size}.dat`,
      lines: [] as string[],
    };
    variants.set(id, variant);
    let certified: boolean | null = null,
      clip = true,
      ccw = true,
      invertNext = false;
    for (const raw of file.lines) {
      // `0 !:` (TEXMAP) geometry is geometry to a texture-aware loader: its
      // references and winding are normalized like any other line.
      const texmapped = /^\s*0\s+!:\s?(.*)$/.exec(raw);
      const prefix =
        texmapped && /^\s*[1-5]\s/.test(texmapped[1]) ? "0 !: " : "";
      const line = (prefix ? texmapped![1] : raw).trim(),
        bfc = line.match(/^0\s+BFC\s+(.+)$/);
      if (bfc) {
        const tokens = bfc[1].split(/\s+/);
        invertNext = false;
        if (certified === false) continue;
        if (tokens.includes("NOCERTIFY")) {
          certified = false;
          continue;
        }
        certified = true;
        for (const token of tokens) {
          if (token === "CLIP") clip = true;
          if (token === "NOCLIP") clip = false;
          if (token === "CW") ccw = false;
          if (token === "CCW") ccw = true;
          if (token === "INVERTNEXT") invertNext = true;
        }
        continue;
      }
      if (/^[1-5]\s/.test(line) && certified === null) certified = false;
      const reference = line.match(/^(1\s+(?:\S+\s+){13})(.+)$/);
      if (reference) {
        const b = reference[1].trim().split(/\s+/).slice(5).map(Number);
        const determinant =
          b[0] * (b[4] * b[8] - b[5] * b[7]) -
          b[1] * (b[3] * b[8] - b[5] * b[6]) +
          b[2] * (b[3] * b[7] - b[4] * b[6]);
        const childNonsingular = nonsingular && Math.abs(determinant) > 1e-12;
        const target = visit(
          reference[2],
          inheritedCull && certified === true && clip && childNonsingular,
          inheritedInvert !== invertNext,
          depth + 1,
          childNonsingular,
        );
        variant.lines.push(prefix + reference[1] + target);
      } else {
        if (/^[34]\s/.test(line)) {
          variant.lines.push(
            `0 BFC CERTIFY ${ccw !== inheritedInvert ? "CCW" : "CW"}`,
          );
          variant.lines.push(
            inheritedCull && certified === true && clip
              ? "0 BFC CLIP"
              : "0 BFC NOCLIP",
          );
        }
        variant.lines.push(raw);
      }
      if (line) invertNext = false;
      size += raw.length + 48;
      ensure(
        size <= 100 * 1024 * 1024,
        "LIMIT_EXCEEDED",
        "Render BFC source exceeds 100 MB",
      );
    }
    return variant.name;
  };
  visit(first.name, true, false, 0);
  return [...variants.values()]
    .map((variant) => `0 FILE ${variant.name}\n${variant.lines.join("\n")}`)
    .join("\n");
}

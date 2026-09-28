import type { Vec3 } from "../core/types";

const round = (n: number) => Math.round(n * 100) / 100;
/** Distance between two LDraw points in builder units (20 LDU per stud, 8 per plate). */
export function measure(a: Vec3, b: Vec3) {
  const dx = Math.abs(b[0] - a[0]),
    dy = Math.abs(b[1] - a[1]),
    dz = Math.abs(b[2] - a[2]);
  const straight = Math.hypot(dx, dy, dz);
  const parts = [
    dx > 0.01
      ? `${round(dx / 20)} stud${round(dx / 20) === 1 ? "" : "s"} across`
      : "",
    dz > 0.01
      ? `${round(dz / 20)} stud${round(dz / 20) === 1 ? "" : "s"} deep`
      : "",
    dy > 0.01
      ? `${round(dy / 8)} plate${round(dy / 8) === 1 ? "" : "s"} ${b[1] < a[1] ? "up" : "down"}`
      : "",
  ].filter(Boolean);
  return {
    delta: [round(dx), round(dy), round(dz)] as Vec3,
    straight: round(straight),
    label:
      (parts.length ? parts.join(" · ") : "Same point") +
      ` · ${round(straight)} LDU straight`,
  };
}

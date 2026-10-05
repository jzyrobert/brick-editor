/**
 * Official library definitions the reviewed pneumatic seals read besides a
 * build's own references: the pump's two factory shortcuts (which certify its
 * barrel/cap/rod composition), the tube end and segment, and the pump's
 * official barrel, cap and rod. Kept dependency-free so the offline
 * precache (scripts/offline-plugin.ts) can list them too.
 */
export const PNEUMATIC_PLAY_LIBRARY_ROOTS = [
  "99798-f1.dat",
  "99798-f2.dat",
  "165.dat",
  "166.dat",
  "99799.dat",
  "2941.dat",
  "2944.dat",
] as const;

import type * as THREE from "three";

/** Keep the three literal source roles needed by the reviewed PF-L partition.
 * The loaded source tree, closure and complete geometry are verified separately;
 * these small loader labels never grant source or physics admission. */
export function trimPrototypeMetadata(group: THREE.Group, ref?: string) {
  const motor = ref === "99499.dat" ? group.children[0] : undefined;
  const sourceRoles = new Set(motor ? [motor, ...motor.children] : []);
  group.traverse((object) => {
    const { texmap, type, colorCode } = object.userData;
    object.userData = {
      ...(texmap ? { texmap } : {}),
      ...(sourceRoles.has(object) && (object as THREE.Group).isGroup
        ? {
            ...(typeof type === "string" ? { type } : {}),
            ...(typeof colorCode === "string" ? { colorCode } : {}),
          }
        : {}),
    };
  });
}

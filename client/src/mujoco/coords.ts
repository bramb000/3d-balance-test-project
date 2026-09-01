import * as THREE from "three";

/** MuJoCo Z-up → Three.js Y-up position */
export function mujocoPosToThree(
  x: number,
  y: number,
  z: number,
  target = new THREE.Vector3()
): THREE.Vector3 {
  return target.set(x, z, -y);
}

/** MuJoCo 3x3 row-major geom_xmat → Three.js Quaternion */
export function mujocoMatToThree(
  mat: Float64Array | number[],
  offset: number,
  target = new THREE.Quaternion()
): THREE.Quaternion {
  const m = new THREE.Matrix4();
  // MuJoCo (X,Y,Z) → Three (X,Z,-Y)
  const r00 = mat[offset];
  const r01 = mat[offset + 1];
  const r02 = mat[offset + 2];
  const r10 = mat[offset + 3];
  const r11 = mat[offset + 4];
  const r12 = mat[offset + 5];
  const r20 = mat[offset + 6];
  const r21 = mat[offset + 7];
  const r22 = mat[offset + 8];

  m.set(
    r00, r02, -r01, 0,
    r20, r22, -r21, 0,
    -r10, -r12, r11, 0,
    0, 0, 0, 1
  );
  return target.setFromRotationMatrix(m);
}

export const MJ_GEOM_PLANE = 0;
export const MJ_GEOM_HFIELD = 1;
export const MJ_GEOM_SPHERE = 2;
export const MJ_GEOM_CAPSULE = 3;
export const MJ_GEOM_CYLINDER = 5;
export const MJ_GEOM_BOX = 6;

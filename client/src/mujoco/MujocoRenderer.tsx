import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  MJ_GEOM_BOX,
  MJ_GEOM_CAPSULE,
  MJ_GEOM_CYLINDER,
  MJ_GEOM_HFIELD,
  MJ_GEOM_SPHERE,
  mujocoMatToThree,
  mujocoPosToThree,
} from "./coords";
import { simStep } from "./simStep";
import { getTorsoPosition } from "../physics/applyControls";
import type { MjData, MjModel, MjModule } from "./types";

type GeomVisual = {
  mesh: THREE.Object3D;
  geomId: number;
  isHfield: boolean;
};

function buildHfieldMesh(model: MjModel, geomId: number): THREE.Mesh {
  const dataId = model.geom_dataid[geomId];
  const nrow = model.hfield_nrow[dataId];
  const ncol = model.hfield_ncol[dataId];
  const size = model.hfield_size;
  const offset = dataId * 4;
  const halfX = size[offset];
  const halfY = size[offset + 1];
  const elev = size[offset + 2];
  const base = size[offset + 3];

  const data = model.hfield_data;
  let dataStart = 0;
  for (let i = 0; i < dataId; i++) {
    dataStart += model.hfield_nrow[i] * model.hfield_ncol[i];
  }

  const geo = new THREE.PlaneGeometry(halfX * 2, halfY * 2, ncol - 1, nrow - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const col = Math.round(((x / (halfX * 2)) + 0.5) * (ncol - 1));
    const row = Math.round(((z / (halfY * 2)) + 0.5) * (nrow - 1));
    const idx = Math.min(row, nrow - 1) * ncol + Math.min(col, ncol - 1);
    const hNorm = data[dataStart + idx] ?? 0;
    pos.setY(i, hNorm * elev + base);
  }
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: "#3a5a40", roughness: 0.9 })
  );
  mesh.receiveShadow = true;
  // Hfield geom transform is identity at origin; don't double-apply geom_xpos
  mesh.userData.skipTransform = true;
  return mesh;
}

function buildGeomMesh(model: MjModel, geomId: number): THREE.Object3D | null {
  const type = model.geom_type[geomId];
  const size = model.geom_size;
  const rgba = model.geom_rgba;
  const si = geomId * 3;
  const ri = geomId * 4;

  const color = new THREE.Color(rgba[ri], rgba[ri + 1], rgba[ri + 2]);
  if (rgba[ri + 3] < 0.01) return null;
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.45,
    metalness: type === MJ_GEOM_CAPSULE ? 0.3 : 0.1,
    transparent: rgba[ri + 3] < 1,
    opacity: rgba[ri + 3],
  });

  let geo: THREE.BufferGeometry;
  switch (type) {
    case MJ_GEOM_SPHERE:
      geo = new THREE.SphereGeometry(size[si], 16, 16);
      break;
    case MJ_GEOM_CAPSULE: {
      const r = size[si];
      const h = size[si + 1] * 2;
      geo = new THREE.CapsuleGeometry(r, Math.max(h - 2 * r, 0.01), 8, 16);
      break;
    }
    case MJ_GEOM_CYLINDER:
      geo = new THREE.CylinderGeometry(size[si], size[si], size[si + 1] * 2, 12);
      break;
    case MJ_GEOM_BOX:
      geo = new THREE.BoxGeometry(size[si] * 2, size[si + 1] * 2, size[si + 2] * 2);
      break;
    case MJ_GEOM_HFIELD:
      return buildHfieldMesh(model, geomId);
    default:
      return null;
  }

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

type Props = {
  mujoco: MjModule;
  model: MjModel;
  data: MjData;
  onTiltChange: (tilt: number) => void;
  onTorsoPos?: (pos: THREE.Vector3) => void;
};

export function MujocoRenderer({
  mujoco,
  model,
  data,
  onTiltChange,
  onTorsoPos,
}: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const visualsRef = useRef<GeomVisual[]>([]);
  const posVec = useMemo(() => new THREE.Vector3(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    while (group.children.length) group.remove(group.children[0]);

    const visuals: GeomVisual[] = [];
    for (let g = 0; g < model.ngeom; g++) {
      const obj = buildGeomMesh(model, g);
      if (!obj) continue;
      const type = model.geom_type[g];
      group.add(obj);
      visuals.push({
        mesh: obj,
        geomId: g,
        isHfield: type === MJ_GEOM_HFIELD,
      });
    }
    visualsRef.current = visuals;

    return () => {
      visuals.forEach(({ mesh }) => {
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      });
    };
  }, [model]);

  useFrame(() => {
    const geomXpos = data.geom_xpos as Float64Array;
    const geomXmat = data.geom_xmat as Float64Array;

    for (const { mesh, geomId, isHfield } of visualsRef.current) {
      if (isHfield || mesh.userData.skipTransform) {
        mesh.position.set(0, 0, 0);
        mesh.quaternion.identity();
        continue;
      }
      const p = geomId * 3;
      const m = geomId * 9;
      mujocoPosToThree(geomXpos[p], geomXpos[p + 1], geomXpos[p + 2], posVec);
      mujocoMatToThree(geomXmat, m, quat);
      mesh.position.copy(posVec);
      mesh.quaternion.copy(quat);
    }

    const tilt = simStep(mujoco, model, data);
    onTiltChange(tilt);

    if (onTorsoPos) {
      const [tx, ty, tz] = getTorsoPosition(data, model);
      onTorsoPos(mujocoPosToThree(tx, ty, tz, new THREE.Vector3()));
    }
  });

  return <group ref={groupRef} />;
}

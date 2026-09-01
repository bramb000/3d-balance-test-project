import { useMemo } from "react";
import * as THREE from "three";
import { RigidBody, HeightfieldCollider } from "@react-three/rapier";
import { generateHeightmap, TERRAIN_SEGMENTS, TERRAIN_SIZE } from "../physics/terrain";

export function Terrain() {
  const { heights, rows, cols, scale } = useMemo(() => generateHeightmap(), []);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      TERRAIN_SIZE,
      TERRAIN_SIZE,
      TERRAIN_SEGMENTS,
      TERRAIN_SEGMENTS
    );
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const col = Math.round(((x / TERRAIN_SIZE) + 0.5) * TERRAIN_SEGMENTS);
      const row = Math.round(((z / TERRAIN_SIZE) + 0.5) * TERRAIN_SEGMENTS);
      const idx = Math.min(row, rows - 1) * cols + Math.min(col, cols - 1);
      pos.setY(i, heights[idx] ?? 0);
    }
    geo.computeVertexNormals();
    return geo;
  }, [heights, rows, cols]);

  return (
    <RigidBody type="fixed" colliders={false} friction={1.2}>
      <HeightfieldCollider
        args={[rows - 1, cols - 1, heights as unknown as number[], scale]}
      />
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial color="#3a5a40" roughness={0.9} />
      </mesh>
    </RigidBody>
  );
}

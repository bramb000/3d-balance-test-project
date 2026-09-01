import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import type { ControlPacket } from "@balance/shared";
import { setLatestControl } from "../physics/applyControls";
import { MujocoRenderer } from "../mujoco/MujocoRenderer";
import type { MujocoState } from "../mujoco/types";

function FollowCamera({ targetRef }: { targetRef: React.RefObject<THREE.Vector3> }) {
  const { camera } = useThree();
  const desired = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const target = targetRef.current ?? { x: 0, y: 3, z: 0 };
    desired.set(target.x, target.y + 4, target.z + 8);
    camera.position.lerp(desired, 0.05);
    camera.lookAt(target.x, target.y, target.z);
  });

  return null;
}

type SceneProps = {
  simState: MujocoState;
  onTiltChange: (tilt: number) => void;
  controlRef: React.MutableRefObject<ControlPacket | null>;
  torsoTargetRef: React.RefObject<THREE.Vector3>;
};

function SceneContent({
  simState,
  onTiltChange,
  controlRef,
  torsoTargetRef,
}: SceneProps) {
  useFrame(() => {
    if (controlRef.current) {
      setLatestControl(controlRef.current);
    }
  });

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[10, 15, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <Sky sunPosition={[10, 15, 5]} />
      <MujocoRenderer
        mujoco={simState.mujoco}
        model={simState.model}
        data={simState.data}
        onTiltChange={onTiltChange}
        onTorsoPos={(pos) => {
          if (torsoTargetRef.current) {
            torsoTargetRef.current.copy(pos);
          }
        }}
      />
      <FollowCamera targetRef={torsoTargetRef} />
    </>
  );
}

type DisplaySceneProps = {
  simState: MujocoState | null;
  onTiltChange: (tilt: number) => void;
  controlRef: React.MutableRefObject<ControlPacket | null>;
};

export function DisplayScene({
  simState,
  onTiltChange,
  controlRef,
}: DisplaySceneProps) {
  const torsoTargetRef = useRef(new THREE.Vector3(0, 3, 0));

  if (!simState) return null;

  return (
    <Canvas
      shadows
      camera={{ position: [0, 5, 10], fov: 50 }}
      style={{ width: "100%", height: "100%" }}
    >
      <Suspense fallback={null}>
        <SceneContent
          simState={simState}
          onTiltChange={onTiltChange}
          controlRef={controlRef}
          torsoTargetRef={torsoTargetRef}
        />
      </Suspense>
    </Canvas>
  );
}

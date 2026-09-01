import { Suspense, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import { Terrain } from "./Terrain";
import { Robot } from "./Robot";
import type { ControlPacket } from "@balance/shared";
import { setLatestControl } from "../physics/applyControls";

function FollowCamera() {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 3, 0));
  const desired = useRef(new THREE.Vector3(0, 5, 10));

  useFrame(() => {
    desired.current.set(
      target.current.x,
      target.current.y + 4,
      target.current.z + 8
    );
    camera.position.lerp(desired.current, 0.05);
    camera.lookAt(target.current);
  });

  return null;
}

type SceneProps = {
  legCount: number;
  onTiltChange: (tilt: number) => void;
  controlRef: React.MutableRefObject<ControlPacket | null>;
};

function SceneContent({ legCount, onTiltChange, controlRef }: SceneProps) {
  useFrame(() => {
    if (controlRef.current) {
      setLatestControl(controlRef.current);
    }
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 15, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <Sky sunPosition={[10, 15, 5]} />
      <Terrain />
      <Robot key={legCount} legCount={legCount} onTiltChange={onTiltChange} />
      <FollowCamera />
    </>
  );
}

type DisplaySceneProps = {
  legCount: number;
  onTiltChange: (tilt: number) => void;
  controlRef: React.MutableRefObject<ControlPacket | null>;
};

export function DisplayScene({ legCount, onTiltChange, controlRef }: DisplaySceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 5, 10], fov: 50 }}
      style={{ width: "100%", height: "100%" }}
    >
      <Suspense fallback={null}>
        <Physics gravity={[0, -9.81, 0]} timeStep="vary">
          <SceneContent
            legCount={legCount}
            onTiltChange={onTiltChange}
            controlRef={controlRef}
          />
        </Physics>
      </Suspense>
    </Canvas>
  );
}

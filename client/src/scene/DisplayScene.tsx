import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import type { ControlPacket } from "@balance/shared";
import type { CameraMode } from "../config/controls";
import { setLatestControl } from "../physics/applyControls";
import { setViewFrame, threeBasisToMuJoCo } from "../physics/viewFrame";
import { MujocoRenderer } from "../mujoco/MujocoRenderer";
import type { MujocoState } from "../mujoco/types";

export type TorsoState = {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  yaw: number;
};

function updateViewFrameFromCamera(camera: THREE.Camera): void {
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
  forward.normalize();

  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  right.normalize();

  const mj = threeBasisToMuJoCo(
    { x: forward.x, z: forward.z },
    { x: right.x, z: right.z }
  );
  setViewFrame(mj.forward, mj.right);
}

function RobotCamera({
  mode,
  torsoRef,
}: {
  mode: CameraMode;
  torsoRef: React.RefObject<TorsoState | null>;
}) {
  const { camera } = useThree();
  const desired = useMemo(() => new THREE.Vector3(), []);
  const lookAt = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const eyeOffset = useMemo(() => new THREE.Vector3(0, 0.42, 0), []);

  useFrame(() => {
    const torso = torsoRef.current;
    if (!torso) return;

    if (mode === "first") {
      desired.copy(eyeOffset).applyQuaternion(torso.quat).add(torso.pos);
      forward.set(0, 0, -1).applyQuaternion(torso.quat).normalize();
      lookAt.copy(desired).add(forward.multiplyScalar(3));
      camera.position.lerp(desired, 0.35);
    } else {
      forward.set(0, 0, -1).applyQuaternion(torso.quat);
      forward.y = 0;
      if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
      forward.normalize();
      desired
        .copy(torso.pos)
        .addScaledVector(forward, -5)
        .add(new THREE.Vector3(0, 2.8, 0));
      lookAt.copy(torso.pos).add(new THREE.Vector3(0, 0.35, 0));
      camera.position.lerp(desired, 0.08);
    }

    camera.lookAt(lookAt);
    updateViewFrameFromCamera(camera);
  });

  return null;
}

type SceneProps = {
  simState: MujocoState;
  cameraMode: CameraMode;
  onTiltChange: (tilt: number) => void;
  controlRef: React.MutableRefObject<ControlPacket | null>;
  torsoRef: React.RefObject<TorsoState | null>;
};

function SceneContent({
  simState,
  cameraMode,
  onTiltChange,
  controlRef,
  torsoRef,
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
        onTorsoUpdate={(torso) => {
          if (torsoRef.current) {
            torsoRef.current.pos.copy(torso.pos);
            torsoRef.current.quat.copy(torso.quat);
            torsoRef.current.yaw = torso.yaw;
          }
        }}
      />
      <RobotCamera mode={cameraMode} torsoRef={torsoRef} />
    </>
  );
}

type DisplaySceneProps = {
  simState: MujocoState | null;
  cameraMode: CameraMode;
  onTiltChange: (tilt: number) => void;
  controlRef: React.MutableRefObject<ControlPacket | null>;
};

export function DisplayScene({
  simState,
  cameraMode,
  onTiltChange,
  controlRef,
}: DisplaySceneProps) {
  const torsoRef = useRef<TorsoState>({
    pos: new THREE.Vector3(0, 3, 0),
    quat: new THREE.Quaternion(),
    yaw: 0,
  });

  if (!simState) return null;

  return (
    <Canvas
      shadows
      camera={{ position: [0, 5, 10], fov: modeFov(cameraMode) }}
      style={{ width: "100%", height: "100%" }}
    >
      <Suspense fallback={null}>
        <SceneContent
          simState={simState}
          cameraMode={cameraMode}
          onTiltChange={onTiltChange}
          controlRef={controlRef}
          torsoRef={torsoRef}
        />
      </Suspense>
    </Canvas>
  );
}

function modeFov(mode: CameraMode): number {
  return mode === "first" ? 72 : 50;
}

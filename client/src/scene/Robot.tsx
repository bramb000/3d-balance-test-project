import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  RigidBody,
  CapsuleCollider,
  BallCollider,
  CylinderCollider,
  useRevoluteJoint,
  RapierRigidBody,
} from "@react-three/rapier";
import {
  BODY_MASS,
  BODY_RADIUS,
  BODY_HEIGHT,
  UPPER_LEG_LENGTH,
  LOWER_LEG_LENGTH,
  FOOT_RADIUS,
} from "../config/controls";
import { applyControls } from "../physics/applyControls";
import {
  getLegAngles,
  getRobotSpawnPosition,
} from "../physics/robotFactory";
import { getTerrainHeight } from "../physics/terrain";

type LegRefs = {
  upper: React.RefObject<RapierRigidBody>;
  lower: React.RefObject<RapierRigidBody>;
  foot: React.RefObject<RapierRigidBody>;
};

function LegSegment({
  bodyRef,
  attachAngle,
  legIndex,
  onRefs,
}: {
  bodyRef: React.RefObject<RapierRigidBody>;
  attachAngle: number;
  legIndex: number;
  onRefs: (index: number, refs: LegRefs) => void;
}) {
  const upperRef = useRef<RapierRigidBody>(null);
  const lowerRef = useRef<RapierRigidBody>(null);
  const footRef = useRef<RapierRigidBody>(null);

  const attachX = Math.cos(attachAngle) * (BODY_RADIUS * 0.9);
  const attachZ = Math.sin(attachAngle) * (BODY_RADIUS * 0.9);
  const spawnY = getTerrainHeight(attachX, attachZ) + BODY_HEIGHT + UPPER_LEG_LENGTH + LOWER_LEG_LENGTH;

  useEffect(() => {
    onRefs(legIndex, { upper: upperRef, lower: lowerRef, foot: footRef });
  }, [legIndex, onRefs]);

  useRevoluteJoint(bodyRef, upperRef, [
    [attachX, -BODY_HEIGHT / 2, attachZ],
    [0, UPPER_LEG_LENGTH / 2, 0],
    [1, 0, 0],
  ]);

  useRevoluteJoint(upperRef, lowerRef, [
    [0, -UPPER_LEG_LENGTH / 2, 0],
    [0, LOWER_LEG_LENGTH / 2, 0],
    [1, 0, 0],
  ]);

  useRevoluteJoint(lowerRef, footRef, [
    [0, -LOWER_LEG_LENGTH / 2, 0],
    [0, 0, 0],
    [1, 0, 0],
  ]);

  return (
    <group>
      <RigidBody
        ref={upperRef}
        position={[attachX, spawnY - LOWER_LEG_LENGTH - UPPER_LEG_LENGTH / 2, attachZ]}
        colliders={false}
        mass={0.3}
      >
        <CylinderCollider args={[UPPER_LEG_LENGTH / 2, 0.06]} />
        <mesh castShadow>
          <cylinderGeometry args={[0.06, 0.05, UPPER_LEG_LENGTH, 8]} />
          <meshStandardMaterial color="#6b7280" />
        </mesh>
      </RigidBody>

      <RigidBody
        ref={lowerRef}
        position={[attachX, spawnY - LOWER_LEG_LENGTH / 2, attachZ]}
        colliders={false}
        mass={0.25}
      >
        <CylinderCollider args={[LOWER_LEG_LENGTH / 2, 0.05]} />
        <mesh castShadow>
          <cylinderGeometry args={[0.05, 0.04, LOWER_LEG_LENGTH, 8]} />
          <meshStandardMaterial color="#4b5563" />
        </mesh>
      </RigidBody>

      <RigidBody
        ref={footRef}
        position={[attachX, spawnY, attachZ]}
        colliders={false}
        mass={0.15}
        friction={1.5}
      >
        <BallCollider args={[FOOT_RADIUS]} />
        <mesh castShadow>
          <sphereGeometry args={[FOOT_RADIUS, 8, 8]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
      </RigidBody>
    </group>
  );
}

type RobotProps = {
  legCount: number;
  onTiltChange?: (tilt: number) => void;
};

export function Robot({ legCount, onTiltChange }: RobotProps) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const legRefsMap = useRef<Map<number, LegRefs>>(new Map());

  const angles = useMemo(() => getLegAngles(legCount), [legCount]);

  const spawnPos = useMemo(() => getRobotSpawnPosition(), [legCount]);

  const handleLegRefs = useMemo(
    () => (index: number, refs: LegRefs) => {
      legRefsMap.current.set(index, refs);
    },
    []
  );

  useFrame(() => {
    if (bodyRef.current) {
      applyControls(bodyRef.current);
      if (onTiltChange) {
        const rot = bodyRef.current.rotation();
        const upY = 1 - 2 * (rot.x * rot.x + rot.z * rot.z);
        const tilt = Math.acos(Math.min(1, Math.max(-1, upY))) * (180 / Math.PI);
        onTiltChange(tilt);
      }
    }
  });

  return (
    <group>
      <RigidBody
        ref={bodyRef}
        position={spawnPos}
        colliders={false}
        mass={BODY_MASS}
        linearDamping={0.5}
        angularDamping={1.5}
      >
        <CapsuleCollider args={[BODY_HEIGHT / 2, BODY_RADIUS]} />
        <mesh castShadow>
          <capsuleGeometry args={[BODY_RADIUS, BODY_HEIGHT, 8, 16]} />
          <meshStandardMaterial color="#6366f1" metalness={0.3} roughness={0.4} />
        </mesh>
      </RigidBody>

      {angles.map((angle, i) => (
        <LegSegment
          key={`${legCount}-${i}`}
          bodyRef={bodyRef}
          attachAngle={angle}
          legIndex={i}
          onRefs={handleLegRefs}
        />
      ))}
    </group>
  );
}

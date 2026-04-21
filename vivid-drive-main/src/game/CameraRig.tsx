import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { CarHandle } from "./Car";

export type CameraMode = "chase" | "hood" | "cockpit" | "cinematic";

type Props = {
  carRef: React.MutableRefObject<CarHandle | null>;
  mode: CameraMode;
};

export default function CameraRig({ carRef, mode }: Props) {
  const { camera } = useThree();
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const targetLook = useMemo(() => new THREE.Vector3(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const cineTimer = useRef(0);
  const cineAngle = useRef(0);

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 60;
      camera.updateProjectionMatrix();
    }
  }, [camera, mode]);

  useFrame((_, dt) => {
    const car = carRef.current;
    if (!car || !car.group) return;
    const g = car.group;
    const speed = car.speed;

    if (mode === "chase") {
      offset.set(0, 3.2, 8).applyQuaternion(g.quaternion);
      targetPos.copy(g.position).add(offset);
      targetLook.copy(g.position).add(new THREE.Vector3(0, 1.2, 0));
      camera.position.lerp(targetPos, Math.min(1, dt * 6));
      camera.lookAt(targetLook);
      if (camera instanceof THREE.PerspectiveCamera) {
        const targetFov = 60 + Math.min(20, speed * 0.6);
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
        camera.updateProjectionMatrix();
      }
    } else if (mode === "hood") {
      offset.set(0, 1.1, -1.6).applyQuaternion(g.quaternion);
      targetPos.copy(g.position).add(offset);
      targetLook.copy(g.position).add(
        new THREE.Vector3(0, 0.8, -10).applyQuaternion(g.quaternion),
      );
      camera.position.copy(targetPos);
      camera.lookAt(targetLook);
    } else if (mode === "cockpit") {
      offset.set(0, 1.25, 0.2).applyQuaternion(g.quaternion);
      targetPos.copy(g.position).add(offset);
      targetLook.copy(g.position).add(
        new THREE.Vector3(0, 1.0, -10).applyQuaternion(g.quaternion),
      );
      camera.position.copy(targetPos);
      camera.lookAt(targetLook);
    } else if (mode === "cinematic") {
      cineTimer.current += dt;
      cineAngle.current += dt * 0.3;
      const radius = 12 + Math.sin(cineTimer.current * 0.3) * 4;
      const height = 3 + Math.sin(cineTimer.current * 0.5) * 1.5;
      targetPos.set(
        g.position.x + Math.cos(cineAngle.current) * radius,
        g.position.y + height,
        g.position.z + Math.sin(cineAngle.current) * radius,
      );
      camera.position.lerp(targetPos, Math.min(1, dt * 2));
      camera.lookAt(g.position.x, g.position.y + 0.8, g.position.z);
    }
  });

  return null;
}

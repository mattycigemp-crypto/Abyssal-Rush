import { useRef, useImperativeHandle, forwardRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Keys } from "./useKeyboard";

export type CarHandle = {
  group: THREE.Group;
  velocity: THREE.Vector3;
  speed: number;
  reset: () => void;
};

type Props = {
  keys: React.MutableRefObject<Keys>;
  onTelemetry?: (t: { speed: number; rpm: number; gear: number; airborne: boolean }) => void;
};

const Car = forwardRef<CarHandle, Props>(({ keys, onTelemetry }, ref) => {
  const group = useRef<THREE.Group>(null!);
  const wheelsRef = useRef<THREE.Mesh[]>([]);
  const steerRef = useRef<THREE.Group[]>([]);
  const brakeLightRef = useRef<THREE.MeshStandardMaterial>(null!);

  const state = useMemo(
    () => ({
      velocity: new THREE.Vector3(),
      angularY: 0,
      steer: 0,
      airborne: false,
      yVel: 0,
      y: 0.5,
    }),
    [],
  );

  const tmp = useMemo(() => new THREE.Vector3(), []);
  const forwardVec = useMemo(() => new THREE.Vector3(), []);

  useImperativeHandle(ref, () => ({
    get group() {
      return group.current;
    },
    get velocity() {
      return state.velocity;
    },
    get speed() {
      return state.velocity.length();
    },
    reset: () => {
      if (!group.current) return;
      group.current.position.set(0, 1, 0);
      group.current.rotation.set(0, 0, 0);
      state.velocity.set(0, 0, 0);
      state.yVel = 0;
      state.y = 0.5;
    },
  }));

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const k = keys.current;
    const delta = Math.min(dt, 0.05);

    // Steering with speed-sensitive damping
    const speed = state.velocity.length();
    const steerInput = (k.left ? 1 : 0) - (k.right ? 1 : 0);
    const maxSteer = 0.55 - Math.min(0.35, speed * 0.012);
    const targetSteer = steerInput * maxSteer;
    state.steer += (targetSteer - state.steer) * Math.min(1, delta * 8);

    // Throttle / brake
    const throttle = (k.forward ? 1 : 0) - (k.back ? 1 : 0);
    const boost = k.boost ? 1.6 : 1;

    // Forward direction
    forwardVec.set(0, 0, -1).applyQuaternion(g.quaternion);

    const forwardSpeed = state.velocity.dot(forwardVec);

    // Engine force
    const engineAccel = throttle * 18 * boost;
    tmp.copy(forwardVec).multiplyScalar(engineAccel * delta);
    state.velocity.add(tmp);

    // Handbrake
    if (k.brake) {
      state.velocity.multiplyScalar(Math.pow(0.2, delta));
    }

    // Drag + rolling resistance
    const drag = 0.6 + (k.brake ? 4 : 0);
    state.velocity.x *= Math.pow(1 / (1 + drag * 0.2), delta);
    state.velocity.z *= Math.pow(1 / (1 + drag * 0.2), delta);

    // Lateral friction (grip) — kill sideways velocity
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(g.quaternion);
    const lateral = state.velocity.dot(right);
    const grip = k.brake ? 0.92 : 0.06;
    const latReduction = lateral * (1 - Math.pow(grip, delta * 60));
    state.velocity.addScaledVector(right, -latReduction);

    // Steering rotates car based on speed
    const turnRate = state.steer * Math.min(1, Math.abs(forwardSpeed) / 4) * 1.4;
    g.rotation.y += turnRate * delta * Math.sign(forwardSpeed || 1);

    // Gravity / ground
    state.yVel -= 22 * delta;
    state.y += state.yVel * delta;
    if (state.y <= 0.5) {
      state.y = 0.5;
      state.yVel = 0;
      state.airborne = false;
    } else {
      state.airborne = true;
    }

    // Apply position
    g.position.x += state.velocity.x * delta;
    g.position.z += state.velocity.z * delta;
    g.position.y = state.y;

    // Body lean (roll/pitch) based on accel
    const targetRoll = -state.steer * 0.15 * Math.min(1, speed / 10);
    const targetPitch = -throttle * 0.04;
    g.children[0].rotation.z += (targetRoll - g.children[0].rotation.z) * Math.min(1, delta * 6);
    g.children[0].rotation.x += (targetPitch - g.children[0].rotation.x) * Math.min(1, delta * 6);

    // Wheel spin
    const spin = forwardSpeed * delta * 2;
    wheelsRef.current.forEach((w) => {
      if (w) w.rotation.x -= spin;
    });
    // Steering wheels
    steerRef.current.forEach((s) => {
      if (s) s.rotation.y = state.steer;
    });

    // Brake light
    if (brakeLightRef.current) {
      brakeLightRef.current.emissiveIntensity = k.brake || k.back ? 4 : 0.4;
    }

    if (k.reset) {
      g.position.set(0, 1, 0);
      g.rotation.set(0, 0, 0);
      state.velocity.set(0, 0, 0);
      state.yVel = 0;
      state.y = 0.5;
    }

    onTelemetry?.({
      speed: speed * 3.6, // m/s -> km/h-ish
      rpm: 800 + Math.min(7000, Math.abs(forwardSpeed) * 280 + (throttle > 0 ? 1500 : 0)),
      gear: Math.min(6, Math.max(1, Math.floor(Math.abs(forwardSpeed) / 8) + 1)),
      airborne: state.airborne,
    });
  });

  return (
    <group ref={group} position={[0, 0.5, 0]}>
      {/* body container for lean */}
      <group>
        {/* main body */}
        <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
          <boxGeometry args={[1.8, 0.5, 4]} />
          <meshPhysicalMaterial
            color="#c81d2a"
            metalness={0.9}
            roughness={0.25}
            clearcoat={1}
            clearcoatRoughness={0.05}
          />
        </mesh>
        {/* cabin */}
        <mesh castShadow position={[0, 0.95, -0.2]}>
          <boxGeometry args={[1.55, 0.55, 2]} />
          <meshPhysicalMaterial
            color="#1a1a1a"
            metalness={0.6}
            roughness={0.15}
            transmission={0.4}
            thickness={0.5}
          />
        </mesh>
        {/* hood accent */}
        <mesh position={[0, 0.71, 1.3]}>
          <boxGeometry args={[1.6, 0.02, 1.2]} />
          <meshStandardMaterial color="#0a0a0a" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* headlights */}
        <mesh position={[-0.65, 0.5, 2.01]}>
          <boxGeometry args={[0.35, 0.15, 0.05]} />
          <meshStandardMaterial
            color="#fffbe6"
            emissive="#fffbe6"
            emissiveIntensity={3}
          />
        </mesh>
        <mesh position={[0.65, 0.5, 2.01]}>
          <boxGeometry args={[0.35, 0.15, 0.05]} />
          <meshStandardMaterial
            color="#fffbe6"
            emissive="#fffbe6"
            emissiveIntensity={3}
          />
        </mesh>
        {/* brake lights */}
        <mesh position={[-0.6, 0.55, -2.01]}>
          <boxGeometry args={[0.4, 0.12, 0.05]} />
          <meshStandardMaterial ref={brakeLightRef} color="#ff1d2d" emissive="#ff1d2d" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0.6, 0.55, -2.01]}>
          <boxGeometry args={[0.4, 0.12, 0.05]} />
          <meshStandardMaterial color="#ff1d2d" emissive="#ff1d2d" emissiveIntensity={1} />
        </mesh>

        {/* wheels */}
        {[
          [-0.95, 0, 1.3, true],
          [0.95, 0, 1.3, true],
          [-0.95, 0, -1.3, false],
          [0.95, 0, -1.3, false],
        ].map(([x, y, z, steer], i) => (
          <group
            key={i}
            position={[x as number, y as number, z as number]}
            ref={(el) => {
              if (el && steer) steerRef.current[i] = el;
            }}
          >
            <mesh
              castShadow
              rotation={[0, 0, Math.PI / 2]}
              ref={(el) => {
                if (el) wheelsRef.current[i] = el;
              }}
            >
              <cylinderGeometry args={[0.4, 0.4, 0.3, 24]} />
              <meshStandardMaterial color="#0d0d0d" roughness={0.9} metalness={0.1} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.22, 0.22, 0.31, 16]} />
              <meshStandardMaterial color="#9aa0a6" metalness={0.9} roughness={0.25} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Real headlight cones */}
      <spotLight
        position={[-0.65, 0.55, 2]}
        angle={0.5}
        penumbra={0.4}
        intensity={30}
        distance={60}
        castShadow={false}
        target-position={[-0.65, 0, 20]}
      />
      <spotLight
        position={[0.65, 0.55, 2]}
        angle={0.5}
        penumbra={0.4}
        intensity={30}
        distance={60}
        castShadow={false}
        target-position={[0.65, 0, 20]}
      />
    </group>
  );
});

Car.displayName = "Car";
export default Car;

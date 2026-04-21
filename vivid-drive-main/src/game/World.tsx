import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// Seeded pseudo-random
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function InstancedTrees({
  count,
  area,
  centerX = 0,
  centerZ = 0,
  seed = 1,
  exclude,
}: {
  count: number;
  area: number;
  centerX?: number;
  centerZ?: number;
  seed?: number;
  exclude?: (x: number, z: number) => boolean;
}) {
  const trunkRef = useRef<THREE.InstancedMesh>(null!);
  const leavesRef = useRef<THREE.InstancedMesh>(null!);

  const positions = useMemo(() => {
    const rnd = mulberry32(seed);
    const arr: { x: number; z: number; s: number; r: number }[] = [];
    let attempts = 0;
    while (arr.length < count && attempts < count * 5) {
      attempts++;
      const x = centerX + (rnd() - 0.5) * area;
      const z = centerZ + (rnd() - 0.5) * area;
      if (exclude && exclude(x, z)) continue;
      arr.push({ x, z, s: 0.7 + rnd() * 1.4, r: rnd() * Math.PI * 2 });
    }
    return arr;
  }, [count, area, centerX, centerZ, seed, exclude]);

  useMemo(() => {
    const dummy = new THREE.Object3D();
    positions.forEach((p, i) => {
      dummy.position.set(p.x, 1.2 * p.s, p.z);
      dummy.scale.set(p.s, p.s * 1.5, p.s);
      dummy.rotation.y = p.r;
      dummy.updateMatrix();
      trunkRef.current?.setMatrixAt(i, dummy.matrix);

      dummy.position.set(p.x, 3.5 * p.s, p.z);
      dummy.scale.set(p.s * 1.6, p.s * 1.6, p.s * 1.6);
      dummy.updateMatrix();
      leavesRef.current?.setMatrixAt(i, dummy.matrix);
    });
    if (trunkRef.current) trunkRef.current.instanceMatrix.needsUpdate = true;
    if (leavesRef.current) leavesRef.current.instanceMatrix.needsUpdate = true;
  }, [positions]);

  return (
    <>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, positions.length]} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.3, 2, 6]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={leavesRef} args={[undefined, undefined, positions.length]} castShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#2d6a3a" roughness={0.85} flatShading />
      </instancedMesh>
    </>
  );
}

function InstancedRocks({
  count,
  area,
  centerX = 0,
  centerZ = 0,
  seed = 2,
  color = "#8a8478",
}: {
  count: number;
  area: number;
  centerX?: number;
  centerZ?: number;
  seed?: number;
  color?: string;
}) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const positions = useMemo(() => {
    const rnd = mulberry32(seed);
    return Array.from({ length: count }, () => ({
      x: centerX + (rnd() - 0.5) * area,
      z: centerZ + (rnd() - 0.5) * area,
      s: 0.5 + rnd() * 2.5,
      r: rnd() * Math.PI * 2,
    }));
  }, [count, area, centerX, centerZ, seed]);

  useMemo(() => {
    const dummy = new THREE.Object3D();
    positions.forEach((p, i) => {
      dummy.position.set(p.x, p.s * 0.4, p.z);
      dummy.scale.set(p.s, p.s * 0.6, p.s * 1.1);
      dummy.rotation.y = p.r;
      dummy.updateMatrix();
      ref.current?.setMatrixAt(i, dummy.matrix);
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, [positions]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, positions.length]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} roughness={0.95} flatShading />
    </instancedMesh>
  );
}

function Building({ x, z, w, d, h, color }: { x: number; z: number; w: number; d: number; h: number; color: string }) {
  return (
    <group position={[x, h / 2, z]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* windows row as emissive */}
      <mesh position={[0, 0, d / 2 + 0.01]}>
        <planeGeometry args={[w * 0.85, h * 0.85]} />
        <meshStandardMaterial
          color="#0a1a2a"
          emissive="#7ab8ff"
          emissiveIntensity={0.6}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
      <mesh position={[0, 0, -d / 2 - 0.01]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w * 0.85, h * 0.85]} />
        <meshStandardMaterial
          color="#0a1a2a"
          emissive="#ffb86b"
          emissiveIntensity={0.4}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
    </group>
  );
}

function City({ centerX, centerZ }: { centerX: number; centerZ: number }) {
  const buildings = useMemo(() => {
    const rnd = mulberry32(99);
    const arr: { x: number; z: number; w: number; d: number; h: number; color: string }[] = [];
    const grid = 6;
    const spacing = 22;
    const colors = ["#3a3f4a", "#4a4036", "#2e3a44", "#5a4e44", "#3d4655"];
    for (let i = -grid; i <= grid; i++) {
      for (let j = -grid; j <= grid; j++) {
        const x = centerX + i * spacing + (rnd() - 0.5) * 2;
        const z = centerZ + j * spacing + (rnd() - 0.5) * 2;
        // skip road corridor
        if (Math.abs(x - centerX) < 6 && Math.abs(j) < grid + 1) continue;
        if (Math.abs(z - centerZ) < 6 && Math.abs(i) < grid + 1) continue;
        const h = 8 + rnd() * 40;
        arr.push({
          x,
          z,
          w: 10 + rnd() * 4,
          d: 10 + rnd() * 4,
          h,
          color: colors[Math.floor(rnd() * colors.length)],
        });
      }
    }
    return arr;
  }, [centerX, centerZ]);

  return (
    <group>
      {buildings.map((b, i) => (
        <Building key={i} {...b} />
      ))}
    </group>
  );
}

function Ramp({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow receiveShadow rotation={[-Math.PI / 10, 0, 0]} position={[0, 1.2, 0]}>
        <boxGeometry args={[6, 0.4, 8]} />
        <meshStandardMaterial color="#d9a441" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh receiveShadow position={[0, 0.4, -3.5]}>
        <boxGeometry args={[6, 0.8, 1]} />
        <meshStandardMaterial color="#7a5a2a" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Barrels({
  positions,
  color = "#c0392b",
}: {
  positions: [number, number][];
  color?: string;
}) {
  return (
    <>
      {positions.map(([x, z], i) => (
        <mesh key={i} castShadow receiveShadow position={[x, 0.6, z]}>
          <cylinderGeometry args={[0.4, 0.4, 1.2, 16]} />
          <meshStandardMaterial color={color} roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
    </>
  );
}

function Road({ from, to, width = 8, color = "#2a2a2e" }: { from: [number, number]; to: [number, number]; width?: number; color?: string }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  const cx = (from[0] + to[0]) / 2;
  const cz = (from[1] + to[1]) / 2;
  return (
    <group position={[cx, 0.02, cz]} rotation={[0, angle, 0]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, len]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* dashed center line */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.2, len]} />
        <meshStandardMaterial color="#f5d142" emissive="#f5d142" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

export default function World() {
  // Animated ocean
  const ocean = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    if (ocean.current) {
      const m = ocean.current.material as THREE.MeshStandardMaterial;
      // subtle shimmer via offset
      if (m.normalMap) {
        m.normalMap.offset.x = clock.elapsedTime * 0.02;
        m.normalMap.offset.y = clock.elapsedTime * 0.015;
      }
    }
  });

  // Coast = (-300, 0) area, City = (300, 0), Forest = (0, 300), Desert = (0, -300)
  const excludeRoads = (x: number, z: number) => {
    // keep clear strips along main roads (X axis and Z axis)
    if (Math.abs(z) < 6) return true;
    if (Math.abs(x) < 6) return true;
    return false;
  };

  return (
    <group>
      {/* Ground (asphalt-ish base) */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[1400, 1400]} />
        <meshStandardMaterial color="#6b7a5a" roughness={1} />
      </mesh>

      {/* Ocean (west) */}
      <mesh ref={ocean} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[-700, 0.05, 0]}>
        <planeGeometry args={[800, 1400, 1, 1]} />
        <meshStandardMaterial
          color="#0a3a55"
          metalness={0.6}
          roughness={0.15}
          emissive="#0a2535"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Beach strip */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[-310, 0.04, 0]}>
        <planeGeometry args={[40, 1400]} />
        <meshStandardMaterial color="#e6d2a3" roughness={0.95} />
      </mesh>

      {/* Forest area (north) ground tint */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 350]}>
        <planeGeometry args={[600, 500]} />
        <meshStandardMaterial color="#3e5a35" roughness={1} />
      </mesh>

      {/* Desert (south) */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -350]}>
        <planeGeometry args={[700, 500]} />
        <meshStandardMaterial color="#d6a86a" roughness={1} />
      </mesh>

      {/* Roads — cross intersection */}
      <Road from={[-680, 0]} to={[680, 0]} width={10} />
      <Road from={[0, -680]} to={[0, 680]} width={10} />

      {/* Forest */}
      <InstancedTrees count={400} area={550} centerX={0} centerZ={350} seed={11} exclude={excludeRoads} />

      {/* Coast cliff rocks */}
      <InstancedRocks count={120} area={80} centerX={-330} centerZ={0} seed={3} color="#7a7268" />

      {/* Desert mesas */}
      <InstancedRocks count={60} area={500} centerX={0} centerZ={-380} seed={5} color="#a0664a" />

      {/* City */}
      <City centerX={350} centerZ={0} />

      {/* Ramps scattered */}
      <Ramp position={[40, 0, 30]} rotation={Math.PI / 2} />
      <Ramp position={[-80, 0, -40]} rotation={-Math.PI / 2} />
      <Ramp position={[0, 0, 120]} />
      <Ramp position={[150, 0, 60]} rotation={Math.PI} />

      {/* Barrels */}
      <Barrels
        positions={[
          [20, 10],
          [22, 10],
          [24, 10],
          [-30, -15],
          [-32, -15],
          [60, -25],
          [62, -25],
          [64, -25],
          [-100, 40],
          [-100, 42],
        ]}
      />

      {/* Lighthouse on coast */}
      <group position={[-320, 0, 100]}>
        <mesh castShadow position={[0, 8, 0]}>
          <cylinderGeometry args={[2, 3, 16, 16]} />
          <meshStandardMaterial color="#f4f4f4" roughness={0.6} />
        </mesh>
        <mesh position={[0, 17, 0]}>
          <cylinderGeometry args={[2.4, 2.4, 2, 16]} />
          <meshStandardMaterial color="#c81d2a" emissive="#ff5544" emissiveIntensity={1} />
        </mesh>
        <pointLight position={[0, 17, 0]} intensity={80} distance={120} color="#ffaa66" />
      </group>
    </group>
  );
}

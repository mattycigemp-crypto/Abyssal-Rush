import { Canvas } from "@react-three/fiber";
import { Sky, Stars, ContactShadows, Environment } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, SMAA } from "@react-three/postprocessing";
import * as THREE from "three";
import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import Car, { type CarHandle } from "./Car";
import World from "./World";
import CameraRig, { type CameraMode } from "./CameraRig";
import HUD from "./HUD";
import { useKeyboard } from "./useKeyboard";

const BIOME_POSITIONS: Record<string, [number, number, number]> = {
  spawn: [0, 1, 0],
  coast: [-280, 1, 50],
  city: [320, 1, 0],
  forest: [0, 1, 280],
  desert: [0, 1, -280],
};

function biomeFromPos(x: number, z: number): string {
  if (x < -150) return "Coast";
  if (x > 150) return "City";
  if (z > 150) return "Forest";
  if (z < -150) return "Desert";
  return "Crossroads";
}

export default function Game() {
  const keys = useKeyboard();
  const carRef = useRef<CarHandle | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>("chase");
  const [timeOfDay, setTimeOfDay] = useState(17.5); // sunset by default
  const [biomeLabel, setBiomeLabel] = useState("Crossroads");
  const telemetryRef = useRef({ speed: 0, rpm: 800, gear: 1, airborne: false });

  // Sun position from time of day (0-24)
  const { sunPos, sunIntensity, ambientColor, fogColor, isNight } = useMemo(() => {
    const t = timeOfDay;
    // angle: 0 = midnight (down), 12 = noon (up), 6 = sunrise (east), 18 = sunset (west)
    const sunAngle = ((t - 6) / 24) * Math.PI * 2;
    const elev = Math.sin((t - 6) * (Math.PI / 12));
    const x = Math.cos(sunAngle) * 100;
    const y = Math.max(-30, elev * 100);
    const z = Math.sin(sunAngle) * 60;
    const night = elev < 0;
    const dusk = elev > 0 && elev < 0.25;
    const intensity = night ? 0.05 : Math.max(0.3, elev * 2.5);
    let amb = "#9ab8d6";
    let fog = "#b8c8d8";
    if (night) {
      amb = "#1a2540";
      fog = "#0a1020";
    } else if (dusk) {
      amb = "#ff9a6b";
      fog = "#ff8a55";
    }
    return {
      sunPos: [x, y, z] as [number, number, number],
      sunIntensity: intensity,
      ambientColor: amb,
      fogColor: fog,
      isNight: night,
    };
  }, [timeOfDay]);

  const cycleCamera = useCallback(() => {
    setCameraMode((m) => {
      const order: CameraMode[] = ["chase", "hood", "cockpit", "cinematic"];
      return order[(order.indexOf(m) + 1) % order.length];
    });
  }, []);

  const teleport = useCallback((biome: string) => {
    const car = carRef.current;
    if (!car || !car.group) return;
    const pos = BIOME_POSITIONS[biome] ?? BIOME_POSITIONS.spawn;
    car.group.position.set(pos[0], pos[1], pos[2]);
    car.group.rotation.set(0, 0, 0);
    car.velocity.set(0, 0, 0);
  }, []);

  // Update biome label periodically
  useEffect(() => {
    const id = setInterval(() => {
      const car = carRef.current;
      if (car?.group) {
        setBiomeLabel(biomeFromPos(car.group.position.x, car.group.position.z));
      }
    }, 400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 bg-black">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{
          antialias: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: isNight ? 1.2 : 1.0,
          powerPreference: "high-performance",
        }}
        camera={{ position: [0, 5, 12], fov: 60, near: 0.1, far: 2000 }}
      >
        <color attach="background" args={[isNight ? "#020616" : "#87b8e0"]} />
        <fog attach="fog" args={[fogColor, 120, 900]} />

        {/* Sky */}
        {!isNight && (
          <Sky
            distance={4500}
            sunPosition={sunPos}
            inclination={0.5}
            azimuth={0.25}
            mieCoefficient={0.005}
            mieDirectionalG={0.85}
            rayleigh={timeOfDay > 16 || timeOfDay < 7 ? 4 : 1.2}
            turbidity={timeOfDay > 16 || timeOfDay < 7 ? 8 : 4}
          />
        )}
        {isNight && <Stars radius={300} depth={60} count={6000} factor={4} saturation={0} fade speed={0.5} />}

        {/* Lighting */}
        <ambientLight color={ambientColor} intensity={isNight ? 0.4 : 0.55} />
        <hemisphereLight args={[isNight ? "#2a3a55" : "#bcd4ff", "#2a2418", 0.5]} />
        <directionalLight
          castShadow
          position={sunPos}
          intensity={sunIntensity * 3}
          color={
            timeOfDay > 16.5 || timeOfDay < 7
              ? isNight
                ? "#6b8cc4"
                : "#ffb070"
              : "#ffffff"
          }
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={120}
          shadow-camera-left={-60}
          shadow-camera-right={60}
          shadow-camera-top={60}
          shadow-camera-bottom={-60}
          shadow-bias={-0.0005}
        />

        <Environment preset={isNight ? "night" : timeOfDay > 16 ? "sunset" : "city"} />

        <World />
        <Car ref={carRef} keys={keys} onTelemetry={(t) => (telemetryRef.current = t)} />
        <CameraRig carRef={carRef} mode={cameraMode} />

        <ContactShadows position={[0, 0.01, 0]} opacity={0.6} scale={30} blur={2.5} far={20} />

        <EffectComposer multisampling={0}>
          <SMAA />
          <Bloom
            intensity={isNight ? 1.2 : 0.5}
            luminanceThreshold={isNight ? 0.2 : 0.85}
            luminanceSmoothing={0.2}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.2} darkness={0.7} />
        </EffectComposer>
      </Canvas>

      <HUD
        telemetryRef={telemetryRef}
        cameraMode={cameraMode}
        onCycleCamera={cycleCamera}
        timeOfDay={timeOfDay}
        onTimeChange={setTimeOfDay}
        biome={biomeLabel}
        onTeleport={teleport}
      />
    </div>
  );
}

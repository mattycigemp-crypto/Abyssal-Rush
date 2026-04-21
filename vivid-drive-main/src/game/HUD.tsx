import { useEffect, useState } from "react";
import type { CameraMode } from "./CameraRig";

type Telemetry = { speed: number; rpm: number; gear: number; airborne: boolean };

type Props = {
  telemetryRef: React.MutableRefObject<Telemetry>;
  cameraMode: CameraMode;
  onCycleCamera: () => void;
  timeOfDay: number;
  onTimeChange: (v: number) => void;
  biome: string;
  onTeleport: (b: string) => void;
};

const cameraLabels: Record<CameraMode, string> = {
  chase: "Chase",
  hood: "Hood",
  cockpit: "Cockpit",
  cinematic: "Cinematic",
};

export default function HUD({
  telemetryRef,
  cameraMode,
  onCycleCamera,
  timeOfDay,
  onTimeChange,
  biome,
  onTeleport,
}: Props) {
  const [tick, setTick] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let raf: number;
    const loop = () => {
      setTick((t) => (t + 1) % 1000000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyC") onCycleCamera();
      if (e.code === "Escape" || e.code === "KeyP") setMenuOpen((m) => !m);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCycleCamera]);

  const t = telemetryRef.current;
  const speed = Math.round(Math.abs(t.speed));
  const rpm = Math.round(t.rpm);
  const rpmPct = Math.min(1, rpm / 8000);
  const speedPct = Math.min(1, speed / 260);
  // unused-tick suppressor
  void tick;

  const biomes = [
    { id: "spawn", label: "Spawn" },
    { id: "coast", label: "Coast" },
    { id: "city", label: "City" },
    { id: "forest", label: "Forest" },
    { id: "desert", label: "Desert" },
  ];

  return (
    <div className="pointer-events-none fixed inset-0 select-none font-mono text-white">
      {/* Top bar */}
      <div className="pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/40 px-4 py-2 text-xs uppercase tracking-widest backdrop-blur-md">
        <span className="opacity-70">Biome</span>
        <span className="font-bold text-amber-300">{biome}</span>
        <span className="opacity-30">|</span>
        <button
          onClick={onCycleCamera}
          className="rounded-full bg-white/10 px-3 py-1 transition hover:bg-white/20"
          aria-label="Cycle camera"
        >
          📷 {cameraLabels[cameraMode]}
        </button>
        <button
          onClick={() => setMenuOpen((m) => !m)}
          className="rounded-full bg-white/10 px-3 py-1 transition hover:bg-white/20"
        >
          ☰ Menu
        </button>
      </div>

      {/* Speedometer (bottom right) */}
      <div className="absolute bottom-6 right-6 flex items-end gap-4">
        <div className="rounded-2xl border border-white/10 bg-black/50 px-5 py-3 backdrop-blur-md">
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">Speed</div>
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold tabular-nums text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]">
              {speed}
            </span>
            <span className="text-xs text-white/60">km/h</span>
          </div>
          <div className="mt-1 h-1 w-40 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 via-amber-300 to-rose-500 transition-[width] duration-100"
              style={{ width: `${speedPct * 100}%` }}
            />
          </div>
          <div className="mt-3 text-[10px] uppercase tracking-[0.3em] text-white/50">RPM</div>
          <div className="mt-1 h-1 w-40 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-sky-400 to-rose-500 transition-[width] duration-75"
              style={{ width: `${rpmPct * 100}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-white/60">
            <span>Gear</span>
            <span className="font-bold text-white">{t.gear}</span>
          </div>
        </div>
      </div>

      {/* Airborne indicator */}
      {t.airborne && (
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 animate-pulse rounded-full bg-amber-400/90 px-4 py-1 text-xs font-bold uppercase tracking-widest text-black shadow-lg">
          ✦ Airtime ✦
        </div>
      )}

      {/* Controls hint */}
      <div className="absolute bottom-6 left-6 rounded-xl bg-black/40 px-3 py-2 text-[10px] uppercase tracking-widest text-white/60 backdrop-blur-md">
        <div>WASD · Drive</div>
        <div>Space · Handbrake</div>
        <div>Shift · Boost</div>
        <div>C · Camera · R · Reset · Esc · Menu</div>
      </div>

      {/* Menu */}
      {menuOpen && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md">
          <div className="w-[420px] rounded-2xl border border-white/10 bg-zinc-900/90 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-widest">PAUSED</h2>
              <button
                onClick={() => setMenuOpen(false)}
                className="rounded-full bg-white/10 px-3 py-1 text-xs transition hover:bg-white/20"
              >
                ✕ Close
              </button>
            </div>

            <div className="mb-6">
              <div className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/50">Time of Day</div>
              <input
                type="range"
                min={0}
                max={24}
                step={0.1}
                value={timeOfDay}
                onChange={(e) => onTimeChange(parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
              <div className="mt-1 text-right text-xs text-white/70 tabular-nums">
                {Math.floor(timeOfDay).toString().padStart(2, "0")}:
                {Math.floor((timeOfDay % 1) * 60)
                  .toString()
                  .padStart(2, "0")}
              </div>
            </div>

            <div>
              <div className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/50">Teleport</div>
              <div className="grid grid-cols-3 gap-2">
                {biomes.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      onTeleport(b.id);
                      setMenuOpen(false);
                    }}
                    className="rounded-lg bg-white/5 px-3 py-2 text-xs transition hover:bg-amber-400 hover:text-black"
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 text-center text-[10px] uppercase tracking-widest text-white/40">
              Press Esc to resume
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

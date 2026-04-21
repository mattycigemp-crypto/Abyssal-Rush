import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";

const Game = lazy(() => import("@/game/Game"));

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Apex Drive — Cinematic Open-World Driving" },
      {
        name: "description",
        content:
          "Drive across coast, city, forest and desert biomes in a cinematic open-world driving game built with WebGL.",
      },
      { property: "og:title", content: "Apex Drive — Cinematic Open-World Driving" },
      {
        property: "og:description",
        content: "Realistic-looking browser driving game with stunts, switchable cameras and dynamic time of day.",
      },
    ],
  }),
});

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-amber-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.15),transparent_70%)]" />
      <div className="relative z-10 max-w-xl px-8 text-center">
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.5em] text-amber-300">
          Apex Drive
        </div>
        <h1 className="mb-4 bg-gradient-to-b from-white to-amber-200 bg-clip-text font-mono text-6xl font-black tracking-tight text-transparent drop-shadow-[0_0_30px_rgba(251,191,36,0.3)]">
          CINEMATIC
          <br />
          OPEN WORLD
        </h1>
        <p className="mb-8 text-sm text-white/60">
          Coast · City · Forest · Desert. Switchable cameras, dynamic time of day, ramps and chaos.
        </p>
        <button
          onClick={onStart}
          className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-amber-400 px-10 py-4 text-sm font-bold uppercase tracking-[0.3em] text-black shadow-[0_0_40px_rgba(251,191,36,0.5)] transition hover:scale-105 hover:bg-amber-300"
        >
          <span>▶ Start Driving</span>
        </button>
        <div className="mt-10 grid grid-cols-2 gap-3 text-left text-xs text-white/70 sm:grid-cols-4">
          {[
            ["WASD", "Drive"],
            ["Space", "Handbrake"],
            ["Shift", "Boost"],
            ["C", "Camera"],
            ["R", "Reset"],
            ["Esc", "Menu"],
          ].map(([k, l]) => (
            <div key={k} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
              <div className="font-mono text-amber-300">{k}</div>
              <div className="text-white/60">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Index() {
  const [started, setStarted] = useState(false);
  if (!started) return <StartScreen onStart={() => setStarted(true)} />;
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-black text-amber-300">
          <div className="font-mono text-xs uppercase tracking-[0.3em]">Loading world…</div>
        </div>
      }
    >
      <Game />
    </Suspense>
  );
}

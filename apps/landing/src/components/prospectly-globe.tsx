'use client';

import createGlobe, { type Arc } from 'cobe';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

const CITIES = {
  saoPaulo: [-23.5505, -46.6333],
  mexicoCity: [19.4326, -99.1332],
  newYork: [40.7128, -74.006],
  toronto: [43.6532, -79.3832],
  losAngeles: [34.0522, -118.2437],
  lisbon: [38.7223, -9.1393],
  london: [51.5074, -0.1278],
  paris: [48.8566, 2.3522],
  madrid: [40.4168, -3.7038],
  lagos: [6.5244, 3.3792],
  dubai: [25.2048, 55.2708],
  mumbai: [19.076, 72.8777],
  singapore: [1.3521, 103.8198],
  tokyo: [35.6762, 139.6503],
  sydney: [-33.8688, 151.2093],
  capeTown: [-33.9249, 18.4241],
} as const satisfies Record<string, readonly [number, number]>;

const MARKERS = (Object.values(CITIES) as [number, number][]).map((location, i) => ({
  location,
  size: i % 4 === 0 ? 0.038 : 0.03,
}));

function arc(from: readonly [number, number], to: readonly [number, number]): Arc {
  return { from: [from[0], from[1]], to: [to[0], to[1]] };
}

/** Intercontinental arcs cycled while the globe rotates. */
const ARC_POOL: Arc[] = [
  arc(CITIES.saoPaulo, CITIES.lisbon),
  arc(CITIES.lisbon, CITIES.london),
  arc(CITIES.london, CITIES.newYork),
  arc(CITIES.newYork, CITIES.tokyo),
  arc(CITIES.tokyo, CITIES.sydney),
  arc(CITIES.sydney, CITIES.singapore),
  arc(CITIES.singapore, CITIES.dubai),
  arc(CITIES.dubai, CITIES.mumbai),
  arc(CITIES.mumbai, CITIES.paris),
  arc(CITIES.paris, CITIES.lagos),
  arc(CITIES.lagos, CITIES.capeTown),
  arc(CITIES.capeTown, CITIES.saoPaulo),
  arc(CITIES.mexicoCity, CITIES.madrid),
  arc(CITIES.toronto, CITIES.london),
  arc(CITIES.newYork, CITIES.paris),
  arc(CITIES.saoPaulo, CITIES.newYork),
  arc(CITIES.tokyo, CITIES.london),
  arc(CITIES.singapore, CITIES.sydney),
  arc(CITIES.dubai, CITIES.london),
  arc(CITIES.mexicoCity, CITIES.saoPaulo),
  arc(CITIES.tokyo, CITIES.saoPaulo),
  arc(CITIES.sydney, CITIES.losAngeles),
  arc(CITIES.losAngeles, CITIES.tokyo),
  arc(CITIES.madrid, CITIES.dubai),
  arc(CITIES.lagos, CITIES.london),
  arc(CITIES.mumbai, CITIES.singapore),
];

/** How many concurrent links stay visible. */
const VISIBLE_ARCS = 3;
/** Radians of rotation before the next link fires. */
const ARC_STEP = 0.42;

const COBALT: [number, number, number] = [0.145, 0.388, 0.922];

function isDarkMode() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function arcsForPhi(phi: number, animate: boolean): Arc[] {
  if (!animate) {
    return ARC_POOL.slice(0, VISIBLE_ARCS);
  }
  const tick = Math.floor(((phi % (ARC_STEP * ARC_POOL.length)) + ARC_STEP * ARC_POOL.length) / ARC_STEP);
  const active: Arc[] = [];
  for (let i = 0; i < VISIBLE_ARCS; i += 1) {
    const idx = (tick - i + ARC_POOL.length * 8) % ARC_POOL.length;
    active.push(ARC_POOL[idx]!);
  }
  return active;
}

export function ProspectlyGlobe({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let width = 0;
    let phi = 0;
    let frame = 0;
    let lastArcKey = '';
    let globe: ReturnType<typeof createGlobe> | undefined;
    let destroyed = false;

    const dark = isDarkMode() ? 1 : 0;
    const animateArcs = !reduceMotion;

    const onResize = () => {
      width = canvas.offsetWidth;
    };
    window.addEventListener('resize', onResize);
    onResize();

    try {
      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 2, 2),
        width: width * 2,
        height: width * 2,
        phi: 0,
        theta: 0.22,
        dark,
        diffuse: 1.25,
        mapSamples: 16000,
        mapBrightness: dark ? 4.5 : 8,
        mapBaseBrightness: dark ? 0.08 : 0.02,
        baseColor: dark
          ? ([0.12, 0.14, 0.2] as [number, number, number])
          : ([0.96, 0.97, 1] as [number, number, number]),
        markerColor: COBALT,
        glowColor: dark
          ? ([0.12, 0.16, 0.28] as [number, number, number])
          : ([0.9, 0.93, 1] as [number, number, number]),
        markers: [...MARKERS],
        arcs: arcsForPhi(0, animateArcs),
        arcColor: COBALT,
        arcWidth: 0.55,
        arcHeight: 0.32,
        markerElevation: 0.01,
        scale: 1.05,
      });
    } catch {
      return () => {
        window.removeEventListener('resize', onResize);
      };
    }

    const render = () => {
      if (destroyed || !globe) return;
      if (!reduceMotion) {
        phi += 0.0028;
      }

      const nextArcs = arcsForPhi(phi, animateArcs);
      const arcKey = nextArcs.map((a) => `${a.from[0]},${a.from[1]}>${a.to[0]},${a.to[1]}`).join('|');
      const patch: Parameters<typeof globe.update>[0] = {
        width: width * 2,
        height: width * 2,
        phi,
      };
      if (arcKey !== lastArcKey) {
        lastArcKey = arcKey;
        patch.arcs = nextArcs;
      }

      globe.update(patch);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    const themeMq = window.matchMedia('(prefers-color-scheme: dark)');
    const onTheme = () => {
      if (!globe) return;
      const nextDark = themeMq.matches ? 1 : 0;
      globe.update({
        dark: nextDark,
        mapBrightness: nextDark ? 4.5 : 8,
        mapBaseBrightness: nextDark ? 0.08 : 0.02,
        baseColor: nextDark
          ? ([0.12, 0.14, 0.2] as [number, number, number])
          : ([0.96, 0.97, 1] as [number, number, number]),
        glowColor: nextDark
          ? ([0.12, 0.16, 0.28] as [number, number, number])
          : ([0.9, 0.93, 1] as [number, number, number]),
      });
    };
    themeMq.addEventListener('change', onTheme);

    return () => {
      destroyed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      themeMq.removeEventListener('change', onTheme);
      globe?.destroy();
    };
  }, [reduceMotion]);

  return (
    <div className={className} aria-hidden>
      <canvas
        ref={canvasRef}
        className="aspect-square w-full max-w-[560px] opacity-95"
        style={{ contain: 'layout paint size' }}
      />
    </div>
  );
}

'use client';

import gsap from 'gsap';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import {
  AmbientLight,
  CatmullRomCurve3,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  CITIES,
  MARKER_CITIES,
  NETWORK_LINKS,
  ROUTE_CHAIN,
  type CityId,
} from '@/components/globe/cities';
import {
  createEarth,
  EARTH_RADIUS,
  loadEarthTextures,
  setEarthTheme,
  type EarthBundle,
} from '@/components/globe/create-earth';
import { greatCirclePoints, latLonToVector3 } from '@/components/globe/geo';
import { GlobeStaticFallback } from '@/components/globe/globe-static-fallback';

const COBALT = '#2563eb';
const COBALT_DARK = '#60a5fa';

const ARC_SEGMENTS = 80;
const ARC_HEIGHT = 0.62;
const ARC_TUBE_RADIUS = 0.0045;
const ARC_RADIAL = 5;
const ACTIVE_TRAIL = 3;
const MARKER_RADIUS = 0.014;
const FACING_EPS = 0.03;
const TWO_PI = Math.PI * 2;
/** Camera pulled back so the full globe + arcs read clearly. */
const CAMERA_Z = 3.75;

function isDarkMode() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

type ArcBundle = {
  group: Group;
  geometry: TubeGeometry;
  material: MeshBasicMaterial;
  points: Vector3[];
  indexCount: number;
  progress: number;
  baseOpacity: number;
};

function buildArc(
  from: CityId,
  to: CityId,
  color: string,
  opts: { opacity: number; heightScale?: number },
): ArcBundle {
  const height = ARC_HEIGHT * (opts.heightScale ?? 1);
  const fromV = latLonToVector3(CITIES[from], EARTH_RADIUS);
  const toV = latLonToVector3(CITIES[to], EARTH_RADIUS);
  const points = greatCirclePoints(fromV, toV, EARTH_RADIUS, ARC_SEGMENTS, height);
  const curve = new CatmullRomCurve3(points, false, 'centripetal', 0.45);
  const geometry = new TubeGeometry(curve, ARC_SEGMENTS, ARC_TUBE_RADIUS, ARC_RADIAL, false);

  const material = new MeshBasicMaterial({
    color: new Color(color),
    transparent: true,
    opacity: opts.opacity,
    depthTest: true,
    depthWrite: false,
  });

  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;

  const group = new Group();
  group.add(mesh);

  return {
    group,
    geometry,
    material,
    points,
    indexCount: geometry.getIndex()?.count ?? geometry.attributes.position.count,
    progress: 0,
    baseOpacity: opts.opacity,
  };
}

function applyArcProgress(arc: ArcBundle) {
  const count = Math.max(0, Math.floor(arc.progress * arc.indexCount));
  arc.geometry.setDrawRange(0, count);
  arc.group.visible = count > 30;
}

function disposeArc(arc: ArcBundle) {
  arc.geometry.dispose();
  arc.material.dispose();
}

function createMarkers(color: string): {
  group: Group;
  meshes: Map<CityId, Mesh>;
  dispose: () => void;
} {
  const group = new Group();
  const meshes = new Map<CityId, Mesh>();
  const geo = new SphereGeometry(MARKER_RADIUS, 12, 12);
  const sharedMat = new MeshBasicMaterial({
    color: new Color(color),
    depthTest: true,
    depthWrite: false,
    transparent: true,
  });

  for (const id of MARKER_CITIES) {
    const mesh = new Mesh(geo, sharedMat.clone());
    latLonToVector3(CITIES[id], EARTH_RADIUS + 0.018, mesh.position);
    mesh.scale.setScalar(0.55);
    group.add(mesh);
    meshes.set(id, mesh);
  }

  return {
    group,
    meshes,
    dispose: () => {
      geo.dispose();
      sharedMat.dispose();
      meshes.forEach((m) => (m.material as MeshBasicMaterial).dispose());
    },
  };
}

export function ProspectlyGlobe({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let destroyed = false;
    let cancelled = false;
    let renderer: WebGLRenderer | undefined;
    let earth: EarthBundle | undefined;
    let markersRef: ReturnType<typeof createMarkers> | undefined;
    let markersDispose: (() => void) | undefined;
    let dayTextureDispose: (() => void) | undefined;
    let cloudsTextureDispose: (() => void) | undefined;
    const trackedArcs: ArcBundle[] = [];
    const themeMq = window.matchMedia('(prefers-color-scheme: dark)');
    const ctx = gsap.context(() => {});

    const scene = new Scene();
    const camera = new PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0.1, CAMERA_Z);
    camera.lookAt(0, -0.04, 0);

    const ambient = new AmbientLight(0xffffff, 0.55);
    const key = new DirectionalLight(0xffffff, 1.35);
    key.position.set(-4, 5, 3);
    const fill = new DirectionalLight(0xbdd6ff, 0.35);
    fill.position.set(3, -1, 2);
    scene.add(ambient, key, fill);

    const arcsGroup = new Group();
    const animate = !reduceMotion;

    const worldPos = new Vector3();
    const globeCenter = new Vector3();
    const camDir = new Vector3();
    const radial = new Vector3();

    const facingOfLocalPoint = (local: Vector3): number => {
      if (!earth) return 1;
      worldPos.copy(local).applyMatrix4(earth.spin.matrixWorld);
      earth.root.getWorldPosition(globeCenter);
      camDir.copy(camera.position).sub(globeCenter).normalize();
      radial.copy(worldPos).sub(globeCenter).normalize();
      return radial.dot(camDir);
    };

    const updateMarkerFacing = () => {
      if (!earth || !markersRef) return;
      earth.spin.updateWorldMatrix(true, true);
      earth.root.getWorldPosition(globeCenter);
      camDir.copy(camera.position).sub(globeCenter).normalize();

      markersRef.meshes.forEach((mesh) => {
        mesh.getWorldPosition(worldPos);
        radial.copy(worldPos).sub(globeCenter).normalize();
        const facing = radial.dot(camDir);
        const mat = mesh.material as MeshBasicMaterial;
        if (facing <= FACING_EPS) {
          mesh.visible = false;
        } else {
          mesh.visible = true;
          mat.opacity = Math.min(1, (facing - FACING_EPS) / 0.2);
        }
      });
    };

    const updateArcFacing = () => {
      if (!earth) return;
      earth.spin.updateWorldMatrix(true, true);

      for (const arc of trackedArcs) {
        applyArcProgress(arc);
        if (!arc.group.visible) continue;

        const midIndex = Math.min(
          arc.points.length - 1,
          Math.max(0, Math.floor(arc.progress * (arc.points.length - 1))),
        );
        const midFacing = facingOfLocalPoint(arc.points[midIndex]!);
        if (midFacing < -0.4) {
          arc.group.visible = false;
          continue;
        }
        arc.material.opacity =
          arc.baseOpacity * Math.min(1, Math.max(0.22, 0.4 + midFacing * 0.85));
      }
    };

    const onResize = () => {
      if (!renderer) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight || w;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };

    const render = () => {
      if (destroyed || !renderer) return;
      updateMarkerFacing();
      updateArcFacing();
      renderer.render(scene, camera);
    };

    const onTheme = () => {
      if (!earth) return;
      const nextDark = themeMq.matches;
      setEarthTheme(earth, nextDark);
      ambient.intensity = nextDark ? 0.4 : 0.55;
      key.intensity = nextDark ? 1.15 : 1.35;
    };

    const registerArc = (arc: ArcBundle) => {
      trackedArcs.push(arc);
      arcsGroup.add(arc.group);
    };

    const unregisterArc = (arc: ArcBundle) => {
      const idx = trackedArcs.indexOf(arc);
      if (idx >= 0) trackedArcs.splice(idx, 1);
      arcsGroup.remove(arc.group);
      disposeArc(arc);
    };

    (async () => {
      try {
        const textures = await loadEarthTextures();
        if (cancelled || destroyed) {
          textures.day.dispose();
          textures.clouds.dispose();
          return;
        }

        dayTextureDispose = () => textures.day.dispose();
        cloudsTextureDispose = () => textures.clouds.dispose();

        const dark = isDarkMode();
        const accent = dark ? COBALT_DARK : COBALT;
        earth = createEarth(textures, dark);
        (earth.earth.material as MeshStandardMaterial).depthWrite = true;
        earth.earth.renderOrder = 0;
        earth.clouds.renderOrder = 1;
        scene.add(earth.root);

        const markers = createMarkers(accent);
        markersRef = markers;
        markersDispose = markers.dispose;
        earth.spin.add(markers.group);
        earth.spin.add(arcsGroup);

        NETWORK_LINKS.forEach(([from, to], i) => {
          const arc = buildArc(from, to, accent, {
            opacity: i % 4 === 0 ? 0.7 : 0.48,
            heightScale: 0.78 + (i % 6) * 0.07,
          });
          arc.progress = 1;
          applyArcProgress(arc);
          registerArc(arc);
        });

        renderer = new WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        });
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = SRGBColorSpace;
        onResize();

        const activeArcs: ArcBundle[] = [];

        const pulseMarker = (id: CityId) => {
          const mesh = markers.meshes.get(id);
          if (!mesh || !mesh.visible) return;
          gsap.killTweensOf(mesh.scale);
          gsap.fromTo(
            mesh.scale,
            { x: 0.55, y: 0.55, z: 0.55 },
            {
              x: 1.35,
              y: 1.35,
              z: 1.35,
              duration: 0.35,
              yoyo: true,
              repeat: 1,
              ease: 'power2.out',
            },
          );
        };

        const pruneTrail = () => {
          while (activeArcs.length > ACTIVE_TRAIL) {
            const old = activeArcs.shift();
            if (!old) break;
            unregisterArc(old);
          }
        };

        const buildRouteTimeline = () => {
          const tl = gsap.timeline({ repeat: -1 });

          for (let i = 0; i < ROUTE_CHAIN.length - 1; i += 1) {
            const from = ROUTE_CHAIN[i]!;
            const to = ROUTE_CHAIN[i + 1]!;
            const state = { draw: 0 };
            let arc: ArcBundle | undefined;

            tl.call(() => {
              pulseMarker(from);
              arc = buildArc(from, to, accent, {
                opacity: 0.95,
                heightScale: 1.08,
              });
              registerArc(arc);
              activeArcs.push(arc);
              pruneTrail();
              state.draw = 0;

              if (activeArcs.length > 1) {
                const prev = activeArcs[0];
                if (prev) {
                  prev.baseOpacity = 0.4;
                  gsap.to(prev.material, { opacity: 0.4, duration: 0.7, overwrite: 'auto' });
                }
              }
            });

            tl.to(state, {
              draw: 1,
              duration: 1.7,
              ease: 'sine.inOut',
              onUpdate: () => {
                if (!arc) return;
                arc.progress = state.draw;
                applyArcProgress(arc);
              },
              onComplete: () => pulseMarker(to),
            });

            tl.to({}, { duration: 0.25 });
          }

          return tl;
        };

        if (animate) {
          ctx.add(() => {
            gsap.to(earth!.spin.rotation, {
              y: `+=${TWO_PI}`,
              duration: 50,
              ease: 'none',
              repeat: -1,
            });
            gsap.to(earth!.clouds.rotation, {
              y: `+=${TWO_PI}`,
              duration: 92,
              ease: 'none',
              repeat: -1,
            });
            buildRouteTimeline();
          });
        } else {
          for (let i = 0; i < Math.min(ACTIVE_TRAIL, ROUTE_CHAIN.length - 1); i += 1) {
            const from = ROUTE_CHAIN[i]!;
            const to = ROUTE_CHAIN[i + 1]!;
            const arc = buildArc(from, to, accent, { opacity: 0.9, heightScale: 1 });
            arc.progress = 1;
            applyArcProgress(arc);
            registerArc(arc);
            activeArcs.push(arc);
          }
        }

        gsap.ticker.add(render);
        themeMq.addEventListener('change', onTheme);
        window.addEventListener('resize', onResize);
      } catch {
        // WebGL / texture failure — leave canvas empty rather than crash the hero
      }
    })();

    return () => {
      cancelled = true;
      destroyed = true;
      gsap.ticker.remove(render);
      ctx.revert();
      themeMq.removeEventListener('change', onTheme);
      window.removeEventListener('resize', onResize);
      trackedArcs.forEach((arc) => {
        arcsGroup.remove(arc.group);
        disposeArc(arc);
      });
      trackedArcs.length = 0;
      markersDispose?.();
      if (earth) {
        const earthMat = earth.earth.material as MeshStandardMaterial;
        const cloudMat = earth.clouds.material as MeshStandardMaterial;
        earthMat.map = null;
        cloudMat.map = null;
        earth.dispose();
      }
      dayTextureDispose?.();
      cloudsTextureDispose?.();
      renderer?.dispose();
    };
  }, [reduceMotion]);

  if (reduceMotion) {
    return <GlobeStaticFallback className={className} />;
  }

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

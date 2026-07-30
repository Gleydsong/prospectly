'use client';

import gsap from 'gsap';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import {
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { CITIES, MARKER_CITIES, PERSISTENT_LINKS, ROUTE_CHAIN, type CityId } from '@/components/globe/cities';
import {
  createEarth,
  EARTH_RADIUS,
  loadEarthTextures,
  setEarthTheme,
  type EarthBundle,
} from '@/components/globe/create-earth';
import { greatCirclePoints, latLonToVector3 } from '@/components/globe/geo';

const COBALT = '#2563eb';
const COBALT_DARK = '#60a5fa';
const ARC_SEGMENTS = 128;
const ARC_HEIGHT = 0.36;
const TRAIL = 3;
const MARKER_RADIUS = 0.014;
/** Dot product threshold: only show when hemisphere faces the camera. */
const FACING_EPS = 0.06;

function isDarkMode() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

type ActiveArc = {
  geometry: BufferGeometry;
  material: LineBasicMaterial;
  line: Line;
  vertexCount: number;
  /** How many vertices the animation has revealed (from the start city). */
  progressCount: number;
  /** Local-space sample points (spin group space). */
  points: Vector3[];
  baseOpacity: number;
};

function buildArcLine(from: CityId, to: CityId, color: string, baseOpacity = 0.95): ActiveArc {
  const fromV = latLonToVector3(CITIES[from], EARTH_RADIUS);
  const toV = latLonToVector3(CITIES[to], EARTH_RADIUS);
  const points = greatCirclePoints(fromV, toV, EARTH_RADIUS, ARC_SEGMENTS, ARC_HEIGHT);
  const positions = new Float32Array(points.length * 3);
  points.forEach((p, i) => {
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setDrawRange(0, 0);

  const material = new LineBasicMaterial({
    color: new Color(color),
    transparent: true,
    opacity: baseOpacity,
    depthTest: true,
    depthWrite: false,
  });

  const line = new Line(geometry, material);
  line.frustumCulled = false;
  return {
    line,
    geometry,
    material,
    vertexCount: points.length,
    progressCount: 0,
    points,
    baseOpacity,
  };
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
    const trackedArcs: ActiveArc[] = [];
    const arcDisposables: Array<() => void> = [];
    const themeMq = window.matchMedia('(prefers-color-scheme: dark)');
    const ctx = gsap.context(() => {});

    const scene = new Scene();
    const camera = new PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.15, 3.05);
    camera.lookAt(0, -0.05, 0);

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

    /** Hide back-hemisphere markers; fade near the limb. */
    const updateMarkerFacing = () => {
      if (!earth || !markersRef) return;
      earth.spin.updateWorldMatrix(true, false);
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
          // Soft fade as the point rolls toward the horizon
          mat.opacity = Math.min(1, (facing - FACING_EPS) / 0.25);
        }
      });
    };

    /**
     * Only keep the front-facing stretch of each arc visible.
     * Back-side vertices are dropped so links never show through the globe.
     */
    const updateArcFacing = () => {
      if (!earth) return;
      earth.spin.updateWorldMatrix(true, false);

      for (const arc of trackedArcs) {
        const limit = Math.min(arc.progressCount, arc.points.length);
        if (limit < 2) {
          arc.line.visible = false;
          continue;
        }

        let first = -1;
        let last = -1;
        for (let i = 0; i < limit; i += 1) {
          const facing = facingOfLocalPoint(arc.points[i]!);
          if (facing > FACING_EPS) {
            if (first < 0) first = i;
            last = i;
          } else if (first >= 0) {
            // Stop at the first back-facing gap so we don't bridge through the planet
            break;
          }
        }

        if (first < 0 || last <= first) {
          arc.line.visible = false;
          continue;
        }

        arc.line.visible = true;
        arc.geometry.setDrawRange(first, last - first + 1);

        const mid = arc.points[Math.floor((first + last) / 2)]!;
        const midFacing = facingOfLocalPoint(mid);
        arc.material.opacity = arc.baseOpacity * Math.min(1, 0.35 + midFacing * 0.9);
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

    const registerArc = (arc: ActiveArc) => {
      trackedArcs.push(arc);
      arcsGroup.add(arc.line);
      arcDisposables.push(() => {
        const idx = trackedArcs.indexOf(arc);
        if (idx >= 0) trackedArcs.splice(idx, 1);
        arcsGroup.remove(arc.line);
        arc.geometry.dispose();
        arc.material.dispose();
      });
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
        // Earth must write depth so back-side arcs/markers are occluded
        (earth.earth.material as MeshStandardMaterial).depthWrite = true;
        scene.add(earth.root);

        const markers = createMarkers(accent);
        markersRef = markers;
        markersDispose = markers.dispose;
        earth.spin.add(markers.group);
        earth.spin.add(arcsGroup);

        for (const [from, to] of PERSISTENT_LINKS) {
          const persistent = buildArcLine(from, to, accent, 0.85);
          persistent.progressCount = persistent.vertexCount;
          registerArc(persistent);
        }

        renderer = new WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        });
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = SRGBColorSpace;
        onResize();

        const activeArcs: ActiveArc[] = [];

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
          while (activeArcs.length > TRAIL) {
            const old = activeArcs.shift();
            if (!old) break;
            const idx = trackedArcs.indexOf(old);
            if (idx >= 0) trackedArcs.splice(idx, 1);
            arcsGroup.remove(old.line);
            old.geometry.dispose();
            old.material.dispose();
          }
        };

        const buildRouteTimeline = () => {
          const tl = gsap.timeline({ repeat: -1 });

          for (let i = 0; i < ROUTE_CHAIN.length - 1; i += 1) {
            const from = ROUTE_CHAIN[i]!;
            const to = ROUTE_CHAIN[i + 1]!;
            const state = { draw: 0 };
            let arc: ActiveArc | undefined;

            tl.call(() => {
              pulseMarker(from);
              arc = buildArcLine(from, to, accent, 0.95);
              registerArc(arc);
              activeArcs.push(arc);
              pruneTrail();
              state.draw = 0;

              if (activeArcs.length > 1) {
                const prev = activeArcs[0];
                if (prev) {
                  prev.baseOpacity = 0.35;
                  gsap.to(prev.material, { opacity: 0.35, duration: 0.6, overwrite: 'auto' });
                }
              }
            });

            tl.to(state, {
              draw: 1,
              duration: 1.55,
              ease: 'sine.inOut',
              onUpdate: () => {
                if (!arc) return;
                arc.progressCount = Math.max(
                  2,
                  Math.ceil(state.draw * (arc.vertexCount - 1)) + 1,
                );
              },
              onComplete: () => pulseMarker(to),
            });

            tl.to({}, { duration: 0.35 });
          }

          return tl;
        };

        if (animate) {
          ctx.add(() => {
            gsap.to(earth!.spin.rotation, {
              y: earth!.spin.rotation.y + Math.PI * 2,
              duration: 48,
              ease: 'none',
              repeat: -1,
            });
            gsap.to(earth!.clouds.rotation, {
              y: `+=${Math.PI * 2}`,
              duration: 90,
              ease: 'none',
              repeat: -1,
            });
            buildRouteTimeline();
          });
        } else {
          for (let i = 0; i < Math.min(TRAIL, ROUTE_CHAIN.length - 1); i += 1) {
            const from = ROUTE_CHAIN[i]!;
            const to = ROUTE_CHAIN[i + 1]!;
            const arc = buildArcLine(from, to, accent, 0.95);
            arc.progressCount = arc.vertexCount;
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
      arcDisposables.forEach((d) => d());
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

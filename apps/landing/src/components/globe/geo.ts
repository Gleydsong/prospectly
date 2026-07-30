import { QuadraticBezierCurve3, Vector3 } from 'three';
import type { LatLon } from './cities';

/** Convert lat/lon (degrees) to a point on a sphere (Three.js Y-up). */
export function latLonToVector3(latLon: LatLon, radius: number, target = new Vector3()): Vector3 {
  const [lat, lon] = latLon;
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return target.set(x, y, z);
}

function slerpUnit(start: Vector3, end: Vector3, t: number, target: Vector3): Vector3 {
  const dot = Math.min(1, Math.max(-1, start.dot(end)));
  const omega = Math.acos(dot);

  // Nearly identical — linear is fine
  if (omega < 1e-4) {
    return target.copy(start).lerp(end, t).normalize();
  }

  // Antipodal — pick a stable perpendicular axis and rotate
  if (Math.PI - omega < 1e-3) {
    const axis = Math.abs(start.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    axis.cross(start).normalize();
    return target.copy(start).applyAxisAngle(axis, Math.PI * t).normalize();
  }

  const so = Math.sin(omega);
  const a = Math.sin((1 - t) * omega) / so;
  const b = Math.sin(t * omega) / so;
  return target.copy(start).multiplyScalar(a).addScaledVector(end, b).normalize();
}

/**
 * Raised flight-path arc that always stays outside the sphere.
 * Uses spherical mid control + quadratic Bezier so long "around the world"
 * links bow outward instead of clipping through the globe.
 */
export function greatCirclePoints(
  from: Vector3,
  to: Vector3,
  radius: number,
  segments: number,
  arcHeight: number,
): Vector3[] {
  const startN = from.clone().normalize();
  const endN = to.clone().normalize();
  const angle = startN.angleTo(endN);

  // Longer hops need a taller bow so the curve never skims/cuts the surface
  const clearance = 0.02;
  const height = arcHeight * (0.4 + 0.85 * (angle / Math.PI)) + clearance;

  const start = startN.clone().multiplyScalar(radius + clearance);
  const end = endN.clone().multiplyScalar(radius + clearance);

  const midN = new Vector3();
  slerpUnit(startN, endN, 0.5, midN);
  const mid = midN.multiplyScalar(radius + height);

  const curve = new QuadraticBezierCurve3(start, mid, end);
  return curve.getPoints(segments);
}

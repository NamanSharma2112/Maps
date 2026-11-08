import { geoDistance } from "d3-geo";
import type { LatLng } from "../types";

export const DEG = Math.PI / 180;
export const EARTH_RADIUS_KM = 6371.0088;

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  return geoDistance([a.lng, a.lat], [b.lng, b.lat]) * EARTH_RADIUS_KM;
}

/** Points along the great circle from a to b, as [lng, lat] pairs (inclusive of both ends). */
export function greatCircle(a: LatLng, b: LatLng, segments = 64): [number, number][] {
  const φ1 = a.lat * DEG, λ1 = a.lng * DEG, φ2 = b.lat * DEG, λ2 = b.lng * DEG;
  const d = geoDistance([a.lng, a.lat], [b.lng, b.lat]);
  const pts: [number, number][] = [];
  if (d === 0) return [[a.lng, a.lat], [b.lng, b.lat]];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const A = Math.sin((1 - t) * d) / Math.sin(d);
    const B = Math.sin(t * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    pts.push([Math.atan2(y, x) / DEG, Math.atan2(z, Math.hypot(x, y)) / DEG]);
  }
  return pts;
}

/** Initial bearing from a to b in degrees, 0–360 clockwise from north. */
export function bearing(a: LatLng, b: LatLng): number {
  const φ1 = a.lat * DEG, φ2 = b.lat * DEG, Δλ = (b.lng - a.lng) * DEG;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

const CARDINALS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
/** 16-point compass name for a heading in degrees. */
export function cardinal(deg: number): string {
  return CARDINALS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

export interface FormatCoordinateOptions {
  /** "decimal" → 40.7128° N, "dms" → 40°42′46″ N */
  format?: "decimal" | "dms";
  precision?: number;
}

function formatPart(v: number, pos: string, neg: string, { format = "decimal", precision = 4 }: FormatCoordinateOptions) {
  const hemi = v >= 0 ? pos : neg;
  const a = Math.abs(v);
  if (format === "dms") {
    let d = Math.floor(a);
    let m = Math.floor((a - d) * 60);
    let s = Math.round(((a - d) * 60 - m) * 60);
    if (s === 60) { s = 0; m += 1; }
    if (m === 60) { m = 0; d += 1; }
    return `${d}°${String(m).padStart(2, "0")}′${String(s).padStart(2, "0")}″ ${hemi}`;
  }
  return `${a.toFixed(precision)}° ${hemi}`;
}

export function formatLat(lat: number, opts: FormatCoordinateOptions = {}) {
  return formatPart(lat, "N", "S", opts);
}
export function formatLng(lng: number, opts: FormatCoordinateOptions = {}) {
  return formatPart(lng, "E", "W", opts);
}
export function formatCoordinate(p: LatLng, opts: FormatCoordinateOptions = {}) {
  return `${formatLat(p.lat, opts)}, ${formatLng(p.lng, opts)}`;
}

/** Wrap a longitude into [-180, 180). */
export function wrapLng(lng: number) {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

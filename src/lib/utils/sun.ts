import type { LatLng } from "../types";
import { DEG, wrapLng } from "./geo";

/**
 * The point on Earth where the sun is directly overhead at `date`
 * (NOAA general solar position approximation, accurate to ~0.5°).
 */
export function subsolarPoint(date: Date = new Date()): LatLng {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const daysInYear = (Date.UTC(year + 1, 0, 1) - start) / 864e5;
  const dayFrac = (date.getTime() - start) / 864e5; // 0-based fractional day of year
  const γ = ((2 * Math.PI) / daysInYear) * dayFrac;
  const eqTime =
    229.18 *
    (0.000075 + 0.001868 * Math.cos(γ) - 0.032077 * Math.sin(γ) - 0.014615 * Math.cos(2 * γ) - 0.040849 * Math.sin(2 * γ));
  const decl =
    0.006918 -
    0.399912 * Math.cos(γ) +
    0.070257 * Math.sin(γ) -
    0.006758 * Math.cos(2 * γ) +
    0.000907 * Math.sin(2 * γ) -
    0.002697 * Math.cos(3 * γ) +
    0.00148 * Math.sin(3 * γ);
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  return { lat: decl / DEG, lng: wrapLng((720 - utcMinutes - eqTime) / 4) };
}

/** Centre of the night hemisphere (the anti-solar point). */
export function antisolarPoint(date: Date = new Date()): LatLng {
  const s = subsolarPoint(date);
  return { lat: -s.lat, lng: wrapLng(s.lng + 180) };
}

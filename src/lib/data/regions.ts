import type { MultiPolygon, Polygon } from "geojson";
import { geoBounds, geoCentroid, geoContains } from "d3-geo";

export interface RegionFeature {
  /** Stable key: ISO numeric code for countries, ISO 3166-2 suffix for Indian states. */
  id: string;
  name: string;
  geometry: Polygon | MultiPolygon;
}

export interface Region {
  id: string;
  name: string;
  value?: number;
}

type Bounds = [[number, number], [number, number]];
const boundsCache = new WeakMap<RegionFeature, Bounds>();

function boundsOf(f: RegionFeature): Bounds {
  let b = boundsCache.get(f);
  if (!b) {
    b = geoBounds({ type: "Feature", properties: {}, geometry: f.geometry }) as Bounds;
    boundsCache.set(f, b);
  }
  return b;
}

/** Index of the feature containing [lng, lat], or -1. */
export function locate(features: RegionFeature[], lng: number, lat: number): number {
  for (let i = 0; i < features.length; i++) {
    const [[x0, y0], [x1, y1]] = boundsOf(features[i]);
    if (lat < y0 || lat > y1) continue;
    if (x0 <= x1 ? lng < x0 || lng > x1 : lng < x0 && lng > x1) continue;
    if (geoContains(features[i].geometry, [lng, lat])) return i;
  }
  return -1;
}

const centroidCache = new WeakMap<RegionFeature, [number, number]>();
/** Spherical centroid [lng, lat], computed once per region. */
export function centroidOf(f: RegionFeature): [number, number] {
  let c = centroidCache.get(f);
  if (!c) {
    c = geoCentroid(f.geometry) as [number, number];
    centroidCache.set(f, c);
  }
  return c;
}

/** Geographic bounds [[west, south], [east, north]], computed once per region. */
export function boundsOfRegion(f: RegionFeature): [[number, number], [number, number]] {
  return boundsOf(f);
}

/** Regions whose bounds touch the box [west, south, east, north] (antimeridian-crossing shapes are kept). */
export function regionsNear(list: RegionFeature[], [w, s, e, n]: [number, number, number, number]): RegionFeature[] {
  return list.filter((r) => {
    const [[x0, y0], [x1, y1]] = boundsOf(r);
    if (x0 > x1) return true;
    return !(x1 < w || x0 > e || y1 < s || y0 > n);
  });
}

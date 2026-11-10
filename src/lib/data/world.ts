import type { Feature, FeatureCollection, MultiLineString, MultiPolygon, Polygon } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { feature, merge, mesh } from "topojson-client";
import { geoBounds, geoContains, geoEquirectangular, geoPath } from "d3-geo";
import { canRasterise } from "../utils/raster";
// Natural Earth 1:50m, lightly simplified (scripts/build-world.mjs)
import countriesTopo from "./world-50m.topo.json";
// India on its official boundary, and its neighbours trimmed to fit (scripts/build-world.mjs)
import southAsiaTopo from "./south-asia.topo.json";
// The same world (official India included), heavily simplified: for globes and point-in-land tests
import lowTopo from "./world-low.topo.json";
import type { RegionFeature } from "./regions";

export interface CountryProperties {
  name: string;
}
export type CountryFeature = Feature<Polygon | MultiPolygon, CountryProperties> & { id: string };

interface World {
  land: FeatureCollection<Polygon | MultiPolygon>;
  countries: CountryFeature[];
  borders: MultiLineString;
}

export type Detail = "high" | "low";
const worlds: Partial<Record<Detail, World>> = {};

type Countries = Topology<{ countries: GeometryCollection<CountryProperties> }>;
const toFeatures = (t: Countries) =>
  (feature(t, t.objects.countries) as unknown as FeatureCollection<Polygon | MultiPolygon, CountryProperties>).features.map(
    (f) => ({ ...f, id: String(f.id ?? f.properties.name) }),
  ) as CountryFeature[];

/**
 * Countries, land and internal borders, parsed once per detail level and cached.
 * "high" (default): Natural Earth 1:50m for flat maps. "low": a heavily simplified copy for globes
 * and point-in-land tests. Both draw India on its official boundary.
 */
export function getWorld(detail: Detail = "high"): World {
  const hit = worlds[detail];
  if (hit) return hit;
  let built: World;
  if (detail === "low") {
    const lt = lowTopo as unknown as Countries;
    built = {
      countries: toFeatures(lt),
      land: { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: merge(lt, lt.objects.countries.geometries as never) }] },
      borders: mesh(lt, lt.objects.countries, (a, b) => a !== b) as MultiLineString,
    };
  } else {
    const ct = countriesTopo as unknown as Countries;
    const sa = southAsiaTopo as unknown as Countries;
    const official = toFeatures(sa);
    const replaced = new Set(official.map((f) => f.properties.name));
    // Natural Earth draws Siachen as its own feature; it lies inside India's official boundary
    const OMIT = new Set(["Siachen Glacier"]);
    const countries = toFeatures(ct)
      .filter((f) => !OMIT.has(f.properties.name))
      .map((f) => official.find((o) => o.properties.name === f.properties.name) ?? f)
      .filter((f, i, all) => all.indexOf(f) === i);
    const inSA = (g: { properties?: object | null }) => replaced.has((g.properties as Partial<CountryProperties> | undefined)?.name ?? "");
    const outside = mesh(ct, ct.objects.countries, (a, b) => a !== b && !inSA(a) && !inSA(b)) as MultiLineString;
    const inside = mesh(sa, sa.objects.countries) as MultiLineString;
    built = {
      land: { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: merge(ct, ct.objects.countries.geometries as never) }] },
      countries,
      borders: { type: "MultiLineString", coordinates: [...outside.coordinates, ...inside.coordinates] },
    };
  }
  worlds[detail] = built;
  return built;
}

export function findCountry(nameOrId: string, detail: Detail = "high"): CountryFeature | undefined {
  const key = nameOrId.toLowerCase();
  return getWorld(detail).countries.find((c) => c.id === nameOrId || c.properties.name.toLowerCase() === key);
}

const regionCache: Partial<Record<Detail, RegionFeature[]>> = {};
/** Every country as a map region, keyed by ISO 3166-1 numeric id ("356" = India). */
export function getCountryRegions(detail: Detail = "high"): RegionFeature[] {
  return (regionCache[detail] ??= getWorld(detail).countries.map((c) => ({ id: c.id, name: c.properties.name, geometry: c.geometry })));
}

/** Land polygons split out with their bounding boxes, for fast point-in-land tests. */
let landIndex: { feature: Feature<Polygon>; bounds: [[number, number], [number, number]] }[] | null = null;

function getLandIndex() {
  if (landIndex) return landIndex;
  landIndex = [];
  for (const f of getWorld("low").countries) {
    const g = f.geometry;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const coordinates of polys) {
      const poly: Feature<Polygon> = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates } };
      landIndex.push({ feature: poly, bounds: geoBounds(poly) as [[number, number], [number, number]] });
    }
  }
  return landIndex;
}

// A 0.2°-per-pixel land raster: one draw, then every isLand() is a pixel read.
let landMask: { data: Uint8ClampedArray; w: number; h: number } | null | undefined;
function getLandMask() {
  if (landMask !== undefined) return landMask;
  landMask = null;
  if (!canRasterise()) return null;
  const w = 1800, h = 900;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const proj = geoEquirectangular().scale(w / (2 * Math.PI)).translate([w / 2, h / 2]).precision(0.5);
  ctx.fillStyle = "#000";
  ctx.beginPath();
  geoPath(proj, ctx)(getWorld("low").land);
  ctx.fill();
  landMask = { data: ctx.getImageData(0, 0, w, h).data, w, h };
  return landMask;
}

/** True when [lng, lat] falls on land. */
export function isLand(lng: number, lat: number): boolean {
  const m = getLandMask();
  if (m) {
    const x = Math.min(m.w - 1, Math.max(0, Math.floor(((lng + 180) / 360) * m.w)));
    const y = Math.min(m.h - 1, Math.max(0, Math.floor(((90 - lat) / 180) * m.h)));
    return m.data[(y * m.w + x) * 4 + 3] > 127;
  }
  for (const { feature: f, bounds } of getLandIndex()) {
    const [[x0, y0], [x1, y1]] = bounds;
    if (lat < y0 || lat > y1) continue;
    // bounds that cross the antimeridian have x0 > x1
    if (x0 <= x1 ? lng < x0 || lng > x1 : lng < x0 && lng > x1) continue;
    if (geoContains(f, [lng, lat])) return true;
  }
  return false;
}

const dotCache = new Map<number, Float32Array>();

/**
 * Evenly spaced points on land, `spacing` degrees apart (measured along the surface),
 * returned as a flat [lng, lat, lng, lat, ...] array. Cached per spacing.
 */
export function getLandDots(spacing = 1.6): Float32Array {
  const hit = dotCache.get(spacing);
  if (hit) return hit;
  const out: number[] = [];
  for (let lat = -84; lat <= 84; lat += spacing) {
    const cos = Math.cos((lat * Math.PI) / 180);
    const count = Math.max(1, Math.round((360 * cos) / spacing));
    const step = 360 / count;
    // offset alternate rows by half a step for a hexagonal feel
    const offset = (Math.round((lat + 84) / spacing) % 2) * step * 0.5;
    for (let i = 0; i < count; i++) {
      const lng = -180 + offset + i * step;
      if (isLand(lng, lat)) out.push(lng, lat);
    }
  }
  const arr = new Float32Array(out);
  dotCache.set(spacing, arr);
  return arr;
}

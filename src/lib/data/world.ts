import type { Feature, FeatureCollection, MultiLineString, MultiPolygon, Polygon } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { feature, merge, mesh } from "topojson-client";
import { geoBounds, geoContains } from "d3-geo";
// Natural Earth 1:50m, lightly simplified (scripts/build-world.mjs)
import countriesTopo from "./world-50m.topo.json";
// India on its official boundary, and its neighbours trimmed to fit (scripts/build-world.mjs)
import southAsiaTopo from "./south-asia.topo.json";
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

let world: World | null = null;

/**
 * Natural Earth 1:110m land, countries and internal borders (parsed once, cached).
 * India and its neighbours come from south-asia.topo.json, so India is always drawn on
 * its official boundary; every other country is Natural Earth unchanged.
 */
export function getWorld(): World {
  if (world) return world;
  type Countries = Topology<{ countries: GeometryCollection<CountryProperties> }>;
  const ct = countriesTopo as unknown as Countries;
  const sa = southAsiaTopo as unknown as Countries;
  const toFeatures = (t: Countries) =>
    (feature(t, t.objects.countries) as unknown as FeatureCollection<Polygon | MultiPolygon, CountryProperties>).features.map(
      (f) => ({ ...f, id: String(f.id ?? f.properties.name) }),
    ) as CountryFeature[];

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
  world = {
    land: {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: merge(ct, ct.objects.countries.geometries as never) }],
    },
    countries,
    borders: { type: "MultiLineString", coordinates: [...outside.coordinates, ...inside.coordinates] },
  };
  return world;
}

export function findCountry(nameOrId: string): CountryFeature | undefined {
  const key = nameOrId.toLowerCase();
  return getWorld().countries.find((c) => c.id === nameOrId || c.properties.name.toLowerCase() === key);
}

let regions: RegionFeature[] | null = null;
/** Every country as a map region, keyed by ISO 3166-1 numeric id ("356" = India). */
export function getCountryRegions(): RegionFeature[] {
  if (!regions) regions = getWorld().countries.map((c) => ({ id: c.id, name: c.properties.name, geometry: c.geometry }));
  return regions;
}

/** Land polygons split out with their bounding boxes, for fast point-in-land tests. */
let landIndex: { feature: Feature<Polygon>; bounds: [[number, number], [number, number]] }[] | null = null;

function getLandIndex() {
  if (landIndex) return landIndex;
  landIndex = [];
  for (const f of getWorld().land.features) {
    const g = f.geometry;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const coordinates of polys) {
      const poly: Feature<Polygon> = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates } };
      landIndex.push({ feature: poly, bounds: geoBounds(poly) as [[number, number], [number, number]] });
    }
  }
  return landIndex;
}

/** True when [lng, lat] falls on land. */
export function isLand(lng: number, lat: number): boolean {
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

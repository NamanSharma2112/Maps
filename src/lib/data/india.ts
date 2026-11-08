import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { feature } from "topojson-client";
import indiaTopo from "./india-states.topo.json";
import type { RegionFeature } from "./regions";

/**
 * India's 28 states and 8 union territories, from DataMeet "Admin2" (CC BY 4.0,
 * https://github.com/datameet/maps), simplified. `id` is the ISO 3166-2:IN suffix (e.g. "MH").
 */
let states: RegionFeature[] | null = null;

export function getIndiaStates(): RegionFeature[] {
  if (states) return states;
  const t = indiaTopo as unknown as Topology<{ states: GeometryCollection<{ name: string }> }>;
  const fc = feature(t, t.objects.states) as unknown as FeatureCollection<Polygon | MultiPolygon, { name: string }>;
  states = fc.features
    .map((f) => ({ id: String(f.id), name: f.properties.name, geometry: f.geometry }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return states;
}

export const INDIA_ATTRIBUTION = "State boundaries: DataMeet India community, CC BY 4.0";

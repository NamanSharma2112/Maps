import { useMemo } from "react";
import { geoAzimuthalEqualArea, geoCentroid, geoArea, geoPath } from "d3-geo";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { getCountryRegions } from "../data/world";
import { citiesIn, findCity } from "../data/cities";
import type { City } from "../data/cities";
import type { RegionFeature } from "../data/regions";
import type { LatLng, MapArc, MapMarker } from "../types";
import { GeoMap } from "./GeoMap";
import type { BaseMapProps } from "./GeoMap";

export interface CountryMapProps extends BaseMapProps {
  /** Any country, by name ("Japan", "United States of America") or ISO numeric id ("392"). */
  country: string;
  /** Draw surrounding countries faded. Default true. */
  neighbours?: boolean;
  /** Mark the country's cities from the built-in list. Default true. */
  cities?: boolean;
  /** Animated plane trips between cities: city names or points. */
  trips?: { from: string | LatLng; to: string | LatLng }[];
  /** "mainland" frames the largest landmass (France without French Guiana, USA without Alaska); "all" frames everything. Default "mainland". */
  fit?: "mainland" | "all";
}

const toPoint = (p: string | LatLng): LatLng | undefined => (typeof p === "string" ? findCity(p) : p);

/** Any single country, framed in its own equal-area projection, with cities and plane trips. */
export function CountryMap({
  country,
  neighbours = true,
  cities = true,
  trips = [],
  fit = "mainland",
  variant = "solid",
  markers = [],
  arcs = [],
  arcVehicle = "plane",
  "aria-label": ariaLabel,
  ...rest
}: CountryMapProps) {
  const all = getCountryRegions();
  const key = country.toLowerCase();
  const region = all.find((r) => r.id === country || r.name.toLowerCase() === key);

  const setup = useMemo(() => {
    if (!region) return null;
    const polys = region.geometry.type === "Polygon" ? [region.geometry.coordinates] : region.geometry.coordinates;
    const main = polys.reduce((a, b) => (geoArea({ type: "Polygon", coordinates: b }) > geoArea({ type: "Polygon", coordinates: a }) ? b : a));
    const target: Feature<Polygon | MultiPolygon> = {
      type: "Feature",
      properties: {},
      geometry: fit === "mainland" ? { type: "Polygon", coordinates: main } : region.geometry,
    };
    const [lng, lat] = geoCentroid(target);
    const make = () => geoAzimuthalEqualArea().rotate([-lng, -lat]);
    const [[x0, y0], [x1, y1]] = geoPath(make().fitWidth(1000, target)).bounds(target);
    const aspect = Math.min(2, Math.max(0.8, (x1 - x0) / Math.max(1, y1 - y0)));
    const context: RegionFeature[] = neighbours ? all.filter((r) => r !== region && r.name !== "Antarctica") : [];
    return { make, target, aspect, context };
  }, [region, fit, neighbours, all]);

  const cityList: City[] = useMemo(() => (cities && region ? citiesIn(region.name) : []), [cities, region]);
  const cityMarkers: MapMarker[] = cityList.map((c) => ({
    lat: c.lat, lng: c.lng, label: c.name, description: c.capital ? "Capital" : undefined, size: c.capital ? 4 : 3, pulse: !!c.capital,
  }));
  const tripArcs: MapArc[] = trips.flatMap((t) => {
    const from = toPoint(t.from), to = toPoint(t.to);
    return from && to ? [{ from, to }] : [];
  });

  if (!region || !setup) {
    return <div className="mr-root mr-map mr-map--empty" role="note">Unknown country “{country}”.</div>;
  }
  return (
    <GeoMap
      {...rest}
      variant={variant}
      aria-label={ariaLabel ?? `Map of ${region.name}`}
      regions={[region]}
      context={setup.context}
      projection={setup.make}
      fit={setup.target}
      aspect={setup.aspect}
      fitPadding={0.06}
      regionFill={variant === "dots" ? "color-mix(in oklab, var(--mr-accent) 55%, var(--mr-dot))" : "color-mix(in oklab, var(--mr-accent) 18%, var(--mr-land))"}
      markers={[...cityMarkers, ...markers]}
      arcs={[...tripArcs, ...arcs]}
      arcVehicle={arcVehicle}
    />
  );
}

import { useMemo } from "react";
import { geoAzimuthalEqualArea, geoCentroid, geoArea, geoPath } from "d3-geo";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { getCountryRegions } from "../data/world";
import { citiesIn, findCity } from "../data/cities";
import type { City } from "../data/cities";
import type { RegionFeature } from "../data/regions";
import { boundsOfRegion, regionsNear } from "../data/regions";
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

const NONE_M: MapMarker[] = [];
const NONE_A: MapArc[] = [];
const toPoint = (p: string | LatLng): LatLng | undefined => (typeof p === "string" ? findCity(p) : p);

/** Any single country, framed in its own equal-area projection, with cities and plane trips. */
export function CountryMap({
  country,
  neighbours = true,
  cities = true,
  trips = [],
  fit = "mainland",
  variant = "solid",
  markers = NONE_M,
  arcs = NONE_A,
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
    // faded neighbours are background: the light data, and only what is near the country
    const [[bw, bs], [be, bn]] = boundsOfRegion({ ...region, geometry: target.geometry });
    const span = Math.max(20, (be - bw) * 0.6, (bn - bs) * 0.6);
    const context: RegionFeature[] = neighbours
      ? regionsNear(
          getCountryRegions("low").filter((r) => r.name !== region.name && r.name !== "Antarctica"),
          bw <= be ? [bw - span, bs - span, be + span, bn + span] : [-180, bs - span, 180, bn + span],
        )
      : [];
    return { make, target, aspect, context };
  }, [region, fit, neighbours, all]);

  const cityList: City[] = useMemo(() => (cities && region ? citiesIn(region.name) : []), [cities, region]);
  const allMarkers: MapMarker[] = useMemo(
    () => [
      ...cityList.map((c) => ({
        lat: c.lat, lng: c.lng, label: c.name, description: c.capital ? "Capital" : undefined, size: c.capital ? 4 : 3, pulse: !!c.capital,
      })),
      ...markers,
    ],
    [cityList, markers],
  );
  const tripKey = JSON.stringify(trips);
  const allArcs: MapArc[] = useMemo(
    () => [
      ...trips.flatMap((t) => {
        const from = toPoint(t.from), to = toPoint(t.to);
        return from && to ? [{ from, to }] : [];
      }),
      ...arcs,
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tripKey, arcs],
  );
  const regionList = useMemo(() => (region ? [region] : []), [region]);

  if (!region || !setup) {
    return <div className="mr-root mr-map mr-map--empty" role="note">Unknown country “{country}”.</div>;
  }
  return (
    <GeoMap
      {...rest}
      variant={variant}
      aria-label={ariaLabel ?? `Map of ${region.name}`}
      regions={regionList}
      context={setup.context}
      projection={setup.make}
      fit={setup.target}
      aspect={setup.aspect}
      fitPadding={0.06}
      regionFill={variant === "dots" ? "color-mix(in oklab, var(--mr-accent) 55%, var(--mr-dot))" : "color-mix(in oklab, var(--mr-accent) 18%, var(--mr-land))"}
      markers={allMarkers}
      arcs={allArcs}
      arcVehicle={arcVehicle}
    />
  );
}

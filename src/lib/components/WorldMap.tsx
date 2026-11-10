import { useMemo } from "react";
import { geoCircle, geoEqualEarth, geoEquirectangular, geoGraticule10, geoMercator, geoNaturalEarth1 } from "d3-geo";
import { getCountryRegions } from "../data/world";
import { extentOutline } from "../data/continents";
import { antisolarPoint } from "../utils/sun";
import { GeoMap } from "./GeoMap";
import type { BaseMapProps } from "./GeoMap";

export type WorldProjection = "equalEarth" | "naturalEarth" | "mercator" | "equirectangular";

export interface WorldMapProps extends BaseMapProps {
  /** Default "equalEarth". */
  projection?: WorldProjection;
  /** Latitude/longitude grid every 10°. */
  graticule?: boolean;
  /** Shade the night side. `true` uses the current time; pass a Date to fix it. */
  terminator?: boolean | Date;
  /** Include Antarctica. Default false. */
  antarctica?: boolean;
  /** "high" (default) uses Natural Earth 1:50m; "low" is ~4x lighter, for small or many maps. */
  detail?: "high" | "low";
}

const PROJECTIONS = {
  equalEarth: geoEqualEarth,
  naturalEarth: geoNaturalEarth1,
  mercator: geoMercator,
  equirectangular: geoEquirectangular,
};

/** Every country on one flat map — dotted or solid, with markers, arcs and choropleth data. */
export function WorldMap({
  projection = "equalEarth",
  graticule = false,
  terminator = false,
  antarctica = false,
  detail = "high",
  variant = "dots",
  "aria-label": ariaLabel = "World map",
  ...rest
}: WorldMapProps) {
  const regions = useMemo(
    () => getCountryRegions(detail).filter((r) => antarctica || (r.name !== "Antarctica" && r.name !== "Fr. S. Antarctic Lands")),
    [antarctica, detail],
  );
  const make = useMemo(() => PROJECTIONS[projection], [projection]);
  const fit = useMemo(
    () => extentOutline([-180, antarctica ? -85 : projection === "mercator" ? -56 : -58, 180, projection === "mercator" ? 80 : 84]),
    [antarctica, projection],
  );
  const night = terminator ? antisolarPoint(terminator instanceof Date ? terminator : new Date()) : null;

  return (
    <GeoMap
      {...rest}
      variant={variant}
      aria-label={ariaLabel}
      regions={regions}
      projection={make}
      fit={fit}
      underlay={graticule ? (path) => <path className="mr-graticule" d={path(geoGraticule10()) ?? ""} /> : undefined}
      overlay={
        night
          ? (path) => (
              <g>
                {[90, 86, 82].map((r) => (
                  <path key={r} className="mr-night" d={path(geoCircle().center([night.lng, night.lat]).radius(r)()) ?? ""} />
                ))}
              </g>
            )
          : undefined
      }
    />
  );
}

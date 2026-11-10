import { useMemo } from "react";
import { geoConicEqualArea } from "d3-geo";
import type { FeatureCollection } from "geojson";
import { getIndiaStates, INDIA_ATTRIBUTION } from "../data/india";
import { getCountryRegions } from "../data/world";
import { GeoMap } from "./GeoMap";
import type { BaseMapProps } from "./GeoMap";

export interface IndiaMapProps extends BaseMapProps {
  /** Show two-letter state codes at each state's centre. Default false. */
  labels?: boolean;
  /** Draw neighbouring countries faded. Default true. */
  neighbours?: boolean;
  /** Show the data credit line. Default true. */
  attribution?: boolean;
}

const NEIGHBOURS = ["Pakistan", "China", "Nepal", "Bhutan", "Bangladesh", "Myanmar", "Sri Lanka", "Afghanistan"];
const makeProjection = () => geoConicEqualArea().parallels([12, 28]).rotate([-82, 0]).center([0, 22]);

/** India's 28 states and 8 union territories. Keys: state name or ISO code ("MH", "KA", …). */
export function IndiaMap({
  legendPosition = "top-left",
  labels = false,
  neighbours = true,
  attribution = true,
  variant = "solid",
  "aria-label": ariaLabel = "Map of India by state",
  ...rest
}: IndiaMapProps) {
  const regions = useMemo(() => getIndiaStates(), []);
  const context = useMemo(
    () => (neighbours ? getCountryRegions("low").filter((r) => NEIGHBOURS.includes(r.name)) : []),
    [neighbours],
  );
  const fit = useMemo<FeatureCollection>(
    () => ({ type: "FeatureCollection", features: regions.map((r) => ({ type: "Feature", properties: {}, geometry: r.geometry })) }),
    [regions],
  );

  return (
    <GeoMap
      {...rest}
      variant={variant}
      aria-label={ariaLabel}
      regions={regions}
      context={context}
      projection={makeProjection}
      fit={fit}
      legendPosition={legendPosition}
      labels={labels}
      fitPadding={0.04}
      attribution={attribution ? INDIA_ATTRIBUTION : undefined}
    />
  );
}

import { useMemo } from "react";
import { CONTINENTS, extentOutline } from "../data/continents";
import type { Continent } from "../data/continents";
import { getCountryRegions } from "../data/world";
import { regionsNear } from "../data/regions";
import { GeoMap } from "./GeoMap";
import type { BaseMapProps } from "./GeoMap";

export interface ContinentMapProps extends BaseMapProps {
  continent: Continent;
  /** Draw surrounding countries faded. Default true. */
  neighbours?: boolean;
}

/** One continent, framed with its own equal-area projection; neighbours shown faded. */
export function ContinentMap({ continent, neighbours = true, variant = "solid", "aria-label": ariaLabel, ...rest }: ContinentMapProps) {
  const def = CONTINENTS[continent];
  const { regions, context } = useMemo(() => {
    const all = getCountryRegions();
    const members = new Set(def.countries);
    return {
      regions: all.filter((r) => members.has(r.name)),
      // faded neighbours are background: the light data, and only what is near the frame
      context: neighbours
        ? regionsNear(
            getCountryRegions("low").filter((r) => !members.has(r.name) && r.name !== "Antarctica"),
            [def.extent[0] - 30, def.extent[1] - 20, def.extent[2] + 30, def.extent[3] + 20],
          )
        : [],
    };
  }, [def, neighbours]);
  const fit = useMemo(() => extentOutline(def.extent), [def]);

  return (
    <GeoMap
      {...rest}
      variant={variant}
      aria-label={ariaLabel ?? `Map of ${def.name}`}
      regions={regions}
      context={context}
      projection={def.projection}
      fit={fit}
      aspect={def.aspect}
    />
  );
}

type PresetProps = Omit<ContinentMapProps, "continent">;
export const AfricaMap = (p: PresetProps) => <ContinentMap {...p} continent="africa" />;
export const AsiaMap = (p: PresetProps) => <ContinentMap {...p} continent="asia" />;
export const EuropeMap = (p: PresetProps) => <ContinentMap {...p} continent="europe" />;
export const NorthAmericaMap = (p: PresetProps) => <ContinentMap {...p} continent="north-america" />;
export const SouthAmericaMap = (p: PresetProps) => <ContinentMap {...p} continent="south-america" />;
export const OceaniaMap = (p: PresetProps) => <ContinentMap {...p} continent="oceania" />;
export const AntarcticaMap = (p: PresetProps) => <ContinentMap {...p} continent="antarctica" />;

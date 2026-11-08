import { Globe } from "./Globe";
import type { GlobeProps } from "./Globe";
import { WorldMap } from "./WorldMap";
import type { WorldMapProps } from "./WorldMap";

/* Ready-made looks. Every preset takes the full props of its base component, so any default can be overridden. */

/** Halftone land dots with a soft rim glow. */
export const DottedGlobe = (p: GlobeProps) => <Globe variant="dots" {...p} />;
/** Filled land with country borders and a 10° grid. */
export const SolidGlobe = (p: GlobeProps) => <Globe variant="solid" graticule {...p} />;
/** Coastlines and a 10° grid only — a technical, blueprint look. */
export const WireframeGlobe = (p: GlobeProps) => <Globe variant="outline" graticule atmosphere={false} {...p} />;
/** Live day and night: the night side follows the real sun position. */
export const DayNightGlobe = (p: GlobeProps) => <Globe variant="solid" terminator {...p} />;

/** Hexagonal dot lattice on Equal Earth. */
export const DottedWorldMap = (p: WorldMapProps) => <WorldMap variant="dots" {...p} />;
/** Country borders only, on Natural Earth with a 10° grid. */
export const OutlineWorldMap = (p: WorldMapProps) => <WorldMap variant="outline" projection="naturalEarth" graticule {...p} />;
/** Filled countries with the live night shadow. */
export const DayNightWorldMap = (p: WorldMapProps) => <WorldMap variant="solid" terminator {...p} />;
/** Web Mercator, as used by most tile maps. */
export const MercatorWorldMap = (p: WorldMapProps) => <WorldMap variant="solid" projection="mercator" {...p} />;

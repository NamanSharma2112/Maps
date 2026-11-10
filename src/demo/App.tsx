import { useEffect, useMemo, useState } from "react";
import { geoCentroid } from "d3-geo";
import type { ReactNode } from "react";
import {
  ContinentMap,
  Globe,
  IndiaMap,
  MapControls,
  MapLegend,
  WorldMap,
  DottedGlobe,
  SolidGlobe,
  WireframeGlobe,
  DayNightGlobe,
  DottedWorldMap,
  OutlineWorldMap,
  DayNightWorldMap,
  MercatorWorldMap,
  CountryMap,
  RankingBars,
  citiesIn,
  getCountryRegions,
  CITIES as CITY_LIST,
  CONTINENTS,
  formatCompact,
  formatNumber,
} from "../lib";
import type { Continent, LatLng, MapBubble, Region } from "../lib";
import { CITIES, HUB_ARCS, HUB_MARKERS, INDIA_CITIES, INDIA_POPULATION_2011, WORLD_POPULATION } from "./data";
import { Code } from "./Code";
import { Segmented, Toggle, LazyMount, InstallTabs } from "./ui";
import { Studio } from "./Studio";

const REPO = "https://github.com/NamanSharma2112/Maps";

/* ── theme ──────────────────────────────────────────────────── */

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const explicit = root.getAttribute("data-theme");
      const isDark = explicit ? explicit === "dark" : mq.matches;
      root.classList.toggle("dark", isDark);
      setDark(isDark);
    };
    sync();
    mq.addEventListener("change", sync);
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { mq.removeEventListener("change", sync); mo.disconnect(); };
  }, []);
  const toggle = () => document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
  return { dark, toggle };
}

/* ── small UI primitives ────────────────────────────────────── */

function Preview({ code, toolbar, children, footer, minHeight, shape = "map" }: { code: string; toolbar?: ReactNode; children: ReactNode; footer?: ReactNode; minHeight?: number; shape?: "map" | "globe" }) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  return (
    <div className="preview">
      <div className="preview__bar">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "preview"} className="tabs__btn" onClick={() => setTab("preview")}>Preview</button>
          <button type="button" role="tab" aria-selected={tab === "code"} className="tabs__btn" onClick={() => setTab("code")}>Code</button>
        </div>
        {tab === "preview" && toolbar ? <div className="preview__tools">{toolbar}</div> : null}
      </div>
      {tab === "preview" ? (
        <>
          <div className="preview__stage" style={{ minHeight }}><LazyMount shape={shape}>{children}</LazyMount></div>
          {footer}
        </>
      ) : (
        <Code code={code} />
      )}
    </div>
  );
}

type PropRow = [name: string, type: string, def: string, description: string];
function PropsTable({ rows }: { rows: PropRow[] }) {
  return (
    <div className="props">
      <table>
        <thead><tr><th>Prop</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
        <tbody>
          {rows.map(([n, t, d, desc]) => (
            <tr key={n}>
              <td><code className="pill">{n}</code></td>
              <td><code className="type">{t}</code></td>
              <td><code className="def">{d}</code></td>
              <td>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ id, title, badge, lead, children }: { id: string; title: string; badge?: string; lead: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="section" aria-labelledby={`${id}-h`}>
      <div className="section__head">
        <h2 id={`${id}-h`}>{title}{badge && <span className="badge">{badge}</span>}</h2>
        <p className="lead">{lead}</p>
      </div>
      {children}
    </section>
  );
}

const SHARED_PROPS: PropRow[] = [
  ["variant", '"solid" | "dots" | "outline"', "—", "Filled regions, a hexagonal dot lattice, or borders only."],
  ["data", "Record<string, number>", "—", "Values keyed by region name or id. Turns the map into a choropleth."],
  ["scale", '"quantile" | "linear"', '"quantile"', "How values are split into color bins."],
  ["steps", "number", "5", "Number of color bins. The ramp mixes the accent into the land tone."],
  ["valueLabel", "string", "—", "Names the value in the tooltip and legend."],
  ["formatValue", "(v: number) => string", "toLocaleString", "Formats values in tooltips and the legend."],
  ["markers", "MapMarker[]", "[]", "Points with label, color, size and pulse."],
  ["markerPulse", '"always" | "hover" | "none"', '"always"', "Marker ripple. Turned off under reduced motion."],
  ["legend", "boolean | string", "false", "Shows a legend for data; a string titles it."],
  ["zoomable", "boolean", "false", "Scroll to zoom, drag to pan, click a region to fly to it."],
  ["selected", "string | null", "—", "Outlines one region by name or id."],
  ["onRegionClick", "(region: Region) => void", "—", "Called with { id, name, value }."],
  ["dotGap", "number", "7", "Pixels between dots in the dots variant."],
];

/* ── sections ───────────────────────────────────────────────── */

const FOCUS_CITIES: { key: string; label: string; at: LatLng }[] = [
  { key: "delhi", label: "Delhi", at: CITIES.delhi },
  { key: "london", label: "London", at: CITIES.london },
  { key: "newYork", label: "New York", at: CITIES.newYork },
  { key: "tokyo", label: "Tokyo", at: CITIES.tokyo },
  { key: "sydney", label: "Sydney", at: CITIES.sydney },
];

function GlobeSection() {
  const [variant, setVariant] = useState<"dots" | "solid" | "outline">("dots");
  const [arcs, setArcs] = useState(true);
  const [night, setNight] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const target = FOCUS_CITIES.find((c) => c.key === focus)?.at ?? null;

  const code = `import { Globe } from "meridian-ui";

const arcs = [
  { from: { lat: 51.51, lng: -0.13 }, to: { lat: 40.71, lng: -74.01 } },
  { from: { lat: 1.35, lng: 103.82 }, to: { lat: 35.68, lng: 139.65 } },
];

export function NetworkGlobe() {
  return (
    <Globe
      variant="${variant}"
      markers={[{ lat: 28.61, lng: 77.21, label: "New Delhi" }]}
      arcs={arcs}${night ? "\n      terminator" : ""}
      autoRotate={8}
      ${target ? `focus={{ lat: ${target.lat}, lng: ${target.lng} }}` : "draggable"}
    />
  );
}`;

  return (
    <Section id="globe" title="Globe" lead="A canvas-rendered orthographic globe. Drag to spin with inertia; it eases back into auto-rotation when you let go. Arcs lift off the surface, travel along the great circle and ripple on arrival.">
      <Preview
        shape="globe"
        code={code}
        toolbar={
          <>
            <Segmented label="Land style" value={variant} onChange={setVariant} options={[{ value: "dots", label: "Dots" }, { value: "solid", label: "Solid" }, { value: "outline", label: "Outline" }]} />
            <Toggle checked={arcs} onChange={setArcs}>Arcs</Toggle>
            <Toggle checked={night} onChange={setNight}>Night</Toggle>
          </>
        }
        footer={
          <div className="preview__foot">
            <span className="muted">Fly to</span>
            <div className="chips">
              {FOCUS_CITIES.map((c) => (
                <button key={c.key} type="button" className="chip" aria-pressed={focus === c.key} onClick={() => setFocus(focus === c.key ? null : c.key)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="globe-stage">
          <Globe variant={variant} markers={HUB_MARKERS} arcs={arcs ? HUB_ARCS : []} terminator={night} focus={target} initialView={{ lat: 22, lng: 40 }} />
        </div>
      </Preview>
      <PropsTable
        rows={[
          ["variant", '"dots" | "solid" | "outline"', '"dots"', "Land treatment."],
          ["markers", "MapMarker[]", "[]", "Pulsing points. Hover for a tooltip."],
          ["arcs", "MapArc[]", "[]", "Animated great-circle routes { from, to, color?, delay? }."],
          ["autoRotate", "number", "8", "Degrees per second. 0 stops rotation."],
          ["draggable", "boolean", "true", "Drag to spin, with inertia."],
          ["focus", "LatLng | null", "null", "Smoothly turns to face a point and holds there."],
          ["initialView", "LatLng", "{ lat: 20, lng: 10 }", "Where the globe faces on first render."],
          ["terminator", "boolean | Date", "false", "Shades the night side for now, or a given time."],
          ["atmosphere", "boolean", "true", "Soft accent glow around the rim."],
          ["graticule", "boolean", "false", "10° latitude and longitude grid."],
          ["dotSpacing", "number", "1.6", "Degrees between land dots."],
          ["size", "number", "container width", "Diameter in px."],
        ]}
      />
    </Section>
  );
}

function WorldSection() {
  const [variant, setVariant] = useState<"dots" | "solid" | "outline">("dots");
  const [mode, setMode] = useState<"network" | "population">("network");
  const population = mode === "population";

  const code = population
    ? `import { WorldMap } from "meridian-ui";

// values keyed by country name or ISO numeric id
const population = { India: 1428, China: 1425, "United States of America": 340 /* … */ };

<WorldMap
  variant="${variant}"
  data={population}
  valueLabel="Population"
  formatValue={(v) => \`\${v.toLocaleString()} M\`}
  legend="Population, millions"
  zoomable
/>`
    : `import { WorldMap } from "meridian-ui";

<WorldMap
  variant="${variant}"
  markers={offices}
  arcs={routes}
  zoomable
/>`;

  return (
    <Section id="world-map" title="World map" lead="Every country on one flat Equal Earth projection, with India on its official boundary. Dots are laid on a hexagonal lattice, so the map stays sharp at any size. Hovering a country fades the rest; scroll or use the buttons to zoom, and click a country to fly to it.">
      <Preview
        code={code}
        toolbar={
          <>
            <Segmented label="Land style" value={variant} onChange={setVariant} options={[{ value: "dots", label: "Dots" }, { value: "solid", label: "Solid" }, { value: "outline", label: "Outline" }]} />
            <Segmented label="Data" value={mode} onChange={setMode} options={[{ value: "network", label: "Routes" }, { value: "population", label: "Population" }]} />
          </>
        }
      >
        <WorldMap
          variant={variant}
          markers={population ? [] : HUB_MARKERS}
          arcs={population ? [] : HUB_ARCS}
          data={population ? WORLD_POPULATION : undefined}
          valueLabel="Population"
          formatValue={(v) => `${formatNumber(v)} M`}
          legend={population ? "Population, millions (2023, approx.)" : false}
          zoomable
        />
      </Preview>
      <PropsTable
        rows={[
          ["projection", '"equalEarth" | "naturalEarth" | "mercator" | "equirectangular"', '"equalEarth"', "Map projection."],
          ["arcs", "MapArc[]", "[]", "Curved routes that draw, travel and ripple on arrival."],
          ["terminator", "boolean | Date", "false", "Shades the night side."],
          ["graticule", "boolean", "false", "10° grid under the land."],
          ["antarctica", "boolean", "false", "Include Antarctica."],
          ...SHARED_PROPS,
        ]}
      />
    </Section>
  );
}

function IndiaSection() {
  const [variant, setVariant] = useState<"solid" | "dots">("solid");
  const [labels, setLabels] = useState(false);
  const [cities, setCities] = useState(true);
  const [picked, setPicked] = useState<Region | null>(null);

  const code = `import { IndiaMap } from "meridian-ui";

// keys can be state names or ISO 3166-2 codes ("MH", "UP", "KA", …)
const population = { "Uttar Pradesh": 199812341, Maharashtra: 112374333, Bihar: 104099452 /* … */ };

<IndiaMap
  variant="${variant}"
  data={population}
  valueLabel="Population"
  legend="Population, Census 2011"${labels ? "\n  labels" : ""}${cities ? "\n  markers={cities}" : ""}
  zoomable
  onRegionClick={(state) => console.log(state.name, state.value)}
/>`;

  return (
    <Section id="india-map" title="India map" badge="36 regions" lead="All 28 states and 8 union territories, on official boundaries, in an equal-area conic projection fitted to India. Neighbouring countries sit faded for context. Keys accept state names or ISO 3166-2 codes.">
      <Preview
        code={code}
        toolbar={
          <>
            <Segmented label="Land style" value={variant} onChange={setVariant} options={[{ value: "solid", label: "Solid" }, { value: "dots", label: "Dots" }]} />
            <Toggle checked={labels} onChange={setLabels}>Codes</Toggle>
            <Toggle checked={cities} onChange={setCities}>Cities</Toggle>
          </>
        }
        footer={
          <div className="preview__foot readout" aria-live="polite">
            {picked ? (
              <>
                <span className="readout__name">{picked.name}</span>
                <span className="readout__code">IN-{picked.id}</span>
                <span className="readout__value">{picked.value !== undefined ? `${formatNumber(picked.value)} people` : "No data"}</span>
              </>
            ) : (
              <span className="muted">Click a state to zoom to it. Click it again to zoom out.</span>
            )}
          </div>
        }
      >
        <div className="india-stage">
          <IndiaMap
            variant={variant}
            data={INDIA_POPULATION_2011}
            valueLabel="Population"
            formatValue={formatCompact}
            legend="Population, Census 2011"
            labels={labels}
            markers={cities ? INDIA_CITIES : []}
            selected={picked?.id}
            zoomable
            onRegionClick={(r) => setPicked((p) => (p?.id === r.id ? null : r))}
            dotGap={6}
          />
        </div>
      </Preview>
      <PropsTable
        rows={[
          ["labels", "boolean", "false", "Two-letter state codes at each state's centre; more appear as you zoom."],
          ["neighbours", "boolean", "true", "Draws Pakistan, China, Nepal, Bangladesh and others faded."],
          ["attribution", "boolean", "true", "Credit line for the DataMeet boundary data (CC BY 4.0)."],
          ...SHARED_PROPS,
        ]}
      />
    </Section>
  );
}

const CONTINENT_KEYS = Object.keys(CONTINENTS) as Continent[];
const SHORT: Record<Continent, string> = {
  africa: "Africa", asia: "Asia", europe: "Europe", "north-america": "N. America",
  "south-america": "S. America", oceania: "Oceania", antarctica: "Antarctica",
};
const PRESET: Record<Continent, string> = {
  africa: "AfricaMap", asia: "AsiaMap", europe: "EuropeMap", "north-america": "NorthAmericaMap",
  "south-america": "SouthAmericaMap", oceania: "OceaniaMap", antarctica: "AntarcticaMap",
};

function ContinentSection() {
  const [continent, setContinent] = useState<Continent>("africa");
  const [variant, setVariant] = useState<"solid" | "dots">("solid");
  const name = CONTINENTS[continent].name;
  const count = CONTINENTS[continent].countries.length;
  const hasData = continent !== "antarctica";

  const code = `import { ${PRESET[continent]} } from "meridian-ui";
// or: <ContinentMap continent="${continent}" />

<${PRESET[continent]}
  variant="${variant}"${hasData ? `
  data={population}
  legend="Population, millions"` : ""}
  zoomable
/>`;

  return (
    <Section id="continent-map" title="Continent maps" badge="7 presets" lead="One component per continent, each framed with its own equal-area projection so shapes and sizes stay true. Use ContinentMap with a continent prop, or the named presets.">
      <Preview
        code={code}
        toolbar={<Segmented label="Land style" value={variant} onChange={setVariant} options={[{ value: "solid", label: "Solid" }, { value: "dots", label: "Dots" }]} />}
        footer={
          <div className="preview__foot">
            <span className="muted">{name} · {count} {count === 1 ? "country" : "countries"}</span>
          </div>
        }
      >
        <div className="continent-stage">
          <ContinentMap
            key={continent}
            continent={continent}
            variant={variant}
            data={hasData ? WORLD_POPULATION : undefined}
            valueLabel="Population"
            formatValue={(v) => `${formatNumber(v)} M`}
            legend={hasData ? "Population, millions" : false}
            zoomable
            dotGap={6}
          />
        </div>
      </Preview>
      <div className="continent-grid" role="list">
        {CONTINENT_KEYS.map((c) => (
          <button key={c} type="button" role="listitem" className="continent-card" aria-pressed={continent === c} onClick={() => setContinent(c)}>
            <div className="continent-card__map">
              <LazyMount aspect={CONTINENTS[c].aspect}><ContinentMap continent={c} interactive={false} neighbours={false} aria-label={`${CONTINENTS[c].name} thumbnail`} /></LazyMount>
            </div>
            <div className="continent-card__meta">
              <span>{SHORT[c]}</span>
              <code>{PRESET[c]}</code>
            </div>
          </button>
        ))}
      </div>
      <PropsTable
        rows={[
          ["continent", '"africa" | "asia" | "europe" | "north-america" | "south-america" | "oceania" | "antarctica"', "—", "Which continent to frame. Not needed on the presets."],
          ["neighbours", "boolean", "true", "Draws surrounding countries faded."],
          ...SHARED_PROPS,
        ]}
      />
    </Section>
  );
}

function PartsSection() {
  const ramp = useMemo(() => [22, 42, 61, 81, 100].map((p) => `color-mix(in oklab, var(--mr-accent) ${p}%, var(--mr-land))`), []);
  const code = `import { MapLegend, MapControls } from "meridian-ui";

<MapLegend title="Population" colors={ramp} min={64473} max={199812341} format={formatCompact} />

<MapLegend
  title="Network"
  items={[
    { label: "Hub", color: "var(--mr-accent)" },
    { label: "Edge", color: "var(--mr-dot)" },
  ]}
/>

<MapControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={reset} />`;
  return (
    <Section id="legend-controls" title="Legend and controls" lead="The pieces the maps use, exported on their own so they match anything else you put on the page.">
      <Preview code={code}>
        <div className="parts">
          <div className="parts__cell">
            <MapLegend title="Population, Census 2011" colors={ramp} min={64473} max={199812341} format={formatCompact} />
          </div>
          <div className="parts__cell">
            <MapLegend title="Network" items={[{ label: "Hub", color: "var(--mr-accent)" }, { label: "Edge node", color: "var(--mr-dot)" }, { label: "Offline", color: "var(--mr-land)" }]} />
          </div>
          <div className="parts__cell">
            <MapControls canZoomOut={false} />
          </div>
        </div>
      </Preview>
    </Section>
  );
}


const GLOBE_STYLES = [
  { name: "DottedGlobe", note: "Halftone land, rim glow", el: <DottedGlobe arcs={HUB_ARCS.slice(0, 4)} markers={HUB_MARKERS.slice(0, 6)} initialView={{ lat: 30, lng: 10 }} /> },
  { name: "SolidGlobe", note: "Filled land, borders, 10° grid", el: <SolidGlobe markers={HUB_MARKERS.slice(6)} initialView={{ lat: 20, lng: 100 }} /> },
  { name: "WireframeGlobe", note: "Coastlines and grid only", el: <WireframeGlobe arcs={HUB_ARCS.slice(4, 8)} initialView={{ lat: 10, lng: -60 }} /> },
  { name: "DayNightGlobe", note: "Night side follows the real sun", el: <DayNightGlobe autoRotate={4} initialView={{ lat: 20, lng: 78 }} /> },
];
const MAP_STYLES = [
  { name: "DottedWorldMap", note: "Hex dot lattice, Equal Earth", el: <DottedWorldMap detail="low" markers={HUB_MARKERS} interactive={false} dotGap={5} /> },
  { name: "OutlineWorldMap", note: "Borders only, Natural Earth + grid", el: <OutlineWorldMap detail="low" arcs={HUB_ARCS.slice(0, 5)} /> },
  { name: "DayNightWorldMap", note: "Live night shadow", el: <DayNightWorldMap detail="low" markers={HUB_MARKERS.map(({ label, ...m }) => ({ ...m, description: label }))} /> },
  { name: "MercatorWorldMap", note: "Web Mercator projection", el: <MercatorWorldMap detail="low" data={WORLD_POPULATION} valueLabel="Population" formatValue={(v) => `${formatNumber(v)} M`} /> },
];

function GallerySection() {
  return (
    <Section id="gallery" title="Styles gallery" badge="8 presets" lead="Ready-made looks for globes and world maps. Each preset takes every prop of its base component, so any default can be changed.">
      <h3 className="gallery__h">Globes</h3>
      <div className="gallery gallery--globes">
        {GLOBE_STYLES.map((g) => (
          <figure key={g.name} className="gallery__card">
            <div className="gallery__stage"><LazyMount shape={g.name.includes("Globe") ? "globe" : "map"}>{g.el}</LazyMount></div>
            <figcaption><code>{`<${g.name} />`}</code><span>{g.note}</span></figcaption>
          </figure>
        ))}
      </div>
      <h3 className="gallery__h">World maps</h3>
      <div className="gallery gallery--maps">
        {MAP_STYLES.map((g) => (
          <figure key={g.name} className="gallery__card">
            <div className="gallery__stage"><LazyMount shape={g.name.includes("Globe") ? "globe" : "map"}>{g.el}</LazyMount></div>
            <figcaption><code>{`<${g.name} />`}</code><span>{g.note}</span></figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}



/* ── any country ─────────────────────────────────────────────── */

const ALL_COUNTRIES = getCountryRegions().map((r) => r.name).filter((n) => n !== "Antarctica").sort();

function CountrySection() {
  const [name, setName] = useState("Japan");
  const [draft, setDraft] = useState("Japan");
  const [variant, setVariant] = useState<"solid" | "dots" | "outline">("solid");
  const [showCities, setShowCities] = useState(true);
  const [showTrips, setShowTrips] = useState(true);
  const [fit, setFit] = useState<"mainland" | "all">("mainland");
  const cities = citiesIn(name);
  const trips = showTrips ? cities.slice(0, 4).slice(1).map((c, i) => ({ from: (i === 0 ? cities[0] : cities[i]).name, to: c.name })) : [];
  const pick = (v: string) => {
    setDraft(v);
    const hit = ALL_COUNTRIES.find((n) => n.toLowerCase() === v.trim().toLowerCase());
    if (hit) setName(hit);
  };

  const code = `import { CountryMap } from "meridian-ui";

<CountryMap
  country="${name}"
  variant="${variant}"${showCities ? "" : "\n  cities={false}"}${trips.length ? `
  trips={[
${trips.map((t) => `    { from: "${t.from}", to: "${t.to}" },`).join("\n")}
  ]}` : ""}${fit === "all" ? `\n  fit="all"` : ""}
  zoomable
/>`;

  return (
    <Section id="country-map" title="Country map" badge={`${ALL_COUNTRIES.length} countries`} lead="Any country on its own, framed in an equal-area projection centred on it. Its cities come built in, and trips fly a plane between them. Pass city names or coordinates.">
      <datalist id="country-list">{ALL_COUNTRIES.map((n) => <option key={n} value={n} />)}</datalist>
      <Preview
        code={code}
        toolbar={
          <>
            <input className="input input--sm" list="country-list" value={draft} onChange={(e) => pick(e.target.value)} aria-label="Country" placeholder="Type a country…" />
            <Segmented label="Land style" value={variant} onChange={setVariant} options={[{ value: "solid", label: "Solid" }, { value: "dots", label: "Dots" }, { value: "outline", label: "Outline" }]} />
            <Segmented label="Framing" value={fit} onChange={setFit} options={[{ value: "mainland", label: "Mainland" }, { value: "all", label: "All land" }]} />
            <Toggle checked={showCities} onChange={setShowCities}>Cities</Toggle>
            <Toggle checked={showTrips} onChange={setShowTrips}>Trips</Toggle>
          </>
        }
        footer={
          <div className="preview__foot">
            <div className="chips">
              {["India", "Japan", "United States of America", "Brazil", "Australia", "France", "Egypt"].map((c) => (
                <button key={c} type="button" className="chip" aria-pressed={name === c} onClick={() => pick(c)}>{c === "United States of America" ? "USA" : c}</button>
              ))}
            </div>
            <span className="muted">{cities.length ? `${cities.length} built-in ${cities.length === 1 ? "city" : "cities"}` : "No built-in cities: add markers"}</span>
          </div>
        }
      >
        <div className="country-stage">
          <CountryMap key={`${name}-${fit}`} country={name} variant={variant} cities={showCities} trips={trips} fit={fit} zoomable dotGap={6} />
        </div>
      </Preview>
      <PropsTable
        rows={[
          ["country", "string", "—", "Any country by name or ISO numeric id."],
          ["cities", "boolean", "true", "Marks the country's built-in cities; the capital pulses."],
          ["trips", "{ from, to }[]", "[]", "Plane flights between city names or { lat, lng } points."],
          ["fit", '"mainland" | "all"', '"mainland"', "Frame the largest landmass, or every territory."],
          ["neighbours", "boolean", "true", "Surrounding countries drawn faded."],
          ["arcVehicle", '"plane" | "dot"', '"plane"', "What flies along trips and arcs."],
          ...SHARED_PROPS,
        ]}
      />
    </Section>
  );
}

/* ── charts on maps ──────────────────────────────────────────── */

const POP_BUBBLES: MapBubble[] = getCountryRegions()
  .filter((r) => WORLD_POPULATION[r.name] !== undefined)
  .map((r) => {
    const [lng, lat] = geoCentroid(r.geometry);
    return { lat, lng, value: WORLD_POPULATION[r.name], label: r.name };
  });

function ChartsSection() {
  const [mode, setMode] = useState<"choropleth" | "bubbles" | "spikes">("bubbles");
  const [hl, setHl] = useState<string | null>(null);
  const code = `import { WorldMap, RankingBars } from "meridian-ui";

${mode === "choropleth" ? `<WorldMap variant="solid" data={population} legend="Population, millions" />` : `<WorldMap
  variant="dots"
  bubbles={countries.map((c) => ({ lat: c.lat, lng: c.lng, value: c.population, label: c.name }))}
  bubbleStyle="${mode === "spikes" ? "spike" : "circle"}"
/>`}

<RankingBars data={population} limit={8} title="Most populous" />`;
  return (
    <Section id="charts" title="Charts on maps" badge="New" lead="Show quantities three ways: a choropleth, proportional bubbles, or spikes. Each animates in. Pair the map with RankingBars, which highlights in step as you hover either one.">
      <Preview
        code={code}
        toolbar={<Segmented label="Chart" value={mode} onChange={setMode} options={[{ value: "bubbles", label: "Bubbles" }, { value: "spikes", label: "Spikes" }, { value: "choropleth", label: "Choropleth" }]} />}
      >
        <div className="charts">
          <WorldMap
            key={mode}
            variant={mode === "choropleth" ? "solid" : "dots"}
            data={mode === "choropleth" ? WORLD_POPULATION : undefined}
            bubbles={mode === "choropleth" ? [] : POP_BUBBLES}
            bubbleStyle={mode === "spikes" ? "spike" : "circle"}
            valueLabel="Population"
            formatValue={(v) => `${formatNumber(v)} M`}
            legend={mode === "choropleth" ? "Population, millions" : false}
            selected={hl}
            onRegionHover={(r) => setHl(r?.name ?? null)}
            dotGap={6}
          />
          <RankingBars data={WORLD_POPULATION} limit={8} title="Most populous, millions" highlight={hl} onHover={setHl} format={(v) => formatNumber(v)} />
        </div>
      </Preview>
      <PropsTable
        rows={[
          ["bubbles", "MapBubble[]", "[]", "{ lat, lng, value, label?, color? } on any flat map."],
          ["bubbleStyle", '"circle" | "spike"', '"circle"', "Circle area or spike height scales with value."],
          ["bubbleSize", "number", "26", "Largest radius in px (spikes reach 3×)."],
          ["RankingBars data", "Record<string, number> | rows", "—", "Sorted, animated bars; limit, title, format, highlight, onHover."],
        ]}
      />
    </Section>
  );
}

/* ── page ───────────────────────────────────────────────────── */

const NAV = [
  { id: "globe", label: "Globe" },
  { id: "world-map", label: "World map" },
  { id: "gallery", label: "Styles gallery" },
  { id: "country-map", label: "Country map" },
  { id: "charts", label: "Charts on maps" },
  { id: "india-map", label: "India map" },
  { id: "continent-map", label: "Continent maps" },
  { id: "legend-controls", label: "Legend and controls" },
];

/** Sidebar with scroll-spy. Its state lives here so scrolling only re-renders this list. */
function Sidebar() {
  const [active, setActive] = useState("globe");
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    [...NAV.map((n) => n.id), "theming"].forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  return (
    <aside className="side" aria-label="Components">
      <div className="side__title">Components</div>
      {NAV.map((n) => (
        <a key={n.id} href={`#${n.id}`} className="side__link" aria-current={active === n.id ? "true" : undefined}>
          {n.label}
        </a>
      ))}
      <div className="side__title side__title--gap">Usage</div>
      <a href="#theming" className="side__link" aria-current={active === "theming" ? "true" : undefined}>Theming</a>
    </aside>
  );
}

export default function App() {
  const { dark, toggle } = useTheme();
  const [view, setView] = useState<"dev" | "creators">(() => (location.hash === "#creators" ? "creators" : "dev"));
  useEffect(() => {
    const on = () => setView(location.hash === "#creators" ? "creators" : "dev");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  return (
    <>
      <header className="top">
        <div className="top__inner">
          <a className="brand" href="#top" aria-label="Meridian UI home">
            <svg viewBox="0 0 20 20" aria-hidden="true" className="brand__mark">
              <circle cx="10" cy="10" r="8.25" />
              <ellipse cx="10" cy="10" rx="3.5" ry="8.25" />
              <path d="M1.75 10h16.5" />
            </svg>
            Meridian <span className="brand__ui">UI</span>
          </a>
          <nav className="top__nav" aria-label="Main">
            <a href="#developers" aria-current={view === "dev" ? "page" : undefined}>Developers</a>
            <a href="#creators" aria-current={view === "creators" ? "page" : undefined}>Creators</a>
            <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
          </nav>
          <button type="button" className="icon-btn" onClick={toggle} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
            {dark ? (
              <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" /></svg>
            ) : (
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1z" /></svg>
            )}
          </button>
        </div>
      </header>

      <main id="top">
        {view === "creators" ? (
          <Studio />
        ) : (<>
        <section className="hero">
          <div className="hero__copy">
            <span className="eyebrow">React · d3-geo · no tile server</span>
            <h1>Maps and globes, ready to drop in.</h1>
            <p className="hero__lead">
              Animated, themeable components for the world, India and every continent. Dotted or solid land, choropleth data,
              pulsing markers and travelling arcs, drawn locally from Natural Earth and DataMeet boundaries.
            </p>
            <InstallTabs />
            <div className="hero__actions">
              <a className="btn btn--primary" href="#globe">Browse components</a>
              <a className="btn" href="#creators">Video maps for creators</a>
              <a className="btn" href={REPO} target="_blank" rel="noreferrer">View on GitHub</a>
            </div>
          </div>
          <div className="hero__globe">
            <Globe markers={HUB_MARKERS} arcs={HUB_ARCS} initialView={{ lat: 18, lng: 55 }} autoRotate={6} aria-label="Globe with animated routes between 14 cities" />
          </div>
        </section>
        <section className="stats" aria-label="At a glance">
          <div><b>11</b><span>Components</span></div>
          <div><b>15</b><span>Ready-made presets</span></div>
          <div><b>{ALL_COUNTRIES.length}</b><span>Countries and territories</span></div>
          <div><b>36</b><span>Indian states and UTs</span></div>
          <div><b>{CITY_LIST.length}</b><span>Built-in cities</span></div>
                  </section>

        <div className="docs">
          <Sidebar />

          <div className="content">
            <GlobeSection />
            <WorldSection />
            <GallerySection />
            <CountrySection />
            <ChartsSection />
            <IndiaSection />
            <ContinentSection />
            <PartsSection />

            <section id="theming" className="section">
              <div className="section__head">
                <h2>Theming</h2>
                <p className="lead">
                  Every color is a CSS variable. Add <code>.dark</code> or <code>data-theme="dark"</code> to any ancestor
                  for the dark palette, or override tokens to match your brand.
                </p>
              </div>
              <Code
                code={`import "meridian-ui/styles.css";

:root {
  --mr-accent: oklch(0.585 0.233 277.117);  /* markers, arcs, data ramp */
  --mr-land: oklch(0.922 0 0);              /* solid land, empty bins */
  --mr-dot: oklch(0.80 0 0);                /* dotted land */
  --mr-ocean: oklch(0.985 0 0);             /* globe sphere */
  --mr-atmosphere: oklch(0.585 0.233 277.117 / 0.14);
}`}
              />
            </section>

            <footer className="foot">
              <span>Meridian UI · MIT</span>
              <span>Country shapes: Natural Earth (public domain). India on its official boundary in every map; states from DataMeet, CC BY 4.0.</span>
            </footer>
          </div>
        </div>
        </>)}
      </main>
    </>
  );
}

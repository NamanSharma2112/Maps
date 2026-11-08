/**
 * Builds src/lib/data/south-asia.topo.json: India and its neighbours, with India on its
 * official outline (the Survey of India depiction,
 * via DataMeet's India composite — the same data IndiaMap draws).
 *
 *   1. India      = dissolve of all 36 states / UTs in india-states.topo.json
 *   2. neighbours = Natural Earth shapes with that outline erased
 *                   (Pakistan loses PoK and Gilgit-Baltistan, China loses Aksai Chin and Shaksgam)
 *   3. leftovers  = slivers from the scale mismatch: land Natural Earth gave India that lies outside
 *                   the official line, and bits of a neighbour cut off from it. Each goes to the
 *                   nearest neighbour, never to India, so India's outline stays exactly official.
 *
 * Run: node scripts/build-world.mjs
 */
import mapshaper from "mapshaper";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { geoArea, geoDistance } from "d3-geo";

const require = createRequire(import.meta.url);
const tmp = mkdtempSync(join(tmpdir(), "meridian-"));
const f = (name) => join(tmp, name);
const read = (name) => JSON.parse(readFileSync(f(name), "utf8"));
const world = require.resolve("world-atlas/countries-110m.json");
const india = new URL("../src/lib/data/india-states.topo.json", import.meta.url).pathname;
const out = new URL("../src/lib/data/south-asia.topo.json", import.meta.url).pathname;

const R = 6371.0088;
// rings may arrive in either winding order; take the smaller of the shape and its complement
const km2 = (coords) => { const a = geoArea({ type: "Polygon", coordinates: coords }); return Math.min(a, 4 * Math.PI - a) * R * R; };
const NEIGHBOURS = ["Pakistan", "China", "Nepal", "Bhutan", "Bangladesh", "Myanmar", "Afghanistan", "Sri Lanka"];

// 1. official India
await mapshaper.runCommands(`-i ${india} -dissolve -o format=geojson ${f("india.json")}`);
// 2. everything else, with India's official area cut out
await mapshaper.runCommands(
  `-i ${world} -target countries -filter 'name !== "India"' -erase ${f("india.json")} -o format=geojson ${f("rest.json")}`,
);
// 3a. land Natural Earth called India that falls outside the official line
await mapshaper.runCommands(
  `-i ${world} -target countries -filter 'name === "India"' -erase ${f("india.json")} -explode -o format=geojson ${f("gaps.json")}`,
);

const rest = read("rest.json");
const indiaOut = read("india.json");
const officialIndia = indiaOut.features ? indiaOut.features[0].geometry : indiaOut.geometries[0];
const vertices = (polys) => polys.flatMap((p) => p[0]);
const polysOf = (geom) => (geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates);
const minDist = (a, b) => {
  let best = Infinity;
  for (let i = 0; i < a.length; i += 2) for (let j = 0; j < b.length; j += 2) best = Math.min(best, geoDistance(a[i], b[j]));
  return best * R;
};
let moved = 0, dropped = 0;

/**
 * Pulls off parts of a neighbour that the cut separated from its main body, then gives every
 * leftover piece to a neighbour it touches (within 5 km). A piece that touches no neighbour is
 * dropped as water. India is never a candidate, so its outline stays exactly official.
 */
function reassign(features, pieces) {
  for (const feat of features) {
    const name = feat.properties.name;
    if (!NEIGHBOURS.includes(name) || feat.geometry?.type !== "MultiPolygon") continue;
    const parts = feat.geometry.coordinates.map((c) => ({ c, a: km2(c) })).sort((x, y) => y.a - x.a);
    const keep = [parts[0].c];
    for (const p of parts.slice(1)) {
      if (p.a < 10000 && minDist(p.c[0], parts[0].c[0]) > 2) pieces.push({ coords: p.c, exclude: name });
      else keep.push(p.c);
    }
    feat.geometry = keep.length === 1 ? { type: "Polygon", coordinates: keep[0] } : { type: "MultiPolygon", coordinates: keep };
  }
  const byName = new Map(features.map((x) => [x.properties.name, x]));
  for (const piece of pieces) {
    let owner = null, best = Infinity;
    for (const n of NEIGHBOURS) {
      if (n === piece.exclude || !byName.get(n)?.geometry) continue;
      const d = minDist(piece.coords[0], vertices(polysOf(byName.get(n).geometry)));
      if (d < best) { best = d; owner = n; }
    }
    if (!owner || best > 5) { dropped++; continue; }
    const feat = byName.get(owner);
    feat.geometry = { type: "MultiPolygon", coordinates: [...polysOf(feat.geometry), piece.coords] };
    moved++;
  }
  return features
    .filter((x) => x.geometry)
    .map((x) => ({ ...x, properties: { name: x.properties.name, id: x.properties.id ?? x.id ?? x.properties.name } }));
}

const gapPieces = read("gaps.json").features.filter((g) => g.geometry?.type === "Polygon").map((g) => ({ coords: g.geometry.coordinates, exclude: null }));
rest.features = reassign(rest.features, gapPieces);
writeFileSync(f("others.json"), JSON.stringify(rest));

// union the pieces into their countries, close hairline gaps (India not present), cut India out again,
// then catch anything that cut separated and union once more
await mapshaper.runCommands(
  `-i ${f("others.json")} -dissolve fields=name copy-fields=id -clean gap-fill-area=50km2 ` +
    `-erase ${f("india.json")} -o format=geojson ${f("pass1.json")}`,
);
const pass1 = read("pass1.json");
pass1.features = reassign(pass1.features, []);
writeFileSync(f("pass1b.json"), JSON.stringify(pass1));
await mapshaper.runCommands(
  `-i ${f("pass1b.json")} -dissolve fields=name copy-fields=id -erase ${f("india.json")} -o format=geojson ${f("others-clean.json")}`,
);
const others = read("others-clean.json");
// last pass: drop any fragment still cut off from its country's main body
for (const feat of others.features) {
  if (!NEIGHBOURS.includes(feat.properties.name) || feat.geometry?.type !== "MultiPolygon") continue;
  const parts = feat.geometry.coordinates.map((c) => ({ c, a: km2(c) })).sort((x, y) => y.a - x.a);
  const keep = [parts[0].c, ...parts.slice(1).filter((p) => !(p.a < 10000 && minDist(p.c[0], parts[0].c[0]) > 2)).map((p) => p.c)];
  dropped += parts.length - keep.length;
  feat.geometry = keep.length === 1 ? { type: "Polygon", coordinates: keep[0] } : { type: "MultiPolygon", coordinates: keep };
}
others.features = others.features
  .filter((x) => x.geometry)
  .concat({ type: "Feature", properties: { name: "India", id: "356" }, geometry: officialIndia });
writeFileSync(f("merged.json"), JSON.stringify(others));

// India goes in untouched; no clean-up runs on the final layer. Only South Asia is written out —
// every other country keeps its original Natural Earth shape (incl. antimeridian handling).
const KEEP = JSON.stringify(["India", ...NEIGHBOURS]);
await mapshaper.runCommands(
  `-i ${f("merged.json")} -filter '${KEEP}.includes(name)' -rename-layers countries -o format=topojson id-field=id quantization=100000 ${out}`,
);

const topo = JSON.parse(readFileSync(out, "utf8"));
for (const g of topo.objects.countries.geometries) {
  const name = g.properties.name;
  g.id = g.id && g.id !== name ? String(g.id) : undefined;
  g.properties = { name };
}
writeFileSync(out, JSON.stringify(topo));
console.log(`countries: ${topo.objects.countries.geometries.length}, leftover pieces reassigned: ${moved}, dropped as water: ${dropped} → ${out}`);
rmSync(tmp, { recursive: true, force: true });

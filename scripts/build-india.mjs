/**
 * Builds src/lib/data/india-states.topo.json from DataMeet's "Admin2" state boundaries
 * (CC BY 4.0, https://github.com/datameet/maps/tree/master/States).
 *
 * Run: node scripts/build-india.mjs path/to/Admin2.shp
 */
import mapshaper from "mapshaper";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const src = process.argv[2];
if (!src) throw new Error("Usage: node scripts/build-india.mjs path/to/Admin2.shp");
const out = new URL("../src/lib/data/india-states.topo.json", import.meta.url).pathname;
const tmp = mkdtempSync(join(tmpdir(), "meridian-in-"));

// name normalisation and ISO 3166-2:IN codes
const NAMES = {
  "Andaman & Nicobar": ["Andaman and Nicobar Islands", "AN"], "Andhra Pradesh": ["Andhra Pradesh", "AP"], "Arunachal Pradesh": ["Arunachal Pradesh", "AR"],
  Assam: ["Assam", "AS"], Bihar: ["Bihar", "BR"], Chandigarh: ["Chandigarh", "CH"], Chhattisgarh: ["Chhattisgarh", "CT"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Dadra and Nagar Haveli and Daman and Diu", "DH"], Delhi: ["Delhi", "DL"], Goa: ["Goa", "GA"],
  Gujarat: ["Gujarat", "GJ"], Haryana: ["Haryana", "HR"], "Himachal Pradesh": ["Himachal Pradesh", "HP"], "Jammu & Kashmir": ["Jammu and Kashmir", "JK"],
  Jharkhand: ["Jharkhand", "JH"], Karnataka: ["Karnataka", "KA"], Kerala: ["Kerala", "KL"], Ladakh: ["Ladakh", "LA"], Lakshadweep: ["Lakshadweep", "LD"],
  "Madhya Pradesh": ["Madhya Pradesh", "MP"], Maharashtra: ["Maharashtra", "MH"], Manipur: ["Manipur", "MN"], Meghalaya: ["Meghalaya", "ML"],
  Mizoram: ["Mizoram", "MZ"], Nagaland: ["Nagaland", "NL"], Odisha: ["Odisha", "OR"], Puducherry: ["Puducherry", "PY"], Punjab: ["Punjab", "PB"],
  Rajasthan: ["Rajasthan", "RJ"], Sikkim: ["Sikkim", "SK"], "Tamil Nadu": ["Tamil Nadu", "TN"], Telangana: ["Telangana", "TG"], Tripura: ["Tripura", "TR"],
  "Uttar Pradesh": ["Uttar Pradesh", "UP"], Uttarakhand: ["Uttarakhand", "UT"], "West Bengal": ["West Bengal", "WB"],
};

// 4% of vertices keeps coastlines and state lines crisp at large sizes; shared borders stay shared
await mapshaper.runCommands(`-i ${src} -simplify 4% keep-shapes weighted -clean -rename-layers states -o format=topojson quantization=60000 ${join(tmp, "raw.json")}`);
const topo = JSON.parse(readFileSync(join(tmp, "raw.json"), "utf8"));
for (const g of topo.objects.states.geometries) {
  const hit = NAMES[g.properties.ST_NM];
  if (!hit) throw new Error(`Unknown state name: ${g.properties.ST_NM}`);
  g.id = hit[1];
  g.properties = { name: hit[0] };
}
writeFileSync(out, JSON.stringify(topo));
rmSync(tmp, { recursive: true, force: true });
console.log(`states: ${topo.objects.states.geometries.length} → ${out}`);

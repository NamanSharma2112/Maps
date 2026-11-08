import { describe, expect, it } from "vitest";
import { geoArea } from "d3-geo";
import { getIndiaStates } from "./data/india";
import { getCountryRegions, isLand } from "./data/world";
import { locate } from "./data/regions";
import { distanceKm, bearing, cardinal, formatCoordinate } from "./utils/geo";
import { subsolarPoint } from "./utils/sun";
import { createColorScale } from "./utils/scale";

describe("india data", () => {
  const states = getIndiaStates();
  it("has 28 states + 8 union territories", () => expect(states).toHaveLength(36));
  it("rings are wound for d3 (each state smaller than a hemisphere)", () => {
    for (const s of states) expect(geoArea(s.geometry)).toBeLessThan(0.1);
  });
  it("locates cities in the right state", () => {
    expect(states[locate(states, 72.8777, 19.076)].name).toBe("Maharashtra"); // Mumbai
    expect(states[locate(states, 77.5946, 12.9716)].name).toBe("Karnataka"); // Bengaluru
    expect(states[locate(states, 77.209, 28.6139)].name).toBe("Delhi");
    expect(states[locate(states, 77.5771, 34.1526)].name).toBe("Ladakh"); // Leh
  });
});

describe("world data", () => {
  it("knows land from sea", () => {
    expect(isLand(2.35, 48.85)).toBe(true); // Paris
    expect(isLand(-30, 30)).toBe(false); // mid-Atlantic
  });
  it("locates countries", () => {
    const c = getCountryRegions();
    expect(c[locate(c, 139.69, 35.68)].name).toBe("Japan");
    expect(c[locate(c, -46.63, -23.55)].name).toBe("Brazil");
  });
});

describe("geo utils", () => {
  it("measures great-circle distance", () => {
    const d = distanceKm({ lat: 40.6413, lng: -73.7781 }, { lat: 51.47, lng: -0.4543 }); // JFK → LHR
    expect(d).toBeGreaterThan(5520);
    expect(d).toBeLessThan(5570);
  });
  it("computes bearings", () => {
    expect(Math.round(bearing({ lat: 0, lng: 0 }, { lat: 10, lng: 0 }))).toBe(0);
    expect(cardinal(225)).toBe("SW");
  });
  it("formats coordinates", () => {
    expect(formatCoordinate({ lat: 28.6139, lng: 77.209 })).toBe("28.6139° N, 77.2090° E");
    expect(formatCoordinate({ lat: -33.8688, lng: 151.2093 }, { format: "dms" })).toBe("33°52′08″ S, 151°12′33″ E");
  });
});

describe("sun", () => {
  it("is over the Tropic of Cancer at the June solstice", () => {
    const p = subsolarPoint(new Date(Date.UTC(2024, 5, 20, 12, 0)));
    expect(p.lat).toBeGreaterThan(23.2);
    expect(p.lat).toBeLessThan(23.5);
    expect(Math.abs(p.lng)).toBeLessThan(1);
  });
  it("is near the equator at the March equinox", () => {
    expect(Math.abs(subsolarPoint(new Date(Date.UTC(2024, 2, 20, 3, 6))).lat)).toBeLessThan(0.5);
  });
});

describe("color scale", () => {
  it("bins values into quantiles", () => {
    const s = createColorScale([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { steps: 5 });
    expect(s.colors).toHaveLength(5);
    expect(s.colorOf(1)).toBe(s.colors[0]);
    expect(s.colorOf(10)).toBe(s.colors[4]);
    expect(s.colorOf(undefined)).toBeUndefined();
  });
});

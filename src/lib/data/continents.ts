import type { GeoProjection } from "d3-geo";
import { geoAzimuthalEqualArea, geoConicEqualArea } from "d3-geo";

export type Continent = "africa" | "asia" | "europe" | "north-america" | "south-america" | "oceania" | "antarctica";

export interface ContinentDef {
  name: string;
  /** Countries (Natural Earth 1:110m names) that belong to the continent. */
  countries: string[];
  /** Builds the projection; it is then fitted to `extent`. */
  projection: () => GeoProjection;
  /** [west, south, east, north] in degrees — the area framed by the map. */
  extent: [number, number, number, number];
  /** Width / height of the map frame. */
  aspect: number;
}

const conic = (center: [number, number], parallels: [number, number]) => () =>
  geoConicEqualArea().rotate([-center[0], 0]).center([0, center[1]]).parallels(parallels);

export const CONTINENTS: Record<Continent, ContinentDef> = {
  africa: {
    name: "Africa",
    countries: [
      "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cameroon", "Central African Rep.", "Chad",
      "Congo", "Côte d'Ivoire", "Dem. Rep. Congo", "Djibouti", "Egypt", "Eq. Guinea", "Eritrea", "eSwatini", "Ethiopia",
      "Gabon", "Gambia", "Ghana", "Guinea", "Guinea-Bissau", "Kenya", "Lesotho", "Liberia", "Libya", "Madagascar",
      "Malawi", "Mali", "Mauritania", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda", "S. Sudan",
      "Senegal", "Sierra Leone", "Somalia", "Somaliland", "South Africa", "Sudan", "Tanzania", "Togo", "Tunisia",
      "Uganda", "W. Sahara", "Zambia", "Zimbabwe",
      "Seychelles", "São Tomé and Principe", "Mauritius", "Comoros", "Cabo Verde", "Saint Helena",
    ],
    projection: () => geoAzimuthalEqualArea().rotate([-18, 0]),
    extent: [-19, -36, 52, 38],
    aspect: 1,
  },
  asia: {
    name: "Asia",
    countries: [
      "Afghanistan", "Armenia", "Azerbaijan", "Bangladesh", "Bhutan", "Brunei", "Cambodia", "China", "Cyprus", "Georgia",
      "India", "Indonesia", "Iran", "Iraq", "Israel", "Japan", "Jordan", "Kazakhstan", "Kuwait", "Kyrgyzstan", "Laos",
      "Lebanon", "Malaysia", "Mongolia", "Myanmar", "N. Cyprus", "Nepal", "North Korea", "Oman", "Pakistan", "Palestine",
      "Philippines", "Qatar", "Russia", "Saudi Arabia", "South Korea", "Sri Lanka", "Syria", "Taiwan", "Tajikistan",
      "Thailand", "Timor-Leste", "Turkey", "Turkmenistan", "United Arab Emirates", "Uzbekistan", "Vietnam", "Yemen",
      "Singapore", "Bahrain", "Maldives", "Hong Kong", "Macao",
    ],
    projection: conic([95, 35], [15, 55]),
    extent: [26, -11, 150, 72],
    aspect: 1.35,
  },
  europe: {
    name: "Europe",
    countries: [
      "Albania", "Austria", "Belarus", "Belgium", "Bosnia and Herz.", "Bulgaria", "Croatia", "Czechia", "Denmark",
      "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Kosovo", "Latvia",
      "Lithuania", "Luxembourg", "Macedonia", "Moldova", "Montenegro", "Netherlands", "Norway", "Poland", "Portugal",
      "Romania", "Russia", "Serbia", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Ukraine", "United Kingdom",
      "Vatican", "San Marino", "Monaco", "Malta", "Liechtenstein", "Andorra", "Jersey", "Guernsey", "Isle of Man", "Åland", "Faeroe Is.",
    ],
    projection: conic([15, 52], [43, 62]),
    extent: [-24, 35, 42, 71],
    aspect: 1.15,
  },
  "north-america": {
    name: "North America",
    countries: [
      "Bahamas", "Belize", "Canada", "Costa Rica", "Cuba", "Dominican Rep.", "El Salvador", "Greenland", "Guatemala",
      "Haiti", "Honduras", "Jamaica", "Mexico", "Nicaragua", "Panama", "Puerto Rico", "Trinidad and Tobago",
      "United States of America", "Bermuda", "Cayman Is.", "Anguilla", "Turks and Caicos Is.", "British Virgin Is.",
      "U.S. Virgin Is.", "Montserrat", "Aruba", "Curaçao", "Sint Maarten", "St-Martin", "St-Barthélemy", "Grenada", "St. Vin. and Gren.",
      "Saint Lucia", "St. Kitts and Nevis", "Dominica", "Antigua and Barb.", "Barbados", "St. Pierre and Miquelon",
    ],
    projection: conic([-100, 45], [20, 60]),
    extent: [-168, 7, -52, 75],
    aspect: 1.15,
  },
  "south-america": {
    name: "South America",
    countries: [
      "Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Ecuador", "Falkland Is.", "Guyana", "Paraguay", "Peru",
      "Suriname", "Uruguay", "Venezuela", "S. Geo. and the Is.",
    ],
    projection: () => geoAzimuthalEqualArea().rotate([60, 0]),
    extent: [-82, -56, -34, 13],
    aspect: 0.8,
  },
  oceania: {
    name: "Oceania",
    countries: [
      "Australia", "Fiji", "New Caledonia", "New Zealand", "Papua New Guinea", "Solomon Is.", "Vanuatu", "Micronesia", "Marshall Is.",
      "N. Mariana Is.", "Guam", "American Samoa", "Pitcairn Is.", "Tonga", "Samoa", "Palau", "Niue", "Cook Is.", "Nauru", "Kiribati",
      "Wallis and Futuna Is.", "Fr. Polynesia", "Norfolk Island", "Ashmore and Cartier Is.",
    ],
    projection: () => geoAzimuthalEqualArea().rotate([-150, 25]),
    extent: [112, -48, 180, -1],
    aspect: 1.3,
  },
  antarctica: {
    name: "Antarctica",
    countries: ["Antarctica", "Fr. S. Antarctic Lands", "Heard I. and McDonald Is."],
    projection: () => geoAzimuthalEqualArea().rotate([0, 90]),
    extent: [-180, -90, 180, -60],
    aspect: 1.25,
  },
};

/** A dense ring of points around an extent, for fitting a projection to it. */
export function extentOutline([w, s, e, n]: [number, number, number, number]): GeoJSON.MultiPoint {
  const pts: [number, number][] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const x = w + ((e - w) * i) / steps;
    const y = s + ((n - s) * i) / steps;
    pts.push([x, s], [x, n], [w, y], [e, y]);
  }
  return { type: "MultiPoint", coordinates: pts };
}

import type { MapArc, MapMarker } from "../lib";

export const CITIES = {
  delhi: { lat: 28.6139, lng: 77.209, label: "New Delhi" },
  mumbai: { lat: 19.076, lng: 72.8777, label: "Mumbai" },
  bengaluru: { lat: 12.9716, lng: 77.5946, label: "Bengaluru" },
  london: { lat: 51.5072, lng: -0.1276, label: "London" },
  newYork: { lat: 40.7128, lng: -74.006, label: "New York" },
  sanFrancisco: { lat: 37.7749, lng: -122.4194, label: "San Francisco" },
  saoPaulo: { lat: -23.5505, lng: -46.6333, label: "São Paulo" },
  lagos: { lat: 6.5244, lng: 3.3792, label: "Lagos" },
  nairobi: { lat: -1.2921, lng: 36.8219, label: "Nairobi" },
  dubai: { lat: 25.2048, lng: 55.2708, label: "Dubai" },
  singapore: { lat: 1.3521, lng: 103.8198, label: "Singapore" },
  tokyo: { lat: 35.6762, lng: 139.6503, label: "Tokyo" },
  sydney: { lat: -33.8688, lng: 151.2093, label: "Sydney" },
  frankfurt: { lat: 50.1109, lng: 8.6821, label: "Frankfurt" },
} satisfies Record<string, MapMarker>;

const C = CITIES;
export const HUB_MARKERS: MapMarker[] = Object.values(C).map((c) => ({ ...c, description: `${c.lat.toFixed(2)}°, ${c.lng.toFixed(2)}°` }));

export const HUB_ARCS: MapArc[] = [
  { from: C.london, to: C.newYork },
  { from: C.newYork, to: C.sanFrancisco },
  { from: C.frankfurt, to: C.dubai },
  { from: C.dubai, to: C.mumbai },
  { from: C.singapore, to: C.tokyo },
  { from: C.singapore, to: C.sydney },
  { from: C.london, to: C.lagos },
  { from: C.newYork, to: C.saoPaulo },
  { from: C.dubai, to: C.nairobi },
  { from: C.delhi, to: C.singapore },
];

/** Census of India 2011, persons (Ladakh and J&K split per the 2019 reorganisation). */
export const INDIA_POPULATION_2011: Record<string, number> = {
  "Uttar Pradesh": 199812341, Maharashtra: 112374333, Bihar: 104099452, "West Bengal": 91276115,
  "Madhya Pradesh": 72626809, "Tamil Nadu": 72147030, Rajasthan: 68548437, Karnataka: 61095297,
  Gujarat: 60439692, "Andhra Pradesh": 49577103, Odisha: 41974218, Telangana: 35003674, Kerala: 33406061,
  Jharkhand: 32988134, Assam: 31205576, Punjab: 27743338, Chhattisgarh: 25545198, Haryana: 25351462,
  Delhi: 16787941, "Jammu and Kashmir": 12267013, Uttarakhand: 10086292, "Himachal Pradesh": 6864602,
  Tripura: 3673917, Meghalaya: 2966889, Manipur: 2855794, Nagaland: 1978502, Goa: 1458545,
  "Arunachal Pradesh": 1383727, Puducherry: 1247953, Mizoram: 1097206, Chandigarh: 1055450, Sikkim: 610577,
  "Dadra and Nagar Haveli and Daman and Diu": 586956, "Andaman and Nicobar Islands": 380581, Ladakh: 274289,
  Lakshadweep: 64473,
};

export const INDIA_CITIES: MapMarker[] = [
  { ...C.delhi, description: "National capital", shape: "pin", size: 4 },
  { ...C.mumbai, description: "Maharashtra" },
  { ...C.bengaluru, description: "Karnataka", labelPosition: "left" },
  { lat: 13.0827, lng: 80.2707, label: "Chennai", description: "Tamil Nadu" },
  { lat: 22.5726, lng: 88.3639, label: "Kolkata", description: "West Bengal" },
  { lat: 17.385, lng: 78.4867, label: "Hyderabad", description: "Telangana" },
];

/** Approximate population in millions (UN World Population Prospects, 2023). */
export const WORLD_POPULATION: Record<string, number> = {
  India: 1428, China: 1425, "United States of America": 340, Indonesia: 278, Pakistan: 240, Nigeria: 224,
  Brazil: 216, Bangladesh: 173, Russia: 144, Mexico: 128, Ethiopia: 127, Japan: 123, Philippines: 117,
  Egypt: 113, "Dem. Rep. Congo": 102, Vietnam: 99, Iran: 89, Turkey: 85, Germany: 83, Thailand: 72,
  "United Kingdom": 68, Tanzania: 67, France: 65, "South Africa": 60, Italy: 59, Kenya: 55, Myanmar: 54,
  Colombia: 52, "South Korea": 52, Uganda: 49, Sudan: 48, Spain: 48, Algeria: 46, Argentina: 46, Iraq: 46,
  Afghanistan: 42, Poland: 41, Canada: 39, Morocco: 38, "Saudi Arabia": 37, Ukraine: 37, Angola: 37,
  Uzbekistan: 35, Yemen: 34, Peru: 34, Malaysia: 34, Ghana: 34, Mozambique: 34, Nepal: 31, Madagascar: 30,
  Venezuela: 28, "Côte d'Ivoire": 29, Cameroon: 28, Niger: 27, Australia: 26, "North Korea": 26,
  Taiwan: 24, Mali: 23, "Burkina Faso": 23, "Sri Lanka": 22, Syria: 23, Malawi: 21, Zambia: 21,
  Romania: 20, Chile: 20, Kazakhstan: 20, Chad: 18, Ecuador: 18, Guatemala: 18, Somalia: 18, Senegal: 18,
  Netherlands: 18, Cambodia: 17, Zimbabwe: 17, Guinea: 14, Rwanda: 14, Benin: 13, Burundi: 13, Tunisia: 12,
  Bolivia: 12, Belgium: 12, Haiti: 12, Cuba: 11, "S. Sudan": 11, "Dominican Rep.": 11, Czechia: 11,
  Greece: 10, Jordan: 11, Portugal: 10, Azerbaijan: 10, Sweden: 11, Honduras: 10, "United Arab Emirates": 10,
  Hungary: 10, Tajikistan: 10, Belarus: 9, Austria: 9, "Papua New Guinea": 10, Serbia: 7, Israel: 9,
  Switzerland: 9, Togo: 9, "Sierra Leone": 9, Laos: 8, Paraguay: 7, Bulgaria: 7, Libya: 7, Nicaragua: 7,
  Kyrgyzstan: 7, "El Salvador": 6, Turkmenistan: 6, Denmark: 6, Finland: 6, Norway: 5, Ireland: 5,
  "New Zealand": 5, Mongolia: 3, Namibia: 3, Botswana: 3, Iceland: 0.4,
};

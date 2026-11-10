import type { LatLng } from "../types";

export interface City extends LatLng {
  name: string;
  /** Country name as used by the maps (Natural Earth). */
  country: string;
  capital?: boolean;
}

// [name, country, lat, lng, capital?] — city-centre coordinates, rounded to 0.01°
const RAW: [string, string, number, number, 1?][] = [
  // India
  ["New Delhi", "India", 28.61, 77.21, 1], ["Mumbai", "India", 19.08, 72.88], ["Bengaluru", "India", 12.97, 77.59],
  ["Chennai", "India", 13.08, 80.27], ["Kolkata", "India", 22.57, 88.36], ["Hyderabad", "India", 17.39, 78.49],
  ["Ahmedabad", "India", 23.02, 72.57], ["Pune", "India", 18.52, 73.86], ["Jaipur", "India", 26.91, 75.79],
  ["Lucknow", "India", 26.85, 80.95], ["Kochi", "India", 9.93, 76.27], ["Thiruvananthapuram", "India", 8.52, 76.94],
  ["Goa (Panaji)", "India", 15.49, 73.83], ["Chandigarh", "India", 30.73, 76.78], ["Amritsar", "India", 31.63, 74.87],
  ["Srinagar", "India", 34.08, 74.8], ["Leh", "India", 34.15, 77.58], ["Varanasi", "India", 25.32, 82.97],
  ["Patna", "India", 25.59, 85.14], ["Bhubaneswar", "India", 20.3, 85.82], ["Guwahati", "India", 26.14, 91.74],
  ["Shillong", "India", 25.58, 91.89], ["Indore", "India", 22.72, 75.86], ["Bhopal", "India", 23.26, 77.41],
  ["Nagpur", "India", 21.15, 79.09], ["Surat", "India", 21.17, 72.83], ["Visakhapatnam", "India", 17.69, 83.22],
  ["Coimbatore", "India", 11.02, 76.96], ["Udaipur", "India", 24.59, 73.71], ["Port Blair", "India", 11.62, 92.73],
  ["Dehradun", "India", 30.32, 78.03], ["Shimla", "India", 31.1, 77.17], ["Mysuru", "India", 12.3, 76.64],
  // South Asia
  ["Islamabad", "Pakistan", 33.68, 73.05, 1], ["Karachi", "Pakistan", 24.86, 67.0], ["Lahore", "Pakistan", 31.52, 74.36],
  ["Kathmandu", "Nepal", 27.72, 85.32, 1], ["Thimphu", "Bhutan", 27.47, 89.64, 1], ["Dhaka", "Bangladesh", 23.81, 90.41, 1],
  ["Colombo", "Sri Lanka", 6.93, 79.86, 1], ["Kabul", "Afghanistan", 34.53, 69.17, 1],
  // East & South-East Asia
  ["Beijing", "China", 39.9, 116.41, 1], ["Shanghai", "China", 31.23, 121.47], ["Guangzhou", "China", 23.13, 113.26],
  ["Chengdu", "China", 30.57, 104.07], ["Tokyo", "Japan", 35.68, 139.65, 1], ["Osaka", "Japan", 34.69, 135.5],
  ["Seoul", "South Korea", 37.57, 126.98, 1], ["Taipei", "Taiwan", 25.03, 121.57, 1], ["Ulaanbaatar", "Mongolia", 47.89, 106.91, 1],
  ["Bangkok", "Thailand", 13.76, 100.5, 1], ["Hanoi", "Vietnam", 21.03, 105.85, 1], ["Ho Chi Minh City", "Vietnam", 10.82, 106.63],
  ["Kuala Lumpur", "Malaysia", 3.14, 101.69, 1], ["Jakarta", "Indonesia", -6.21, 106.85, 1], ["Bali (Denpasar)", "Indonesia", -8.65, 115.22],
  ["Manila", "Philippines", 14.6, 120.98, 1], ["Yangon", "Myanmar", 16.87, 96.2], ["Phnom Penh", "Cambodia", 11.56, 104.93, 1],
  ["Vientiane", "Laos", 17.98, 102.63, 1], ["Singapore", "Singapore", 1.35, 103.82, 1], ["Hong Kong", "Hong Kong", 22.32, 114.17],
  ["Malé", "Maldives", 4.18, 73.51, 1],
  // Middle East & Central Asia
  ["Dubai", "United Arab Emirates", 25.2, 55.27], ["Abu Dhabi", "United Arab Emirates", 24.45, 54.38, 1], ["Doha", "Qatar", 25.29, 51.53, 1],
  ["Riyadh", "Saudi Arabia", 24.71, 46.68, 1], ["Jeddah", "Saudi Arabia", 21.49, 39.19], ["Muscat", "Oman", 23.59, 58.41, 1],
  ["Tehran", "Iran", 35.69, 51.39, 1], ["Baghdad", "Iraq", 33.32, 44.37, 1], ["Istanbul", "Turkey", 41.01, 28.98],
  ["Ankara", "Turkey", 39.93, 32.86, 1], ["Tel Aviv", "Israel", 32.09, 34.78], ["Amman", "Jordan", 31.95, 35.93, 1],
  ["Kuwait City", "Kuwait", 29.38, 47.98, 1], ["Manama", "Bahrain", 26.23, 50.59, 1], ["Tashkent", "Uzbekistan", 41.3, 69.24, 1], ["Almaty", "Kazakhstan", 43.24, 76.89],
  ["Astana", "Kazakhstan", 51.17, 71.45, 1],
  // Europe
  ["London", "United Kingdom", 51.51, -0.13, 1], ["Edinburgh", "United Kingdom", 55.95, -3.19], ["Manchester", "United Kingdom", 53.48, -2.24],
  ["Dublin", "Ireland", 53.35, -6.26, 1], ["Paris", "France", 48.86, 2.35, 1], ["Nice", "France", 43.7, 7.27], ["Lyon", "France", 45.76, 4.84],
  ["Berlin", "Germany", 52.52, 13.41, 1], ["Munich", "Germany", 48.14, 11.58], ["Frankfurt", "Germany", 50.11, 8.68],
  ["Amsterdam", "Netherlands", 52.37, 4.9, 1], ["Brussels", "Belgium", 50.85, 4.35, 1], ["Zurich", "Switzerland", 47.38, 8.54],
  ["Bern", "Switzerland", 46.95, 7.45, 1], ["Vienna", "Austria", 48.21, 16.37, 1], ["Prague", "Czechia", 50.08, 14.44, 1],
  ["Warsaw", "Poland", 52.23, 21.01, 1], ["Budapest", "Hungary", 47.5, 19.04, 1], ["Rome", "Italy", 41.9, 12.5, 1],
  ["Milan", "Italy", 45.46, 9.19], ["Venice", "Italy", 45.44, 12.32], ["Florence", "Italy", 43.77, 11.26],
  ["Madrid", "Spain", 40.42, -3.7, 1], ["Barcelona", "Spain", 41.39, 2.17], ["Lisbon", "Portugal", 38.72, -9.14, 1],
  ["Athens", "Greece", 37.98, 23.73, 1], ["Copenhagen", "Denmark", 55.68, 12.57, 1], ["Stockholm", "Sweden", 59.33, 18.07, 1],
  ["Oslo", "Norway", 59.91, 10.75, 1], ["Helsinki", "Finland", 60.17, 24.94, 1], ["Reykjavik", "Iceland", 64.15, -21.94, 1],
  ["Moscow", "Russia", 55.76, 37.62, 1], ["Saint Petersburg", "Russia", 59.93, 30.36], ["Kyiv", "Ukraine", 50.45, 30.52, 1],
  ["Bucharest", "Romania", 44.43, 26.1, 1], ["Belgrade", "Serbia", 44.79, 20.45, 1], ["Zagreb", "Croatia", 45.81, 15.98, 1], ["Valletta", "Malta", 35.9, 14.51, 1],
  // Africa
  ["Cairo", "Egypt", 30.04, 31.24, 1], ["Lagos", "Nigeria", 6.52, 3.38], ["Abuja", "Nigeria", 9.08, 7.4, 1],
  ["Nairobi", "Kenya", -1.29, 36.82, 1], ["Addis Ababa", "Ethiopia", 9.03, 38.74, 1], ["Accra", "Ghana", 5.6, -0.19, 1],
  ["Dakar", "Senegal", 14.72, -17.47, 1], ["Casablanca", "Morocco", 33.57, -7.59], ["Marrakesh", "Morocco", 31.63, -8.01],
  ["Rabat", "Morocco", 34.02, -6.84, 1], ["Tunis", "Tunisia", 36.81, 10.18, 1], ["Algiers", "Algeria", 36.75, 3.06, 1],
  ["Johannesburg", "South Africa", -26.2, 28.05], ["Cape Town", "South Africa", -33.92, 18.42, 1], ["Dar es Salaam", "Tanzania", -6.79, 39.21],
  ["Kampala", "Uganda", 0.35, 32.58, 1], ["Kigali", "Rwanda", -1.94, 30.06, 1], ["Kinshasa", "Dem. Rep. Congo", -4.44, 15.27, 1],
  ["Luanda", "Angola", -8.84, 13.23, 1], ["Antananarivo", "Madagascar", -18.88, 47.51, 1], ["Khartoum", "Sudan", 15.5, 32.56, 1],
  // Americas
  ["Washington, D.C.", "United States of America", 38.91, -77.04, 1], ["New York", "United States of America", 40.71, -74.01],
  ["Los Angeles", "United States of America", 34.05, -118.24], ["San Francisco", "United States of America", 37.77, -122.42],
  ["Chicago", "United States of America", 41.88, -87.63], ["Miami", "United States of America", 25.76, -80.19],
  ["Seattle", "United States of America", 47.61, -122.33], ["Las Vegas", "United States of America", 36.17, -115.14],
  ["Houston", "United States of America", 29.76, -95.37], ["Boston", "United States of America", 42.36, -71.06],
  ["Honolulu", "United States of America", 21.31, -157.86], ["Anchorage", "United States of America", 61.22, -149.9],
  ["Ottawa", "Canada", 45.42, -75.7, 1], ["Toronto", "Canada", 43.65, -79.38], ["Vancouver", "Canada", 49.28, -123.12],
  ["Montreal", "Canada", 45.5, -73.57], ["Mexico City", "Mexico", 19.43, -99.13, 1], ["Cancún", "Mexico", 21.16, -86.85],
  ["Havana", "Cuba", 23.11, -82.37, 1], ["Panama City", "Panama", 8.98, -79.52, 1], ["Bogotá", "Colombia", 4.71, -74.07, 1],
  ["Lima", "Peru", -12.05, -77.04, 1], ["Cusco", "Peru", -13.53, -71.97], ["Quito", "Ecuador", -0.18, -78.47, 1],
  ["Santiago", "Chile", -33.45, -70.67, 1], ["Buenos Aires", "Argentina", -34.6, -58.38, 1], ["Montevideo", "Uruguay", -34.9, -56.16, 1],
  ["São Paulo", "Brazil", -23.55, -46.63], ["Rio de Janeiro", "Brazil", -22.91, -43.17], ["Brasília", "Brazil", -15.79, -47.88, 1],
  ["Caracas", "Venezuela", 10.48, -66.9, 1], ["La Paz", "Bolivia", -16.49, -68.12, 1], ["Asunción", "Paraguay", -25.26, -57.58, 1],
  // Oceania
  ["Canberra", "Australia", -35.28, 149.13, 1], ["Sydney", "Australia", -33.87, 151.21], ["Melbourne", "Australia", -37.81, 144.96],
  ["Brisbane", "Australia", -27.47, 153.03], ["Perth", "Australia", -31.95, 115.86], ["Darwin", "Australia", -12.46, 130.84],
  ["Auckland", "New Zealand", -36.85, 174.76], ["Wellington", "New Zealand", -41.29, 174.78, 1], ["Queenstown", "New Zealand", -45.03, 168.66],
  ["Suva", "Fiji", -18.14, 178.44, 1], ["Port Moresby", "Papua New Guinea", -9.44, 147.18, 1],
];

export const CITIES: City[] = RAW.map(([name, country, lat, lng, capital]) => ({ name, country, lat, lng, ...(capital ? { capital: true } : {}) }));

/** Find a city by name (case-insensitive). */
export function findCity(name: string): City | undefined {
  const k = name.trim().toLowerCase();
  return CITIES.find((c) => c.name.toLowerCase() === k);
}

/** Cities in a country, capital first. */
export function citiesIn(country: string): City[] {
  const k = country.toLowerCase();
  return CITIES.filter((c) => c.country.toLowerCase() === k).sort((a, b) => Number(!!b.capital) - Number(!!a.capital));
}

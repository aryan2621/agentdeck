/** Default session names. */
export const CITIES = [
  'Rome', 'Khartoum', 'Lima', 'Oslo', 'Kyoto', 'Cairo', 'Hanoi', 'Quito', 'Dakar', 'Accra', 'Lagos', 'Nairobi', 'Tunis', 'Rabat', 'Algiers',
  'Lisbon', 'Madrid', 'Seville', 'Porto', 'Valencia', 'Barcelona', 'Paris', 'Lyon', 'Nice', 'Brussels', 'Ghent', 'Bruges', 'Amsterdam', 'Utrecht', 'Berlin',
  'Hamburg', 'Munich', 'Vienna', 'Salzburg', 'Prague', 'Brno', 'Warsaw', 'Krakow', 'Gdansk', 'Budapest', 'Zagreb', 'Split', 'Belgrade', 'Sofia', 'Athens',
  'Naples', 'Florence', 'Venice', 'Turin', 'Palermo', 'Bologna', 'Zurich', 'Geneva', 'Bern', 'Basel', 'Dublin', 'Cork', 'Galway', 'Edinburgh', 'Glasgow',
  'Cardiff', 'Belfast', 'Bristol', 'Leeds', 'York', 'Bath', 'Oxford', 'Cambridge', 'Reykjavik', 'Helsinki', 'Tallinn', 'Riga', 'Vilnius', 'Stockholm', 'Bergen',
  'Copenhagen', 'Aarhus', 'Tbilisi', 'Yerevan', 'Baku', 'Istanbul', 'Ankara', 'Izmir', 'Beirut', 'Amman', 'Muscat', 'Doha', 'Dubai', 'Tehran', 'Isfahan',
  'Karachi', 'Lahore', 'Delhi', 'Mumbai', 'Pune', 'Jaipur', 'Kolkata', 'Chennai', 'Kochi', 'Dhaka', 'Colombo', 'Kathmandu', 'Thimphu', 'Bangkok', 'Chiang Mai',
  'Phuket', 'Saigon', 'Hue', 'Phnom Penh', 'Vientiane', 'Yangon', 'Jakarta', 'Bali', 'Manila', 'Cebu', 'Singapore', 'Penang', 'Taipei', 'Seoul', 'Busan',
  'Tokyo', 'Osaka', 'Nagoya', 'Sapporo', 'Beijing', 'Shanghai', 'Chengdu', 'Xian', 'Ulaanbaatar', 'Almaty', 'Samarkand', 'Tashkent', 'Sydney', 'Perth', 'Hobart',
  'Auckland', 'Wellington', 'Fiji', 'Honolulu', 'Anchorage', 'Seattle', 'Portland', 'Denver', 'Austin', 'Chicago', 'Boston', 'Miami', 'Havana', 'Mexico City', 'Oaxaca',
  'Bogota', 'Medellin', 'Cusco', 'Santiago', 'Valparaiso', 'Mendoza', 'Buenos Aires', 'Montevideo', 'Recife', 'Salvador', 'Rio', 'Toronto', 'Montreal', 'Vancouver', 'Quebec',
  'Cape Town', 'Durban', 'Maputo', 'Luanda', 'Kigali', 'Kampala', 'Addis Ababa', 'Zanzibar', 'Marrakech', 'Fez', 'Tangier', 'Valletta', 'Tirana', 'Skopje', 'Sarajevo',
]

/** A city not used by a live session (`taken`); prefers one never visited. Falls back to a numbered repeat when every city is taken. */
export function pickCity(taken: Iterable<string>, visited: readonly string[], rnd: () => number = Math.random): string {
  const used = new Set(taken), seen = new Set(visited)
  const free = CITIES.filter((c) => !used.has(c))
  const pool = free.filter((c) => !seen.has(c))
  const from = pool.length ? pool : free
  if (from.length) return from[Math.floor(rnd() * from.length)]
  let n = 2
  while (used.has(`${CITIES[0]} ${n}`)) n++
  return `${CITIES[0]} ${n}`
}

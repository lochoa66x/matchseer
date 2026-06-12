export type WorldCupVenue = {
  slug: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  aliases: string[];
};

export const worldCupVenues: WorldCupVenue[] = [
  {
    slug: "mexico-city-stadium",
    name: "Estadio Azteca",
    city: "Mexico City",
    country: "Mexico",
    latitude: 19.3029,
    longitude: -99.1505,
    aliases: ["estadio azteca", "mexico city stadium"],
  },
  {
    slug: "guadalajara-stadium",
    name: "Estadio Akron",
    city: "Guadalajara",
    country: "Mexico",
    latitude: 20.6819,
    longitude: -103.4626,
    aliases: ["estadio akron", "guadalajara stadium"],
  },
  {
    slug: "monterrey-stadium",
    name: "Estadio BBVA",
    city: "Monterrey",
    country: "Mexico",
    latitude: 25.6682,
    longitude: -100.2444,
    aliases: ["estadio bbva", "monterrey stadium"],
  },
  {
    slug: "toronto-stadium",
    name: "BMO Field",
    city: "Toronto",
    country: "Canada",
    latitude: 43.6332,
    longitude: -79.4186,
    aliases: ["bmo field", "toronto stadium"],
  },
  {
    slug: "vancouver-stadium",
    name: "BC Place",
    city: "Vancouver",
    country: "Canada",
    latitude: 49.2767,
    longitude: -123.1119,
    aliases: ["bc place", "vancouver stadium"],
  },
  {
    slug: "atlanta-stadium",
    name: "Mercedes-Benz Stadium",
    city: "Atlanta",
    country: "United States",
    latitude: 33.7554,
    longitude: -84.4008,
    aliases: ["mercedes-benz stadium", "atlanta stadium"],
  },
  {
    slug: "boston-stadium",
    name: "Gillette Stadium",
    city: "Boston",
    country: "United States",
    latitude: 42.0909,
    longitude: -71.2643,
    aliases: ["gillette stadium", "boston stadium"],
  },
  {
    slug: "dallas-stadium",
    name: "AT&T Stadium",
    city: "Dallas",
    country: "United States",
    latitude: 32.7473,
    longitude: -97.0945,
    aliases: ["at&t stadium", "att stadium", "dallas stadium"],
  },
  {
    slug: "houston-stadium",
    name: "NRG Stadium",
    city: "Houston",
    country: "United States",
    latitude: 29.6847,
    longitude: -95.4107,
    aliases: ["nrg stadium", "houston stadium"],
  },
  {
    slug: "kansas-city-stadium",
    name: "Arrowhead Stadium",
    city: "Kansas City",
    country: "United States",
    latitude: 39.049,
    longitude: -94.4839,
    aliases: ["arrowhead stadium", "kansas city stadium"],
  },
  {
    slug: "los-angeles-stadium",
    name: "SoFi Stadium",
    city: "Los Angeles",
    country: "United States",
    latitude: 33.9535,
    longitude: -118.3392,
    aliases: ["sofi stadium", "los angeles stadium"],
  },
  {
    slug: "miami-stadium",
    name: "Hard Rock Stadium",
    city: "Miami",
    country: "United States",
    latitude: 25.958,
    longitude: -80.2389,
    aliases: ["hard rock stadium", "miami stadium"],
  },
  {
    slug: "new-york-new-jersey-stadium",
    name: "MetLife Stadium",
    city: "New York/New Jersey",
    country: "United States",
    latitude: 40.8135,
    longitude: -74.0745,
    aliases: ["metlife stadium", "new york new jersey stadium"],
  },
  {
    slug: "philadelphia-stadium",
    name: "Lincoln Financial Field",
    city: "Philadelphia",
    country: "United States",
    latitude: 39.9008,
    longitude: -75.1675,
    aliases: ["lincoln financial field", "philadelphia stadium"],
  },
  {
    slug: "san-francisco-bay-area-stadium",
    name: "Levi's Stadium",
    city: "San Francisco Bay Area",
    country: "United States",
    latitude: 37.403,
    longitude: -121.97,
    aliases: ["levi's stadium", "levis stadium", "san francisco bay area stadium"],
  },
  {
    slug: "seattle-stadium",
    name: "Lumen Field",
    city: "Seattle",
    country: "United States",
    latitude: 47.5952,
    longitude: -122.3316,
    aliases: ["lumen field", "seattle stadium"],
  },
];

export function findWorldCupVenue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = normalizeVenueName(value);

  return (
    worldCupVenues.find(
      (venue) =>
        normalizeVenueName(venue.name) === normalized ||
        venue.aliases.some((alias) => normalizeVenueName(alias) === normalized),
    ) ?? null
  );
}

function normalizeVenueName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

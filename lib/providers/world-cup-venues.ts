export type WorldCupVenue = {
  slug: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  elevationMeters: number;
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
    elevationMeters: 2240,
    aliases: ["estadio azteca", "mexico city stadium"],
  },
  {
    slug: "guadalajara-stadium",
    name: "Estadio Akron",
    city: "Guadalajara",
    country: "Mexico",
    latitude: 20.6819,
    longitude: -103.4626,
    elevationMeters: 1560,
    aliases: ["estadio akron", "guadalajara stadium"],
  },
  {
    slug: "monterrey-stadium",
    name: "Estadio BBVA",
    city: "Monterrey",
    country: "Mexico",
    latitude: 25.6682,
    longitude: -100.2444,
    elevationMeters: 540,
    aliases: ["estadio bbva", "monterrey stadium"],
  },
  {
    slug: "toronto-stadium",
    name: "BMO Field",
    city: "Toronto",
    country: "Canada",
    latitude: 43.6332,
    longitude: -79.4186,
    elevationMeters: 76,
    aliases: ["bmo field", "toronto stadium"],
  },
  {
    slug: "vancouver-stadium",
    name: "BC Place",
    city: "Vancouver",
    country: "Canada",
    latitude: 49.2767,
    longitude: -123.1119,
    elevationMeters: 70,
    aliases: ["bc place", "vancouver stadium"],
  },
  {
    slug: "atlanta-stadium",
    name: "Mercedes-Benz Stadium",
    city: "Atlanta",
    country: "United States",
    latitude: 33.7554,
    longitude: -84.4008,
    elevationMeters: 320,
    aliases: ["mercedes-benz stadium", "atlanta stadium"],
  },
  {
    slug: "boston-stadium",
    name: "Gillette Stadium",
    city: "Boston",
    country: "United States",
    latitude: 42.0909,
    longitude: -71.2643,
    elevationMeters: 90,
    aliases: ["gillette stadium", "boston stadium"],
  },
  {
    slug: "dallas-stadium",
    name: "AT&T Stadium",
    city: "Dallas",
    country: "United States",
    latitude: 32.7473,
    longitude: -97.0945,
    elevationMeters: 180,
    aliases: ["at&t stadium", "att stadium", "dallas stadium"],
  },
  {
    slug: "houston-stadium",
    name: "NRG Stadium",
    city: "Houston",
    country: "United States",
    latitude: 29.6847,
    longitude: -95.4107,
    elevationMeters: 15,
    aliases: ["nrg stadium", "houston stadium"],
  },
  {
    slug: "kansas-city-stadium",
    name: "Arrowhead Stadium",
    city: "Kansas City",
    country: "United States",
    latitude: 39.049,
    longitude: -94.4839,
    elevationMeters: 265,
    aliases: ["arrowhead stadium", "kansas city stadium"],
  },
  {
    slug: "los-angeles-stadium",
    name: "SoFi Stadium",
    city: "Los Angeles",
    country: "United States",
    latitude: 33.9535,
    longitude: -118.3392,
    elevationMeters: 40,
    aliases: ["sofi stadium", "los angeles stadium"],
  },
  {
    slug: "miami-stadium",
    name: "Hard Rock Stadium",
    city: "Miami",
    country: "United States",
    latitude: 25.958,
    longitude: -80.2389,
    elevationMeters: 2,
    aliases: ["hard rock stadium", "miami stadium"],
  },
  {
    slug: "new-york-new-jersey-stadium",
    name: "MetLife Stadium",
    city: "New York/New Jersey",
    country: "United States",
    latitude: 40.8135,
    longitude: -74.0745,
    elevationMeters: 2,
    aliases: ["metlife stadium", "new york new jersey stadium"],
  },
  {
    slug: "philadelphia-stadium",
    name: "Lincoln Financial Field",
    city: "Philadelphia",
    country: "United States",
    latitude: 39.9008,
    longitude: -75.1675,
    elevationMeters: 12,
    aliases: ["lincoln financial field", "philadelphia stadium"],
  },
  {
    slug: "san-francisco-bay-area-stadium",
    name: "Levi's Stadium",
    city: "San Francisco Bay Area",
    country: "United States",
    latitude: 37.403,
    longitude: -121.97,
    elevationMeters: 3,
    aliases: ["levi's stadium", "levis stadium", "san francisco bay area stadium"],
  },
  {
    slug: "seattle-stadium",
    name: "Lumen Field",
    city: "Seattle",
    country: "United States",
    latitude: 47.5952,
    longitude: -122.3316,
    elevationMeters: 50,
    aliases: ["lumen field", "seattle stadium"],
  },
];

type WorldCupFixtureTeam = {
  code?: string | null;
  name?: string | null;
  shortName?: string | null;
  tla?: string | null;
};

const teamAliases = new Map([
  ["bosnia-h", "bih"],
  ["bosnia-h.", "bih"],
  ["bosnia-and-herzegovina", "bih"],
  ["bosnia-herzegovina", "bih"],
  ["cabo-verde", "cpv"],
  ["cape-verde", "cpv"],
  ["congo-dr", "cod"],
  ["dr-congo", "cod"],
  ["drc", "cod"],
  ["democratic-republic-of-the-congo", "cod"],
  ["cote-d-ivoire", "civ"],
  ["cote-divoire", "civ"],
  ["ivory-coast", "civ"],
  ["curacao", "cuw"],
  ["ir-iran", "irn"],
  ["iran", "irn"],
  ["korea-republic", "kor"],
  ["republic-of-korea", "kor"],
  ["south-korea", "kor"],
  ["netherlands", "ned"],
  ["nld", "ned"],
  ["new-zealand", "nzl"],
  ["saudi-arabia", "ksa"],
  ["south-africa", "rsa"],
  ["turkiye", "tur"],
  ["turkey", "tur"],
  ["united-states", "usa"],
  ["united-states-of-america", "usa"],
]);

const groupStageVenueByFixture = new Map<string, WorldCupVenue["slug"]>([
  [fixtureKey("mex", "rsa"), "mexico-city-stadium"],
  [fixtureKey("kor", "cze"), "guadalajara-stadium"],
  [fixtureKey("can", "bih"), "toronto-stadium"],
  [fixtureKey("usa", "par"), "los-angeles-stadium"],
  [fixtureKey("hai", "sco"), "boston-stadium"],
  [fixtureKey("aus", "tur"), "vancouver-stadium"],
  [fixtureKey("bra", "mar"), "new-york-new-jersey-stadium"],
  [fixtureKey("qat", "sui"), "san-francisco-bay-area-stadium"],
  [fixtureKey("civ", "ecu"), "philadelphia-stadium"],
  [fixtureKey("ger", "cuw"), "houston-stadium"],
  [fixtureKey("ned", "jpn"), "dallas-stadium"],
  [fixtureKey("swe", "tun"), "monterrey-stadium"],
  [fixtureKey("ksa", "uru"), "miami-stadium"],
  [fixtureKey("esp", "cpv"), "atlanta-stadium"],
  [fixtureKey("irn", "nzl"), "los-angeles-stadium"],
  [fixtureKey("bel", "egy"), "seattle-stadium"],
  [fixtureKey("fra", "sen"), "new-york-new-jersey-stadium"],
  [fixtureKey("irq", "nor"), "boston-stadium"],
  [fixtureKey("arg", "alg"), "kansas-city-stadium"],
  [fixtureKey("aut", "jor"), "san-francisco-bay-area-stadium"],
  [fixtureKey("gha", "pan"), "toronto-stadium"],
  [fixtureKey("eng", "cro"), "dallas-stadium"],
  [fixtureKey("por", "cod"), "houston-stadium"],
  [fixtureKey("uzb", "col"), "mexico-city-stadium"],
  [fixtureKey("cze", "rsa"), "atlanta-stadium"],
  [fixtureKey("sui", "bih"), "los-angeles-stadium"],
  [fixtureKey("can", "qat"), "vancouver-stadium"],
  [fixtureKey("mex", "kor"), "guadalajara-stadium"],
  [fixtureKey("bra", "hai"), "philadelphia-stadium"],
  [fixtureKey("sco", "mar"), "boston-stadium"],
  [fixtureKey("tur", "par"), "san-francisco-bay-area-stadium"],
  [fixtureKey("usa", "aus"), "seattle-stadium"],
  [fixtureKey("ger", "civ"), "toronto-stadium"],
  [fixtureKey("ecu", "cuw"), "kansas-city-stadium"],
  [fixtureKey("ned", "swe"), "houston-stadium"],
  [fixtureKey("tun", "jpn"), "monterrey-stadium"],
  [fixtureKey("uru", "cpv"), "miami-stadium"],
  [fixtureKey("esp", "ksa"), "atlanta-stadium"],
  [fixtureKey("bel", "irn"), "los-angeles-stadium"],
  [fixtureKey("nzl", "egy"), "vancouver-stadium"],
  [fixtureKey("nor", "sen"), "new-york-new-jersey-stadium"],
  [fixtureKey("fra", "irq"), "philadelphia-stadium"],
  [fixtureKey("arg", "aut"), "dallas-stadium"],
  [fixtureKey("jor", "alg"), "san-francisco-bay-area-stadium"],
  [fixtureKey("eng", "gha"), "boston-stadium"],
  [fixtureKey("pan", "cro"), "toronto-stadium"],
  [fixtureKey("por", "uzb"), "houston-stadium"],
  [fixtureKey("col", "cod"), "guadalajara-stadium"],
  [fixtureKey("sco", "bra"), "miami-stadium"],
  [fixtureKey("mar", "hai"), "atlanta-stadium"],
  [fixtureKey("sui", "can"), "vancouver-stadium"],
  [fixtureKey("bih", "qat"), "seattle-stadium"],
  [fixtureKey("cze", "mex"), "mexico-city-stadium"],
  [fixtureKey("rsa", "kor"), "monterrey-stadium"],
  [fixtureKey("cuw", "civ"), "philadelphia-stadium"],
  [fixtureKey("ecu", "ger"), "new-york-new-jersey-stadium"],
  [fixtureKey("jpn", "swe"), "dallas-stadium"],
  [fixtureKey("tun", "ned"), "kansas-city-stadium"],
  [fixtureKey("tur", "usa"), "los-angeles-stadium"],
  [fixtureKey("par", "aus"), "san-francisco-bay-area-stadium"],
  [fixtureKey("nor", "fra"), "boston-stadium"],
  [fixtureKey("sen", "irq"), "toronto-stadium"],
  [fixtureKey("egy", "irn"), "seattle-stadium"],
  [fixtureKey("nzl", "bel"), "vancouver-stadium"],
  [fixtureKey("cpv", "ksa"), "houston-stadium"],
  [fixtureKey("uru", "esp"), "guadalajara-stadium"],
  [fixtureKey("pan", "eng"), "new-york-new-jersey-stadium"],
  [fixtureKey("cro", "gha"), "philadelphia-stadium"],
  [fixtureKey("alg", "aut"), "kansas-city-stadium"],
  [fixtureKey("jor", "arg"), "dallas-stadium"],
  [fixtureKey("col", "por"), "miami-stadium"],
  [fixtureKey("cod", "uzb"), "atlanta-stadium"],
]);

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

export function findScheduledWorldCupVenueForMatch({
  homeTeam,
  awayTeam,
}: {
  homeTeam: WorldCupFixtureTeam | null | undefined;
  awayTeam: WorldCupFixtureTeam | null | undefined;
}) {
  const homeKeys = teamKeys(homeTeam);
  const awayKeys = teamKeys(awayTeam);

  for (const homeKey of homeKeys) {
    for (const awayKey of awayKeys) {
      const slug = groupStageVenueByFixture.get(fixtureKey(homeKey, awayKey));

      if (slug) {
        return worldCupVenues.find((venue) => venue.slug === slug) ?? null;
      }
    }
  }

  return null;
}

function teamKeys(team: WorldCupFixtureTeam | null | undefined) {
  const values = [team?.tla, team?.code, team?.shortName, team?.name];
  const keys = new Set<string>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    const normalized = normalizeTeamName(value);

    if (normalized) {
      keys.add(teamAliases.get(normalized) ?? normalized);
    }
  }

  return keys;
}

function fixtureKey(teamA: string, teamB: string) {
  return [teamA, teamB].sort().join("|");
}

function normalizeTeamName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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

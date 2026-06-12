export type OpenMeteoWeather = {
  temperatureC: number | null;
  windKph: number | null;
  humidity: number | null;
  precipitationMm: number | null;
  summary: string;
  raw: unknown;
};

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    wind_speed_10m?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    weather_code?: number;
  };
};

export async function fetchCurrentVenueWeather({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}): Promise<OpenMeteoWeather> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current:
      "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
    timezone: "auto",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo weather request failed: ${response.status}`);
  }

  const payload = (await response.json()) as OpenMeteoResponse;
  const current = payload.current;

  return {
    temperatureC: current?.temperature_2m ?? null,
    windKph: current?.wind_speed_10m ?? null,
    humidity: current?.relative_humidity_2m ?? null,
    precipitationMm: current?.precipitation ?? null,
    summary: summarizeWeather(current?.weather_code, current?.precipitation),
    raw: payload,
  };
}

function summarizeWeather(
  weatherCode: number | undefined,
  precipitation: number | undefined,
) {
  if ((precipitation ?? 0) > 0) {
    return "Rain in the air, slick touches, and set-piece noise.";
  }

  if (weatherCode === undefined) {
    return "Weather model synced. Matchday readout pending detail.";
  }

  if (weatherCode <= 1) {
    return "Clear skies, clean touches, and fast pitch rhythm.";
  }

  if (weatherCode <= 3) {
    return "Cloud cover overhead, but the ball should still move cleanly.";
  }

  if (weatherCode >= 45 && weatherCode <= 48) {
    return "Foggy edges could make long diagonals a little spicy.";
  }

  if (weatherCode >= 80) {
    return "Shower risk adds a little chaos to every bounce.";
  }

  return "Weather synced with playable matchday conditions.";
}

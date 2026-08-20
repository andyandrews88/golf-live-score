import { supabase } from "@/integrations/supabase/client";

export type Forecast = {
  high: number;
  low: number;
  label: string;
  rain: number | null;
  wind: number | null;
  humidity: number | null;
};

function weatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code === 1 || code === 2) return "Partly Cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain Showers";
  if (code >= 95) return "Thunderstorms";
  return "Cloudy";
}

export async function fetchWeather(): Promise<Forecast> {
  const res = await fetch(
    "https://api.open-meteo.com/v1/forecast?latitude=6.89&longitude=79.87&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&current=relative_humidity_2m,wind_speed_10m&timezone=Asia%2FColombo&forecast_days=1",
  );
  if (!res.ok) throw new Error("weather");
  const json = (await res.json()) as {
    daily?: {
      weathercode?: number[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_probability_max?: (number | null)[];
    };
    current?: {
      relative_humidity_2m?: number;
      wind_speed_10m?: number;
    };
  };
  const d = json.daily;
  if (!d?.weathercode?.length) throw new Error("weather");
  return {
    high: Math.round(d.temperature_2m_max?.[0] ?? 0),
    low: Math.round(d.temperature_2m_min?.[0] ?? 0),
    label: weatherLabel(d.weathercode[0] ?? 0),
    rain: d.precipitation_probability_max?.[0] ?? null,
    wind: json.current?.wind_speed_10m ?? null,
    humidity: json.current?.relative_humidity_2m ?? null,
  };
}

export async function fetchStimp(): Promise<string | null> {
  const { data, error } = await supabase
    .from("course_info")
    .select("value")
    .eq("key", "stimp_reading")
    .maybeSingle();
  if (error) return null;
  const value = (data?.value ?? "").trim();
  return value.length > 0 ? value : null;
}

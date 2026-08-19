import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import crest from "@/assets/crest.png";
import { useCoursePhotos } from "@/lib/course-photos";
import { cn } from "@/lib/utils";
import { DIVISION_LIST_TEXT, DIVISION_TABS } from "@/lib/divisions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RCGC 105th Championship — Live Scoring" },
      {
        name: "description",
        content:
          `Live match play scoring for the RCGC 105th Championship: ${DIVISION_LIST_TEXT}.`,
      },
      { property: "og:title", content: "RCGC 105th Championship — Live Scoring" },
      {
        property: "og:description",
        content:
          `Follow every match live across ${DIVISION_LIST_TEXT}.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const PHOTO_MS = 5000;

const DIVISIONS = DIVISION_TABS;

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

type Forecast = {
  high: number;
  low: number;
  label: string;
  rain: number | null;
  wind: number | null;
  humidity: number | null;
};

async function fetchWeather(): Promise<Forecast> {
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

function WeatherPanel() {
  const { data } = useQuery({
    queryKey: ["colombo-weather"],
    queryFn: fetchWeather,
    retry: false,
    staleTime: 1000 * 60 * 30,
  });

  if (!data) return null;

  return (
    <section className="mx-auto mt-6 w-full max-w-3xl rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Colombo today
          </p>
          <p className="font-headline text-2xl font-bold text-primary">{data.label}</p>
        </div>
        <div className="text-right">
          <p className="font-headline text-2xl font-bold text-foreground">
            {data.high}° / {data.low}°
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-end gap-x-3 text-xs text-muted-foreground">
            {data.rain !== null && <span>{data.rain}% rain</span>}
            {data.wind !== null && <span>{Math.round(data.wind)} km/h wind</span>}
            {data.humidity !== null && <span>{Math.round(data.humidity)}% humidity</span>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Carousel() {
  const { data } = useCoursePhotos();
  const photos = data ?? [];
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    if (photos.length <= 1) {
      setIndex(0);
      return;
    }
    const t = setInterval(() => setIndex((i) => (i + 1) % photos.length), PHOTO_MS);
    return () => clearInterval(t);
  }, [photos.length]);

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchX.current;
    touchX.current = null;
    if (start === null || photos.length < 2) return;
    const dx = (e.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(dx) < 40) return;
    setIndex((i) => (i + (dx < 0 ? 1 : photos.length - 1)) % photos.length);
  }

  if (photos.length === 0) return null;

  const active = photos[Math.min(index, photos.length - 1)];

  return (
    <section className="mx-auto mt-6 w-full max-w-3xl">
      <div
        className="relative aspect-[16/9] overflow-hidden rounded-xl border border-border bg-muted shadow-sm"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={onTouchEnd}
      >
        {photos.map((photo, i) => (
          <img
            key={photo.id}
            src={photo.photo_url}
            alt={photo.caption || "Royal Colombo Golf Club course view"}
            loading={i === 0 ? "eager" : "lazy"}
            className={cn(
              "absolute inset-0 size-full object-cover transition-opacity duration-700",
              i === index ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
        {active?.caption && (
          <p className="absolute inset-x-0 bottom-0 bg-primary/80 px-4 py-2 text-sm text-primary-foreground">
            {active.caption}
          </p>
        )}
      </div>
      <div className="mt-3 flex justify-center gap-2">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            aria-label={`Show photo ${i + 1}`}
            onClick={() => setIndex(i)}
            className={cn(
              "size-2 rounded-full transition-colors",
              i === index ? "bg-primary" : "bg-muted-foreground/40",
            )}
          />
        ))}
      </div>
    </section>
  );
}

function Index() {
  return (
    <main className="min-h-screen bg-background px-safe pb-16">
      <header className="mx-auto flex max-w-3xl flex-col items-center pt-10 text-center">
        <img src={crest} alt="Royal Colombo Golf Club crest" className="size-20 object-contain" />
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Royal Colombo Golf Club
        </p>
        <h1 className="mt-2 font-headline text-4xl font-bold text-primary sm:text-5xl">
          105th Championship
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
          Match play across {DIVISION_LIST_TEXT} — followed
          hole by hole, live.
        </p>
      </header>

      <WeatherPanel />
      <Carousel />

      <section className="mx-auto mt-8 w-full max-w-3xl">
        <h2 className="mb-3 font-headline text-xl font-bold text-foreground">Follow the action</h2>
        <div className="grid gap-3">
          <Link
            to="/live"
            search={{ division: "all" }}
            className="rounded-xl bg-primary p-5 text-primary-foreground shadow-sm transition-transform hover:scale-[1.01]"
          >
            <span className="font-headline text-2xl font-bold">All Divisions</span>
            <span className="mt-1 block text-sm opacity-90">Every match, one leaderboard</span>
          </Link>
          <div className="grid gap-3 sm:grid-cols-3">
            {DIVISIONS.map((d) => (
              <Link
                key={d.key}
                to="/live"
                search={{ division: d.key }}
                className="rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary"
              >
                <span className="font-headline text-lg font-semibold text-foreground">
                  {d.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tv")({
  head: () => ({
    meta: [
      { title: "TV Display — RCGC 105th Championship" },
      {
        name: "description",
        content: "Big-screen live scoreboard display for the RCGC 105th Championship.",
      },
      { property: "og:title", content: "TV Display — RCGC 105th Championship" },
      {
        property: "og:description",
        content: "Big-screen live scoreboard display for the RCGC 105th Championship.",
      },
    ],
  }),
  component: TvPage,
});

function TvPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-safe">
      <h1 className="font-headline text-3xl font-semibold text-foreground">
        TV page — coming soon
      </h1>
    </main>
  );
}

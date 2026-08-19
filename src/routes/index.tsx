import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RCGC 105th Championship — Live Scoring" },
      {
        name: "description",
        content:
          "Live match play scoring for the RCGC 105th Championship: Men's Championship, Ladies Silver and Ladies Bronze Cup.",
      },
      { property: "og:title", content: "RCGC 105th Championship — Live Scoring" },
      {
        property: "og:description",
        content:
          "Follow every match live across the Men's Championship, Ladies Silver and Ladies Bronze Cup.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-safe">
      <h1 className="font-headline text-3xl font-semibold text-foreground">
        RCGC 105th Championship — coming soon
      </h1>
    </main>
  );
}

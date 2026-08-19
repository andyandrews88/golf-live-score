import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/scorer_/$matchId")({
  head: () => ({
    meta: [
      { title: "Scoring Screen — RCGC 105th Championship" },
      {
        name: "description",
        content: "Hole-by-hole scoring screen for RCGC 105th Championship officials.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Scoring Screen — RCGC 105th Championship" },
      {
        property: "og:description",
        content: "Hole-by-hole scoring screen for RCGC 105th Championship officials.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScoringPlaceholder,
});

function ScoringPlaceholder() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-safe">
      <h1 className="font-headline text-3xl font-semibold text-foreground">
        Scoring screen — coming soon
      </h1>
    </main>
  );
}

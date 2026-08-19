import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/scorer")({
  head: () => ({
    meta: [
      { title: "Scorer Tools — RCGC 105th Championship" },
      {
        name: "description",
        content: "Passcode-protected scoring tools for RCGC 105th Championship officials.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Scorer Tools — RCGC 105th Championship" },
      {
        property: "og:description",
        content: "Passcode-protected scoring tools for RCGC 105th Championship officials.",
      },
    ],
  }),
  component: ScorerPage,
});

function ScorerPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-safe">
      <h1 className="font-headline text-3xl font-semibold text-foreground">
        Scorer page — coming soon
      </h1>
    </main>
  );
}

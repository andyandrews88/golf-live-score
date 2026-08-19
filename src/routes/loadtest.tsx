import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { saveMatchComment } from "@/lib/scorer.functions";

export const Route = createFileRoute("/loadtest")({
  head: () => ({
    meta: [
      { title: "Realtime Load Test — Internal" },
      { name: "description", content: "Internal diagnostic tool for realtime load testing." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Realtime Load Test — Internal" },
      { property: "og:description", content: "Internal diagnostic tool. Not part of the app." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoadTestPage,
});

const TOTAL = 400;

function LoadTestPage() {

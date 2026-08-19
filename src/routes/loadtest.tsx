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

function LoadTestPage() {
  const TOTAL = 400;
  const btnStyle: React.CSSProperties = {
    border: "1px solid #333",
    padding: "6px 12px",
    background: "#fff",
    cursor: "pointer",
  };

  const [passcode, setPasscode] = useState("");
  const [running, setRunning] = useState(false);
  const [connected, setConnected] = useState(0);
  const [failed, setFailed] = useState(0);
  const [received, setReceived] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [firing, setFiring] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const channelsRef = useRef<RealtimeChannel[]>([]);
  const updateSentAtRef = useRef<number | null>(null);
  const receivedRef = useRef(0);

  const pending = Math.max(TOTAL - connected - failed, 0);

  const addLog = (m: string) =>
    setLog((prev) => [`${new Date().toLocaleTimeString()} — ${m}`, ...prev].slice(0, 30));

  useEffect(
    () => () => {
      for (const ch of channelsRef.current) supabase.removeChannel(ch);
      channelsRef.current = [];
    },
    [],
  );

  const start = () => {
    if (running) return;
    setRunning(true);
    setConnected(0);
    setFailed(0);
    setReceived(0);
    setLatency(null);
    setLog([]);
    receivedRef.current = 0;
    updateSentAtRef.current = null;
    addLog(`Opening ${TOTAL} realtime subscriptions…`);

    const stamp = Date.now();
    const channels: RealtimeChannel[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const ch = supabase
        .channel(`loadtest-${stamp}-${i}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
          if (updateSentAtRef.current == null) return;
          receivedRef.current += 1;
          setReceived(receivedRef.current);
          setLatency((Date.now() - updateSentAtRef.current) / 1000);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") setConnected((c) => c + 1);
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED")
            setFailed((f) => f + 1);
        });
      channels.push(ch);
    }
    channelsRef.current = channels;
  };

  const stop = () => {
    for (const ch of channelsRef.current) supabase.removeChannel(ch);
    channelsRef.current = [];
    setRunning(false);
    updateSentAtRef.current = null;
    addLog("All channels closed.");
  };

  const fireUpdate = async () => {
    if (firing) return;
    setFiring(true);
    try {
      const { data, error } = await supabase
        .from("matches")
        .select("id")
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error || !data) throw error ?? new Error("No match found");

      receivedRef.current = 0;
      setReceived(0);
      setLatency(null);
      updateSentAtRef.current = Date.now();
      addLog(`Updating comment on match ${data.id}…`);
      await saveMatchComment({
        data: { passcode, matchId: data.id, comment: `loadtest ${Date.now()}` },
      });
      addLog("Update sent — counting deliveries…");
    } catch (e) {
      updateSentAtRef.current = null;
      addLog(`Update failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setFiring(false);
    }
  };

  return (
    <main style={{ fontFamily: "monospace", padding: 20, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Realtime load test (internal)</h1>
      <p style={{ fontSize: 13, color: "#555" }}>
        Opens {TOTAL} realtime subscriptions on the matches table. Temporary diagnostic page.
      </p>

      <div style={{ display: "flex", gap: 8, margin: "16px 0", flexWrap: "wrap" }}>
        <button onClick={start} disabled={running} style={btnStyle}>
          Start test
        </button>
        <button onClick={stop} disabled={!running} style={btnStyle}>
          Stop test
        </button>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="scorer passcode"
          style={{ border: "1px solid #999", padding: "6px 8px" }}
        />
        <button onClick={fireUpdate} disabled={!running || firing || !passcode} style={btnStyle}>
          {firing ? "Sending…" : "Run test update"}
        </button>
      </div>

      <ul style={{ fontSize: 14, lineHeight: 1.7 }}>
        <li>
          Connected: {connected} / {TOTAL}
        </li>
        <li>Failed / errored: {failed}</li>
        <li>Still connecting: {pending}</li>
        <li>
          Received test update: {received} / {connected}
        </li>
        <li>Time to last delivery: {latency == null ? "—" : `${latency.toFixed(2)}s`}</li>
      </ul>

      <pre style={{ marginTop: 16, fontSize: 12, whiteSpace: "pre-wrap", color: "#333" }}>
        {log.join("\n")}
      </pre>
    </main>
  );
}

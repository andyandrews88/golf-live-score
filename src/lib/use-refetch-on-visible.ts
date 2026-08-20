import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Safety net for dropped realtime connections: force a fresh refetch of the
 * given query key whenever the tab becomes visible again.
 */
export function useRefetchOnVisible(queryKey: readonly unknown[]) {
  const queryClient = useQueryClient();
  const key = JSON.stringify(queryKey);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      queryClient.invalidateQueries({ queryKey: JSON.parse(key) as unknown[] });
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [queryClient, key]);
}

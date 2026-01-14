import { useEffect, useMemo, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createBrowserClient } from "@/lib/supabase/browser";

export type PlacementRow = {
  id: string;
  slot_id: string;
  image_url?: string | null;
  created_at?: string;
  size?: number;
  [key: string]: unknown;
};

type UsePlacementsRealtimeOptions = {
  onInsert: (placement: PlacementRow) => void;
  isInViewport: (placement: PlacementRow) => boolean;
  enabled?: boolean;
};

export function usePlacementsRealtime({
  onInsert,
  isInViewport,
  enabled = true,
}: UsePlacementsRealtimeOptions) {
  const supabase = useMemo(() => createBrowserClient(), []);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onInsertRef = useRef(onInsert);
  const isInViewportRef = useRef(isInViewport);
  const devLog = process.env.NODE_ENV !== "production";

  useEffect(() => {
    onInsertRef.current = onInsert;
  }, [onInsert]);

  useEffect(() => {
    isInViewportRef.current = isInViewport;
  }, [isInViewport]);

  useEffect(() => {
    if (!enabled) {
      if (channelRef.current) {
        const existing = channelRef.current;
        existing.unsubscribe();
        supabase.removeChannel(existing);
        channelRef.current = null;
      }
      return;
    }
    if (channelRef.current) return;

    const channel = supabase.channel("placements-insert");
    channelRef.current = channel;

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "placements" },
      (payload) => {
        const placement = payload.new as PlacementRow;
        if (devLog) {
          console.log("[realtime] placement insert received", placement);
        }
        const inViewport = isInViewportRef.current(placement);
        if (!inViewport) {
          if (devLog) {
            console.log("[realtime] placement ignored (out of viewport)", placement);
          }
          return;
        }
        onInsertRef.current(placement);
      }
    );

    channel.subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        if (devLog) {
          console.log("[realtime] placements subscription opened");
        }
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("[realtime] placements subscription error", err ?? status);
      }
    });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [supabase, devLog, enabled]);
}

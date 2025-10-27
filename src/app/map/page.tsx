// app/(whatever)/map/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { PointPlacement } from "@/components/map/types";
import { useTokens } from "@/hooks/use-tokens";
import { PromptDrawer } from "@/components/map/prompt-drawer";
import { mmss } from "@/lib/time";

const MapLibreWorld = dynamic(
    () => import("@/components/map/maplibre-world").then((m) => m.MapLibreWorld),
    { ssr: false }
);

export default function MapPage() {
    const { tokens, setTokens, consume } = useTokens();

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [presetPoint, setPresetPoint] = useState<{ lat: number; lng: number } | null>(null);

    const [placements, setPlacements] = useState<PointPlacement[]>([]);
    const [size, setSize] = useState<128 | 256 | 512>(256);

    // open drawer (idea-first)
    const openCreate = () => {
        setPresetPoint(null);
        setDrawerOpen(true);
    };

    // listen to global events you already dispatch
    useEffect(() => {
        const open = () => openCreate();
        const openWithPoint = (e: any) => {
            const d = e?.detail;
            if (!d) return;
            setPresetPoint({ lat: d.lat, lng: d.lng });
            setDrawerOpen(true);
        };
        window.addEventListener("genplace:create", open as any);
        window.addEventListener("genplace:create:point", openWithPoint as any);
        return () => {
            window.removeEventListener("genplace:create", open as any);
            window.removeEventListener("genplace:create:point", openWithPoint as any);
        };
    }, []);

    const handlePlaced = (p: PointPlacement) => {
        setPlacements((prev) => {
            const key = (q: PointPlacement) => q.id ?? `${q.url}:${q.lat.toFixed(6)}:${q.lng.toFixed(6)}`;
            const existing = prev.filter((q) => key(q) !== key(p));
            return [...existing, p];
        });
    };

    // Bottom button label / disabled logic (truthy tokens)
    const cooldownMs = Math.max(0, tokens.nextRegenAt - Date.now());
    const createLabel = useMemo(() => {
        const base = `Create ${tokens.current}/${tokens.max}`;
        return tokens.current < tokens.max ? `${base} (${mmss(cooldownMs)})` : base;
    }, [tokens, cooldownMs]);

    return (
        <div className="h-dvh w-screen overflow-hidden">
            <MapLibreWorld
                sizePx={size}
                placements={placements}
                onClickEmpty={() => { }}
                onClickPlacement={() => { }}
                onCreate={openCreate}
                hasTokens={tokens.current > 0}
                cooldownLabel={`Out of tokens — regenerates in ${mmss(cooldownMs)}`}
                label={createLabel}
            />

            {/* Bottom button is already rendered by MapLibreWorld using hasTokens/cooldownLabel,
          but if you prefer to control the label explicitly, pass it there and show the exact text.
          For now we keep your existing behavior and rely on tooltip/disabled state. */}

            {/* <PromptDrawer
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                presetPoint={presetPoint}
                tokens={tokens}
                onTokens={setTokens}
                onPlaced={handlePlaced}
                requireAuth={false}
                onRequireAuth={() => (window.location.href = "/login")}
            /> */}
        </div>
    );
}

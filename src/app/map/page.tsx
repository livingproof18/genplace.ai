"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { PointPlacement, Size, Model } from "@/components/map/types";

import { useTokens } from "@/hooks/use-tokens";
import { mmss } from "@/lib/time";

import { ChatComposer } from "@/components/create/chat-composer";
import { GenerationPanel, type Variant } from "@/components/create/generation-panel";

const MapLibreWorld = dynamic(
    () => import("@/components/map/maplibre-world").then((m) => m.MapLibreWorld),
    { ssr: false }
);

export default function MapPage() {
    const { tokens, setTokens } = useTokens();

    // map placements
    const [placements, setPlacements] = useState<PointPlacement[]>([]);

    // creation state shared between composer & panel
    const [prompt, setPrompt] = useState("");
    const [size, setSize] = useState<Size>(256);
    const [model, setModel] = useState<Model>("genplace");
    const [presetPoint, setPresetPoint] = useState<{ lat: number; lng: number } | null>(null);

    const [generating, setGenerating] = useState(false);
    const [variants, setVariants] = useState<Variant[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const lastGenAtRef = useRef(0);

    const [genError, setGenError] = useState<string | null>(null);


    // === util ===
    const cooldownMs = Math.max(0, tokens.nextRegenAt - Date.now());
    const canSubmit = prompt.trim().length > 0 && tokens.current > 0 && !generating;

    // === events from map ===
    useEffect(() => {
        const onPoint = (e: any) => {
            const d = e?.detail;
            if (!d) return;
            setPresetPoint({ lat: d.lat, lng: d.lng });
            // For tile-first, focus the composer; generation starts only when they submit.
            window.dispatchEvent(new CustomEvent("genplace:composer:focus"));
        };
        window.addEventListener("genplace:create:point", onPoint as any);
        return () => window.removeEventListener("genplace:create:point", onPoint as any);
    }, []);

    // === fake services (reuse your previous logic) ===
    function hash(s: string) {
        let h = 0;
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
        return h;
    }
    const fakeImagesFor = (p: string): Variant[] => {
        const seed = Math.abs(hash(p));
        return [
            { id: `A_${seed}`, url: `https://picsum.photos/seed/${seed}/512/512` },
            { id: `B_${seed + 1}`, url: `https://picsum.photos/seed/${seed + 1}/512/512` },
        ];
    };
    const GEN_RATE_MS = 10_000;

    async function doGenerate() {
        const now = Date.now();
        const since = now - lastGenAtRef.current;
        if (since < GEN_RATE_MS) {
            // surface via panel banner
            throw new Error(`Please wait ${mmss(GEN_RATE_MS - since)} before generating again.`);
        }
        lastGenAtRef.current = now;

        // simulate latency
        await new Promise((r) => setTimeout(r, 900 + Math.random() * 900));
        return fakeImagesFor(prompt.trim() || "default");
    }

    async function regenerateOne(slot: 0 | 1) {
        if (!panelOpen || generating) return;
        setGenerating(true);
        try {
            await new Promise((r) => setTimeout(r, 700 + Math.random() * 600));
            const alt = `https://picsum.photos/seed/${Math.floor(Math.random() * 10_000)}/512/512`;
            setVariants((prev) => {
                const next = [...prev];
                if (next[slot]) next[slot] = { ...next[slot], id: crypto.randomUUID(), url: alt };
                return next;
            });
        } finally {
            setGenerating(false);
        }
    }

    async function onSubmitFromComposer() {
        if (!canSubmit) return;
        // open panel and start generating
        setPanelOpen(true);
        setVariants([]);
        setSelectedId(null);
        setGenerating(true);
        setGenError(null);
        try {
            const imgs = await doGenerate();
            setVariants(imgs.slice(0, 2));
        } catch (err) {
            // Show error banner in panel
            setVariants([]);
            setSelectedId(null);
            // store an ephemeral error as a "pseudo variant" message handled by the panel prop
            // (we’ll pass the error down via prop)
            const message =
                err instanceof Error ? err.message : "Something went wrong. Try again.";

            setGenError(message);
        } finally {
            setGenerating(false);
        }
    }

    async function onPlaceSelected() {
        if (!selectedId || !presetPoint || tokens.current <= 0) return;

        // simulate place
        await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
        const picked = variants.find((v) => v.id === selectedId);
        if (!picked) return;

        // consume 1 token
        setTokens((t) => {
            const left = Math.max(0, t.current - 1);
            return {
                current: left,
                max: t.max,
                nextRegenAt: left < t.max ? Date.now() + 2 * 60 * 1000 : t.nextRegenAt,
            };
        });

        // add to map
        setPlacements((prev) => [
            ...prev.filter((q) => q.id !== picked.id),
            {
                id: crypto.randomUUID(),
                url: picked.url,
                lat: presetPoint.lat,
                lng: presetPoint.lng,
                pixelSize: size,
                anchor: "bottom",
            },
        ]);

        // close panel & clear selection (keep prompt for quick re-run)
        setPanelOpen(false);
        setSelectedId(null);
        // keep presetPoint so they can re-roll/replace in same area; clear if you prefer:
        // setPresetPoint(null);
    }

    return (
        <div className="h-dvh w-screen overflow-hidden">
            <MapLibreWorld
                sizePx={size}
                placements={placements}
                onClickEmpty={() => { }}
                onClickPlacement={() => { }}
                // The old “Create” button is removed; composer is now always on screen.
                hasTokens={tokens.current > 0}
                cooldownLabel={`Out of tokens — regenerates in ${mmss(cooldownMs)}`}
                label={`Create ${tokens.current}/${tokens.max}`}
            />

            {/* Bottom-center Chat Composer */}
            <ChatComposer
                tokens={tokens}
                prompt={prompt}
                onPrompt={setPrompt}
                model={model}
                onModel={setModel}
                size={size}
                onSize={setSize}
                onSubmit={onSubmitFromComposer}
                canSubmit={canSubmit}
                cooldownLabel={`Next +1 in ${mmss(cooldownMs)}`}
            />

            {/* Right-docked Generation Panel */}
            <GenerationPanel
                open={panelOpen}
                onOpenChange={setPanelOpen}
                model={model}
                size={size}
                tokens={tokens}
                variants={variants}
                generating={generating}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onRegenerateSlot={regenerateOne}
                genError={genError}
                // inform panel whether we have a point yet (idea-first vs tile-first banner)
                hasPoint={!!presetPoint}
                onPlace={onPlaceSelected}
                cooldownMs={cooldownMs}
            // when tile-first “Create” was clicked, focus already set by event
            />
        </div>
    );
}

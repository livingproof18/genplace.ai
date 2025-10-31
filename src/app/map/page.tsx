"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { PointPlacement, Size, Model } from "@/components/map/types";

import { useTokens } from "@/hooks/use-tokens";
import { mmss } from "@/lib/time";

import { ChatComposer } from "@/components/create/chat-composer";
import { GenerationPanel, type Variant } from "@/components/create/generation-panel";
import { BottomCenterAction } from "@/components/map/bottom-center-action";

import { AnimatePresence } from "framer-motion";

const DRAFT_KEY = "genplace:composer:draft";
const DRAFT_SAVED_AT_KEY = "genplace:composer:draftSavedAt";

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

    // NEW: gate the ChatComposer
    const [composerOpen, setComposerOpen] = useState(false);

    // === util ===
    const cooldownMs = Math.max(0, tokens.nextRegenAt - Date.now());
    const canSubmit = prompt.trim().length > 0 && tokens.current > 0 && !generating;

    // === events from map ===
    // === events from map ===
    useEffect(() => {
        const onOpenCreate = (e: any) => {
            // If detail has coords, use them as the presetPoint (tile-first create).
            const d = e?.detail;
            if (d && typeof d.lat === "number" && typeof d.lng === "number") {
                setPresetPoint({ lat: d.lat, lng: d.lng });
            } else {
                setPresetPoint(null);
            }

            // Always open the composer for this event (this is the explicit "Create" action).
            setComposerOpen(true);
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent("genplace:composer:focus"));
            }, 0);
        };

        window.addEventListener("genplace:create", onOpenCreate as any);
        return () => {
            window.removeEventListener("genplace:create", onOpenCreate as any);
        };
    }, []);


    // in MapPage component
    useEffect(() => {
        const onPoint = (e: any) => {
            const d = e?.detail;
            if (!d) return;

            // Only set the presetPoint so GenerationPanel gets hasPoint={true}.
            setPresetPoint({ lat: d.lat, lng: d.lng });

            // IMPORTANT: do NOT open the composer here. Map clicks should only show the SelectionModal.
            // If composer is already open, we intentionally leave it as-is (so the user can keep typing).
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

    useEffect(() => {
        console.log("panelOpen changed:", panelOpen);
    }, [panelOpen]);


    // submit → open panel and (optionally) hide composer to keep the screen clean
    // submit → open panel and (optionally) hide composer to keep the screen clean
    async function onSubmitFromComposer() {
        if (!canSubmit) return;
        setPanelOpen(true);
        setComposerOpen(false); // hide composer
        // dispatch closed so bottom button can receive focus once mounted
        setTimeout(() => window.dispatchEvent(new CustomEvent("genplace:composer:closed")), 60);

        setVariants([]);
        setSelectedId(null);
        setGenerating(true);
        setGenError(null);

        try {
            const imgs = await doGenerate();
            console.log("Generated images:", imgs);
            setVariants(imgs.slice(0, 2));
        } catch (err) {
            setVariants([]);
            setSelectedId(null);
            const message = err instanceof Error ? err.message : "Something went wrong. Try again.";
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
        console.log("Placing image:", picked, "at", presetPoint);
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

        // clear persisted draft on place (user finished the prompt)
        try {
            localStorage.removeItem(DRAFT_KEY);
            localStorage.removeItem(DRAFT_SAVED_AT_KEY);
        } catch { }

        // close panel & clear selection (keep prompt for quick re-run)
        setPanelOpen(false);
        setSelectedId(null);
    }

    return (
        <div className="h-dvh w-screen overflow-hidden">
            <MapLibreWorld
                sizePx={size}
                placements={placements}
                onClickEmpty={() => { }}
                onClickPlacement={() => { }}
                hasTokens={tokens.current > 0}
                cooldownLabel={`Out of tokens — regenerates in ${mmss(cooldownMs)}`}
                label={`Create ${tokens.current}/${tokens.max}`}
                // <-- NEW: tell the map we're in generation mode when the panel is open
                generationMode={panelOpen}
            />

            {/* Show the main bottom "Create" button only when the composer is closed AND the generation panel is NOT open */}
            {!composerOpen && !panelOpen && (
                <BottomCenterAction
                    label={`Create ${tokens.current}/${tokens.max}`}
                    disabled={tokens.current <= 0}
                    cooldownText={`Out of tokens — regenerates in ${mmss(cooldownMs)}`}
                    onClick={() => {
                        // idea-first create
                        setPresetPoint(null);
                        setComposerOpen(true);
                        setTimeout(() => {
                            window.dispatchEvent(new CustomEvent("genplace:composer:focus"));
                        }, 0);
                    }}
                />
            )}

            {/* Bottom-center Chat Composer — only render when opened from the two entry points */}
            {/* Bottom-center Chat Composer — animated mount/unmount */}
            <AnimatePresence mode="wait">
                {composerOpen && (
                    <ChatComposer
                        key="chat-composer"
                        tokens={tokens}
                        prompt={prompt}
                        onPrompt={setPrompt}
                        model={model}
                        onModel={setModel}
                        size={size}
                        onSize={setSize}
                        onSubmit={onSubmitFromComposer}
                        onClose={() => {
                            setComposerOpen(false);
                            // let the bottom button reappear with a short delay for smoother sync
                            setTimeout(() => window.dispatchEvent(new CustomEvent("genplace:composer:closed")), 250);
                        }}
                        canSubmit={canSubmit}
                        cooldownLabel={`Next +1 in ${mmss(cooldownMs)}`}
                    />
                )}
            </AnimatePresence>


            {/* Right-docked Generation Panel */}
            <GenerationPanel
                open={panelOpen}
                onOpenChange={(v) => {
                    setPanelOpen(v);
                    console.log("Generation Panel Open:", v);
                    // Optional: when panel closes, bring back the bottom button (composer stays closed)
                    if (!v) {
                        // if you prefer to auto-reopen composer after closing panel, setComposerOpen(true) instead
                    }
                }}
                model={model}
                size={size}
                tokens={tokens}
                variants={variants}
                generating={generating}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onRegenerateSlot={regenerateOne}
                genError={genError}
                hasPoint={!!presetPoint}
                onPlace={onPlaceSelected}
                cooldownMs={cooldownMs}
            />
        </div>
    );

}

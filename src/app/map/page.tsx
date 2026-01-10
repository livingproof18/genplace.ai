"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { PointPlacement, Size, Model } from "@/components/map/types";
import type { Style } from "@/lib/image-styles";
import type { User } from "@supabase/supabase-js";

import { useTokens } from "@/hooks/use-tokens";
import { MODEL_TOKEN_COST, type TokenModelId } from "@/lib/tokens/model-cost";
import { createBrowserClient } from "@/lib/supabase/browser";
import { LoginModal } from "@/components/auth/login-modal";
import type { UserStub } from "@/components/map/top-right-controls";

import { ChatComposer } from "@/components/create/chat-composer";
import { GenerationPanel, type Variant } from "@/components/create/generation-panel";
import { BottomCenterAction } from "@/components/map/bottom-center-action";
import { TokenDebugPanel } from "@/components/dev/token-debug";

import { AnimatePresence } from "framer-motion";

const DRAFT_KEY = "genplace:composer:draft";
const DRAFT_SAVED_AT_KEY = "genplace:composer:draftSavedAt";

const TOKEN_MODEL_BY_UI: Record<Model, TokenModelId> = {
    "google-flash": "google-nano-banana",
    "google-pro": "google-nano-banana-pro",
    "openai-1": "openai-gpt-image-1",
    "openai-1.5": "openai-gpt-image-1.5",
    sdxl: "stability-core",
};

const MapLibreWorld = dynamic(
    () => import("@/components/map/maplibre-world").then((m) => m.MapLibreWorld),
    { ssr: false }
);

export default function MapPage() {
    const { tokens, loading: tokensLoading, refreshTokens, applyTokenState } = useTokens();
    const supabase = useMemo(() => createBrowserClient(), []);
    const [authUser, setAuthUser] = useState<User | null>(null);
    const [loginOpen, setLoginOpen] = useState(false);
    const [now, setNow] = useState(Date.now());

    // map placements
    const [placements, setPlacements] = useState<PointPlacement[]>([]);

    // creation state shared between composer & panel
    const [prompt, setPrompt] = useState("");
    const [size, setSize] = useState<Size>(256);
    const [model, setModel] = useState<Model>("openai-1");
    const [style, setStyle] = useState<Style>("auto");
    const [presetPoint, setPresetPoint] = useState<{ lat: number; lng: number } | null>(null);

    const [generating, setGenerating] = useState(false);
    const [variants, setVariants] = useState<Variant[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const [genError, setGenError] = useState<string | null>(null);

    // NEW: gate the ChatComposer
    const [composerOpen, setComposerOpen] = useState(false);

    const userStub: UserStub | null = useMemo(() => {
        if (!authUser) return null;
        const metadata = authUser.user_metadata ?? {};
        const name = metadata.full_name || metadata.name || authUser.email || undefined;
        const username =
            metadata.user_name ||
            metadata.preferred_username ||
            (name ? String(name).split(/\s+/)[0].toLowerCase() : undefined);
        return {
            name: name ? String(name) : undefined,
            username: username ? String(username) : undefined,
            userId: authUser.id.slice(0, 6),
            firstName: name ? String(name).split(/\s+/)[0] : undefined,
            avatarUrl: metadata.avatar_url ? String(metadata.avatar_url) : undefined,
        };
    }, [authUser]);

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    // === util ===
    const tokenModel = TOKEN_MODEL_BY_UI[model];
    const tokenCost = MODEL_TOKEN_COST[tokenModel];
    const cooldownMs = Math.max(0, (tokens.cooldownUntil ?? 0) - now);
    const cooldownActive = cooldownMs > 0;
    const cooldownSeconds = Math.ceil(cooldownMs / 1000);
    const cooldownLabel = cooldownActive ? `Cooldown ${cooldownSeconds}s` : "";
    const disabledReason = tokensLoading
        ? "Loading tokens..."
        : tokens.current <= 0
            ? "Out of tokens."
            : cooldownLabel;
    const createLabel = tokensLoading
        ? "Create"
        : `Create ${tokens.current}/${tokens.max}`;
    const canSubmit =
        !tokensLoading &&
        prompt.trim().length > 0 &&
        tokens.current >= tokenCost &&
        !generating &&
        !cooldownActive;

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


    async function requestImages(n: number) {
        const provider =
            model === "google-flash" || model === "google-pro"
                ? "google"
                : model === "sdxl"
                    ? "stability"
                    : "openai";
        const modelId =
            model === "openai-1.5"
                ? "gpt-image-1.5"
                : model === "openai-1"
                    ? "gpt-image-1"
                    : model === "google-pro"
                        ? "gemini-3-pro-image-preview"
                        : model === "google-flash"
                            ? "gemini-2.5-flash-image"
                            : undefined;
        const res = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt: prompt.trim(),
                style,
                size,
                n,
                provider,
                modelId,
                tokenModel,
            }),
        });

        const data = (await res.json().catch(() => ({}))) as {
            variants?: Variant[];
            tokens?: {
                tokens_current: number;
                tokens_max: number;
                cooldown_until: string | null;
                total_generations: number | null;
            };
            error?: string;
            code?: string;
        };

        if (!res.ok) {
            const err = new Error(data?.error || "Image generation failed.");
            (err as Error & { code?: string }).code = data?.code;
            throw err;
        }

        applyTokenState(data.tokens);
        return data.variants ?? [];
    }

    async function regenerateOne(slot: 0 | 1) {
        if (!panelOpen || generating) return;
        setGenerating(true);
        setGenError(null);
        try {
            const imgs = await requestImages(1);
            const nextImg = imgs[0];
            if (nextImg) {
                setVariants((prev) => {
                    const next = [...prev];
                    if (next[slot]) next[slot] = nextImg;
                    return next;
                });
            }
        } catch (err) {
            if (err instanceof Error) {
                setGenError(err.message);
            } else {
                setGenError("Something went wrong. Try again.");
            }
            await refreshTokens();
        } finally {
            setGenerating(false);
        }
    }

    useEffect(() => {
        console.log("panelOpen changed:", panelOpen);
    }, [panelOpen]);

    useEffect(() => {
        let mounted = true;
        supabase.auth
            .getSession()
            .then(({ data }) => {
                if (!mounted) return;
                setAuthUser(data.session?.user ?? null);
            })
            .catch(() => {
                if (!mounted) return;
                setAuthUser(null);
            });

        const { data: subscription } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setAuthUser(session?.user ?? null);
            }
        );

        return () => {
            mounted = false;
            subscription.subscription.unsubscribe();
        };
    }, [supabase]);

    useEffect(() => {
        if (authUser) setLoginOpen(false);
    }, [authUser]);

    useEffect(() => {
        refreshTokens();
    }, [authUser, refreshTokens]);


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
            const imgs = await requestImages(2);
            console.log("Generated images:", imgs);
            setVariants(imgs.slice(0, 2));
        } catch (err) {
            setVariants([]);
            setSelectedId(null);
            if (err instanceof Error) {
                setGenError(err.message);
            } else {
                setGenError("Something went wrong. Try again.");
            }
            await refreshTokens();
        } finally {
            setGenerating(false);
        }
    }

    async function onPlaceSelected() {
        if (!selectedId || !presetPoint) return;

        // simulate place
        await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
        const picked = variants.find((v) => v.id === selectedId);
        console.log("Placing image:", picked, "at", presetPoint);
        if (!picked) return;

        // add to map
        setPlacements((prev) => [
            ...prev.filter((q) => q.id !== picked.id),
            {
                id: crypto.randomUUID(),
                url: picked.url,
                lat: presetPoint.lat,
                lng: presetPoint.lng,
                pixelSize: size,
                anchor: "center",
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

        // cleanup ghost preview
        window.dispatchEvent(new CustomEvent("genplace:preview:clear"));
    }

    return (
        <div className="h-dvh w-screen overflow-hidden">
            <MapLibreWorld
                sizePx={size}
                placements={placements}
                onClickEmpty={() => { }}
                onClickPlacement={() => { }}
                hasTokens={!tokensLoading && tokens.current > 0 && !cooldownActive}
                cooldownLabel={disabledReason}
                label={createLabel}
                // <-- NEW: tell the map we're in generation mode when the panel is open
                generationMode={panelOpen}
                previewUrl={selectedId ? variants.find(v => v.id === selectedId)?.url || null : null}
                user={userStub}
                onLogin={() => setLoginOpen(true)}

            />

            {/* Show the main bottom "Create" button only when the composer is closed AND the generation panel is NOT open */}
            {!composerOpen && !panelOpen && (
                <BottomCenterAction
                    label={createLabel}
                    disabled={tokensLoading || tokens.current <= 0 || cooldownActive}
                    cooldownText={disabledReason}
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
                        tokenCost={tokenCost}
                        prompt={prompt}
                        onPrompt={setPrompt}
                        model={model}
                        onModel={setModel}
                        style={style}
                        onStyle={setStyle}
                        size={size}
                        onSize={setSize}
                        onSubmit={onSubmitFromComposer}
                        onClose={() => {
                            setComposerOpen(false);
                            // let the bottom button reappear with a short delay for smoother sync
                            setTimeout(() => window.dispatchEvent(new CustomEvent("genplace:composer:closed")), 250);
                        }}
                        canSubmit={canSubmit}
                        cooldownLabel={cooldownLabel}
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
                tokenCost={tokenCost}
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

            {process.env.NODE_ENV !== "production" && <TokenDebugPanel />}

            <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
        </div>
    );

}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { PointPlacement, Size, Model } from "@/components/map/types";
import type { Style } from "@/lib/image-styles";
import type { User } from "@supabase/supabase-js";

import { useTokens } from "@/hooks/use-tokens";
import { MODEL_TOKEN_COST, type TokenModelId } from "@/lib/tokens/model-cost";
import { createBrowserClient } from "@/lib/supabase/browser";
import { usePlacementsRealtime, type PlacementRow } from "@/lib/realtime/usePlacementsRealtime";
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

type ViewportBounds = {
    north: number;
    south: number;
    east: number;
    west: number;
    zoom: number;
};

function isPointInViewport(lat: number, lng: number, bounds: ViewportBounds) {
    const inLat = lat >= bounds.south && lat <= bounds.north;
    const crossesDateline = bounds.east < bounds.west;
    const inLng = crossesDateline
        ? lng >= bounds.west || lng <= bounds.east
        : lng >= bounds.west && lng <= bounds.east;
    return inLat && inLng;
}

export default function MapPage() {
    const { tokens, loading: tokensLoading, refreshTokens, applyTokenState } = useTokens();
    const supabase = useMemo(() => createBrowserClient(), []);
    const [authUser, setAuthUser] = useState<User | null>(null);
    const [loginOpen, setLoginOpen] = useState(false);
    const [now, setNow] = useState(Date.now());

    // map placements
    const [placements, setPlacements] = useState<PointPlacement[]>([]);
    const viewportRef = useRef<ViewportBounds | null>(null);
    const [initialViewport, setInitialViewport] = useState<ViewportBounds | null>(null);
    const initialViewportSetRef = useRef(false);
    const [realtimeReady, setRealtimeReady] = useState(false);

    // creation state shared between composer & panel
    const [prompt, setPrompt] = useState("");
    const [size, setSize] = useState<Size>(256);
    const [model, setModel] = useState<Model>("openai-1");
    const [style, setStyle] = useState<Style>("auto");
    const [presetPoint, setPresetPoint] = useState<{ lat: number; lng: number } | null>(null);
    const selectedPointRef = useRef<{ lat: number; lng: number } | null>(null);

    const [generating, setGenerating] = useState(false);
    const [variants, setVariants] = useState<Variant[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const [genError, setGenError] = useState<string | null>(null);

    // NEW: gate the ChatComposer
    const [composerOpen, setComposerOpen] = useState(false);
    const devLog = process.env.NODE_ENV !== "production";
    const placingRef = useRef(false);

    const parsePoint = (d: any) => {
        const lat =
            typeof d?.lat === "string" ? Number.parseFloat(d.lat) : d?.lat;
        const lng =
            typeof d?.lng === "string" ? Number.parseFloat(d.lng) : d?.lng;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null;
        }
        return { lat: lat as number, lng: lng as number };
    };

    const handleViewportChange = useCallback((bounds: ViewportBounds) => {
        viewportRef.current = bounds;
        if (!initialViewportSetRef.current) {
            initialViewportSetRef.current = true;
            setInitialViewport(bounds);
        }
    }, []);

    useEffect(() => {
        if (!initialViewport) return;
        let cancelled = false;

        const loadInitialPlacements = async () => {
            try {
                const crossesDateline = initialViewport.east < initialViewport.west;
                let placementQuery = supabase
                    .from("placements")
                    .select("id,image_url,size,created_at,lat,lng,prompt")
                    .gte("lat", initialViewport.south)
                    .lte("lat", initialViewport.north);

                if (crossesDateline) {
                    placementQuery = placementQuery.or(
                        `lng.gte.${initialViewport.west},lng.lte.${initialViewport.east}`
                    );
                } else {
                    placementQuery = placementQuery
                        .gte("lng", initialViewport.west)
                        .lte("lng", initialViewport.east);
                }

                const { data: placementsData, error: placementsError } = await placementQuery
                    .returns<PlacementRow[]>();

                if (placementsError) {
                    console.error("[placements] placement query failed", placementsError);
                    return;
                }

                if (devLog) {
                    console.log("[placements] loaded placements", {
                        count: placementsData?.length ?? 0,
                        firstImageUrl: placementsData?.[0]?.image_url ?? null,
                        firstLatLng: placementsData?.[0]
                            ? { lat: placementsData?.[0]?.lat, lng: placementsData?.[0]?.lng }
                            : null,
                    });
                }
                const nextPlacements: PointPlacement[] = [];
                for (const placement of placementsData ?? []) {
                    const imageUrl = placement.image_url;
                    if (!imageUrl) continue;
                    if (!Number.isFinite(placement.lat) || !Number.isFinite(placement.lng)) {
                        if (devLog) {
                            console.warn("[placements] missing lat/lng", placement);
                        }
                        continue;
                    }
                    nextPlacements.push({
                        id: placement.id,
                        placementId: placement.id,
                        url: imageUrl,
                        lat: placement.lat as number,
                        lng: placement.lng as number,
                        pixelSize: typeof placement.size === "number" ? placement.size : 256,
                        anchor: "center",
                        prompt: typeof placement.prompt === "string" ? placement.prompt : undefined,
                        size: typeof placement.size === "number" ? placement.size : undefined,
                        placedAt: placement.created_at,
                    });
                }

                if (devLog) {
                    console.log("[placements] nextPlacements", {
                        count: nextPlacements.length,
                    });
                }

                if (!cancelled) {
                    setPlacements(nextPlacements);
                }
            } finally {
                if (!cancelled) {
                    setRealtimeReady(true);
                }
            }
        };

        void loadInitialPlacements();

        return () => {
            cancelled = true;
        };
    }, [initialViewport, supabase]);

    const applyRealtimePlacement = useCallback(
        async (placement: PlacementRow) => {
            if (!Number.isFinite(placement.lat) || !Number.isFinite(placement.lng)) {
                if (devLog) {
                    console.warn("[realtime] placement missing lat/lng", placement);
                }
                return;
            }

            const bounds = viewportRef.current;
            if (bounds && !isPointInViewport(placement.lat as number, placement.lng as number, bounds)) {
                if (devLog) {
                    console.log("[realtime] placement ignored (out of viewport)", placement);
                }
                return;
            }

            const imageUrl = placement.image_url;
            if (!imageUrl) return;

            const pixelSize = typeof placement.size === "number" ? placement.size : 256;
            const nextPlacement: PointPlacement = {
                id: placement.id,
                placementId: placement.id,
                url: imageUrl,
                lat: placement.lat as number,
                lng: placement.lng as number,
                pixelSize,
                anchor: "center",
            };

            if (devLog) {
                console.log("[realtime] render placement", {
                    id: placement.id,
                    lat: placement.lat,
                    lng: placement.lng,
                });
            }

            setPlacements((prev) => {
                const next = prev.filter((p) => p.id !== placement.id);
                return [...next, nextPlacement];
            });
        },
        [devLog]
    );

    const isInViewport = useCallback((placement: PlacementRow) => {
        const bounds = viewportRef.current;
        if (!bounds) return true;
        if (!Number.isFinite(placement.lat) || !Number.isFinite(placement.lng)) {
            return true;
        }
        return isPointInViewport(placement.lat as number, placement.lng as number, bounds);
    }, []);

    usePlacementsRealtime({
        onInsert: (placement) => {
            void applyRealtimePlacement(placement);
        },
        isInViewport,
        enabled: realtimeReady,
    });

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
            const point = parsePoint(d);
            if (point) {
                setPresetPoint(point);
                selectedPointRef.current = point;
            } else {
                setPresetPoint(null);
                selectedPointRef.current = null;
            }

            if (devLog) {
                console.log("[place] genplace:create detail", d);
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
            const point = parsePoint(d);
            if (!point) {
                if (devLog) {
                    console.warn("[place] invalid point detail", d);
                }
                return;
            }

            // Only set the presetPoint so GenerationPanel gets hasPoint={true}.
            setPresetPoint(point);
            selectedPointRef.current = point;

            // IMPORTANT: do NOT open the composer here. Map clicks should only show the SelectionModal.
            // If composer is already open, we intentionally leave it as-is (so the user can keep typing).
            if (devLog) {
                console.log("[place] genplace:create:point detail", d);
            }
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
        const point = selectedPointRef.current ?? presetPoint;
        if (!selectedId || !point) {
            if (devLog) {
                console.warn("[place] missing placement point", {
                    selectedId,
                    presetPoint,
                    selectedPointRef: selectedPointRef.current,
                });
            }
            return;
        }
        if (placingRef.current) return;
        placingRef.current = true;
        setGenError(null);

        try {
            if (devLog) {
                console.log("[place] submit request", {
                    generationId: selectedId,
                    lat: point.lat,
                    lng: point.lng,
                    presetPoint,
                    selectedPointRef: selectedPointRef.current,
                });
            }
            const payload = {
                generationId: selectedId,
                lat: point.lat,
                lng: point.lng,
            };
            if (devLog) {
                console.log("[PLACE payload]", payload, {
                    latType: typeof payload.lat,
                    lngType: typeof payload.lng,
                    latIsFinite: Number.isFinite(payload.lat),
                    lngIsFinite: Number.isFinite(payload.lng),
                });
            }
            const res = await fetch("/api/place", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const message = data?.error || "Placement failed.";
                throw new Error(message);
            }

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
        } catch (err) {
            if (err instanceof Error) {
                setGenError(err.message);
            } else {
                setGenError("Placement failed.");
            }
        } finally {
            placingRef.current = false;
        }
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
                onViewportChange={handleViewportChange}

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

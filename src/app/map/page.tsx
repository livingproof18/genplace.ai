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

const PLACEMENT_TILE_Z = 5;

type ViewportBounds = {
    north: number;
    south: number;
    east: number;
    west: number;
    zoom: number;
};

type SlotRow = {
    id: string;
    z: number;
    x: number;
    y: number;
};

type SlotRowWithPlacement = SlotRow & {
    current_placement_id: string | null;
};

type SlotCoords = SlotRow & {
    lat: number;
    lng: number;
};

function tile2lon(x: number, z: number) {
    return (x / Math.pow(2, z)) * 360 - 180;
}

function tile2lat(y: number, z: number) {
    const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function lon2tile(lon: number, z: number) {
    return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}

function lat2tile(lat: number, z: number) {
    const rad = (lat * Math.PI) / 180;
    return Math.floor(
        ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
        Math.pow(2, z)
    );
}

function isSlotInViewport(slot: SlotCoords, bounds: ViewportBounds) {
    const inLat = slot.lat >= bounds.south && slot.lat <= bounds.north;
    const crossesDateline = bounds.east < bounds.west;
    const inLng = crossesDateline
        ? slot.lng >= bounds.west || slot.lng <= bounds.east
        : slot.lng >= bounds.west && slot.lng <= bounds.east;
    return inLat && inLng;
}

function clampTile(value: number, max: number) {
    return Math.max(0, Math.min(max, value));
}

function tileRangesForBounds(bounds: ViewportBounds, z: number) {
    const maxTile = Math.pow(2, z) - 1;
    const westX = lon2tile(bounds.west, z);
    const eastX = lon2tile(bounds.east, z);
    const northY = lat2tile(bounds.north, z);
    const southY = lat2tile(bounds.south, z);
    const minY = clampTile(Math.min(northY, southY), maxTile);
    const maxY = clampTile(Math.max(northY, southY), maxTile);
    const crossesDateline = bounds.east < bounds.west;

    if (crossesDateline) {
        return {
            ranges: [
                { minX: 0, maxX: clampTile(eastX, maxTile) },
                { minX: clampTile(westX, maxTile), maxX: maxTile },
            ],
            minY,
            maxY,
        };
    }

    return {
        ranges: [
            {
                minX: clampTile(Math.min(westX, eastX), maxTile),
                maxX: clampTile(Math.max(westX, eastX), maxTile),
            },
        ],
        minY,
        maxY,
    };
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
    const slotCacheRef = useRef<Map<string, SlotCoords>>(new Map());
    const [initialViewport, setInitialViewport] = useState<ViewportBounds | null>(null);
    const initialViewportSetRef = useRef(false);
    const [realtimeReady, setRealtimeReady] = useState(false);

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
    const devLog = process.env.NODE_ENV !== "production";
    const placingRef = useRef(false);

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
                const { ranges, minY, maxY } = tileRangesForBounds(
                    initialViewport,
                    PLACEMENT_TILE_Z
                );

                const slotResults = await Promise.all(
                    ranges.map((range) =>
                        supabase
                            .from("slots")
                            .select("id,z,x,y,current_placement_id")
                            .eq("z", PLACEMENT_TILE_Z)
                            .gte("x", range.minX)
                            .lte("x", range.maxX)
                            .gte("y", minY)
                            .lte("y", maxY)
                            .returns<SlotRowWithPlacement[]>()
                    )
                );

                const slots: SlotRowWithPlacement[] = [];
                for (const result of slotResults) {
                    if (result.error) {
                        console.error("[placements] slot query failed", result.error);
                        continue;
                    }
                    if (result.data) slots.push(...result.data);
                }

                if (cancelled) return;

                for (const slot of slots) {
                    const coords: SlotCoords = {
                        id: slot.id,
                        z: slot.z,
                        x: slot.x,
                        y: slot.y,
                        lng: tile2lon(slot.x + 0.5, slot.z),
                        lat: tile2lat(slot.y + 0.5, slot.z),
                    };
                    slotCacheRef.current.set(slot.id, coords);
                }

                const placementIds = Array.from(
                    new Set(
                        slots
                            .map((slot) => slot.current_placement_id)
                            .filter((id): id is string => !!id)
                    )
                );

                if (placementIds.length === 0) {
                    setPlacements([]);
                    return;
                }

                const { data: placementsData, error: placementsError } = await supabase
                    .from("placements")
                    .select("id,slot_id,image_url,image_cdn_url,size,created_at")
                    .in("id", placementIds)
                    .returns<PlacementRow[]>();

                if (placementsError) {
                    console.error("[placements] placement query failed", placementsError);
                    return;
                }

                const placementsById = new Map(
                    (placementsData ?? []).map((placement) => [placement.id, placement])
                );

                const nextPlacements: PointPlacement[] = [];
                for (const slot of slots) {
                    if (!slot.current_placement_id) continue;
                    const placement = placementsById.get(slot.current_placement_id);
                    if (!placement) continue;
                    const imageUrl = placement.image_url ?? placement.image_cdn_url;
                    if (!imageUrl) continue;
                    const coords = slotCacheRef.current.get(slot.id);
                    if (!coords) continue;
                    nextPlacements.push({
                        id: slot.id,
                        slotId: slot.id,
                        placementId: placement.id,
                        x: slot.x,
                        y: slot.y,
                        z: slot.z,
                        url: imageUrl,
                        lat: coords.lat,
                        lng: coords.lng,
                        pixelSize: typeof placement.size === "number" ? placement.size : 256,
                        anchor: "center",
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

    const resolveSlot = useCallback(
        async (slotId: string): Promise<SlotCoords | null> => {
            const cached = slotCacheRef.current.get(slotId);
            if (cached) return cached;

            const { data, error } = await supabase
                .from("slots")
                .select("id,z,x,y")
                .eq("id", slotId)
                .single<SlotRow>();

            if (error || !data) {
                console.error("[realtime] slot lookup failed", error ?? "Slot not found");
                return null;
            }

            const coords: SlotCoords = {
                ...data,
                lng: tile2lon(data.x + 0.5, data.z),
                lat: tile2lat(data.y + 0.5, data.z),
            };
            slotCacheRef.current.set(slotId, coords);
            return coords;
        },
        [supabase]
    );

    const applyRealtimePlacement = useCallback(
        async (placement: PlacementRow) => {
            if (!placement?.slot_id) return;
            const slot = await resolveSlot(placement.slot_id);
            if (!slot) return;

            const bounds = viewportRef.current;
            if (bounds && !isSlotInViewport(slot, bounds)) {
                if (devLog) {
                    console.log("[realtime] placement ignored (out of viewport)", placement);
                }
                return;
            }

            const imageUrl = placement.image_url ?? placement.image_cdn_url;
            if (!imageUrl) return;

            const pixelSize = typeof placement.size === "number" ? placement.size : 256;
            const nextPlacement: PointPlacement = {
                id: slot.id,
                slotId: slot.id,
                placementId: placement.id,
                x: slot.x,
                y: slot.y,
                z: slot.z,
                url: imageUrl,
                lat: slot.lat,
                lng: slot.lng,
                pixelSize,
                anchor: "center",
            };

            setPlacements((prev) => {
                const next = prev.filter((p) => {
                    if (p.slotId && p.slotId === slot.id) return false;
                    if (p.x === slot.x && p.y === slot.y && p.z === slot.z) return false;
                    return true;
                });
                return [...next, nextPlacement];
            });
        },
        [resolveSlot, devLog]
    );

    const isInViewport = useCallback((placement: PlacementRow) => {
        const bounds = viewportRef.current;
        if (!bounds) return true;
        const slot = slotCacheRef.current.get(placement.slot_id);
        if (!slot) return true;
        return isSlotInViewport(slot, bounds);
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
        if (placingRef.current) return;
        placingRef.current = true;
        setGenError(null);

        try {
            const z = PLACEMENT_TILE_Z;
            const x = lon2tile(presetPoint.lng, z);
            const y = lat2tile(presetPoint.lat, z);
            const res = await fetch("/api/place", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ generationId: selectedId, z, x, y }),
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

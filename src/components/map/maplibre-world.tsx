// src/components/map/maplibre-world.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GridPlacement } from "./types";
import { TopLeftControls } from "./top-left-controls";
import { TopRightControls } from "./top-right-controls"; // ⬅️ add this import
import { BottomCenterAction } from "./bottom-center-action";
import { toast } from "sonner";
import { SelectionModal, type TileMeta } from "./selection-modal";

// ---- CONFIG ----
const TILE_ZOOM = 5;
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
// ----------------
// === Checkpoint spec constants (MapLibre/GL) ===
const TILE_SIZE = 256;                 // your canvas/generation tile size
const MIN_INTERACT_ZOOM = 17.0;        // block tagging below this
const TILES_VISIBLE_ZOOM = 16.5;       // hide gp_* overlays below this
const CLICK_DEBOUNCE_MS = 250;
const MOVE_TOL_PX = 5;                 // dragging vs click


// ---------------- Slippy helpers ----------------
function lon2tile(lon: number, z: number) {
    return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}
function lat2tile(lat: number, z: number) {
    const rad = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z));
}
function tile2lon(x: number, z: number) { return (x / Math.pow(2, z)) * 360 - 180; }
function tile2lat(y: number, z: number) {
    const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}
function tileBounds(x: number, y: number, z: number) {
    const west = tile2lon(x, z);
    const east = tile2lon(x + 1, z);
    const north = tile2lat(y, z);
    const south = tile2lat(y + 1, z);
    return [
        [west, north], [east, north], [east, south], [west, south],
    ] as [[number, number], [number, number], [number, number], [number, number]];
}

// Unique id for our art tile
const artId = (x: number, y: number, z: number) => `gp_${x}_${y}_${z}`;

// Fingerprint a placement so we know if the image/coords actually changed
const fpPlacement = (p: GridPlacement) =>
    `${p.url}|${p.x}|${p.y}|${p.z}`;

// Build a simple signature for placements we actually render
const placementsSig = (list: GridPlacement[]) =>
    list
        .filter(p => p.z === TILE_ZOOM)
        .map(p => `${p.x},${p.y},${p.z}:${p.url}`)
        .sort()
        .join(";");

// ------
// ---- camera animation helpers ----
// -------- Smooth flight helper (wplace-style) --------
function easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * flySmooth:
 * Uses map.flyTo (zoom + pan together) with tuned params to emulate:
 *   - gentle zoom-out while starting to pan
 *   - steady travel
 *   - smooth decelerating zoom-in at destination
 *
 * center: [lng, lat]
 * finalZoom: number (e.g., 11 for locate, ~4.5 for explore)
 * options (optional):
 *   - speed: lower = slower (default 0.6)
 *   - curve: flight curvature (default 1.35)
 *   - maxDuration: cap long flights (ms) — optional
 *   - For very long jumps (e.g., London → Sydney), consider setting maxDuration ~2500–3200ms so it doesn’t take too long.
 */
function flySmooth(
    map: any,
    center: [number, number],
    finalZoom: number,
    options?: { speed?: number; curve?: number; maxDuration?: number }
) {
    if (!map) return;

    const { speed = 0.7, curve = 1.35, maxDuration } = options || {};

    if (typeof map.flyTo === "function") {
        map.flyTo({
            center,
            zoom: finalZoom,
            speed,         // default ~1.2; lower => slower, smoother
            curve,         // default ~1.42; tweak shape of zoom path
            easing: easeInOutCubic,
            bearing: 0,
            pitch: 0,
            // By default duration is computed from distance & speed/curve.
            // You can cap it for very long hops:
            ...(maxDuration ? { maxDuration } : {}),
            // essential: true  // (optional) mark as essential for prefers-reduced-motion
        });
        return;
    }

    // Fallback (older builds): two-step ease
    const currentZoom = map.getZoom?.() ?? 3;
    const midZoom = Math.max(2.2, Math.min(currentZoom, finalZoom) - 2.8);

    // Step A: soften by easing out to a mid zoom
    map.easeTo({
        zoom: midZoom,
        duration: 450,
        easing: easeInOutCubic,
        bearing: 0,
        pitch: 0,
    });

    // Step B: slide + ease in to target
    map.once("moveend", () => {
        map.easeTo({
            center,
            zoom: finalZoom,
            duration: 900,
            easing: easeInOutCubic,
            bearing: 0,
            pitch: 0,
        });
    });
}
// -----------------------------------------------------




// === Declutter helpers (style-aware & gentle) ===
function applyDeclutter(map: any) {
    const style = map.getStyle?.();
    if (!style || !style.layers) return;

    const layers: any[] = style.layers;
    const isOurOverlay = (l: any) => typeof l?.id === "string" && l.id.startsWith("gp_");
    const hideIf = (pred: (l: any) => boolean) => {
        layers.forEach(l => {
            if (isOurOverlay(l)) return;
            if (pred(l) && map.getLayer(l.id)) {
                try { map.setLayoutProperty(l.id, "visibility", "none"); } catch { }
            }
        });
    };

    hideIf(l =>
        l["source-layer"] === "building" ||
        /building|building_outline|building-?number|housenumber/i.test(l.id) ||
        l.type === "fill-extrusion"
    );
    hideIf(l =>
        /(^|_)poi(_|$)|amenity|mbxpoi|place_of_worship/i.test(l.id) &&
        !/place-label|place_label|transport|airport_label/i.test(l.id)
    );
    hideIf(l => /aeroway|runway|taxiway/i.test(l.id) && !/airport_label/i.test(l.id));
    hideIf(l =>
        /tree|wood_symbol/i.test(l.id) &&
        !/landuse|landcover|park|forest|wood|grass|meadow/i.test(l.id)
    );
}
function installDeclutterHooks(map: any) {
    try { map.setTerrain(null as any); } catch { }
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.keyboard?.disableRotation?.();

    let raf: number | null = null;
    let lastRunSignature = "";
    const runOnceSettled = () => {
        if (raf !== null) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
            if (!map.isStyleLoaded?.()) return;
            const layers = map.getStyle?.().layers || [];
            const sig = layers.length + ":" + layers.map((l: any) => l.id).join("|");
            if (sig !== lastRunSignature) {
                applyDeclutter(map);
                lastRunSignature = sig;
            }
        });
    };
    runOnceSettled();
    map.on("styledata", runOnceSettled);
    map.on("error", (e: any) => {
        const err = e?.error;
        if (err?.name === "AbortError") return;
        console.error("[MapLibre error]", err || e);
    });
    map.once("remove", () => { if (raf !== null) cancelAnimationFrame(raf); });
}
// -------------- Checkpoint helpers --------------
type Checkpoint = { x: number; y: number; lat: number; lng: number; zoom: number; placedAt: number };
const MUTE_KEY = "genplace:map:mute";

function makeMarkerEl() {
    const el = document.createElement("div");
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", "Checkpoint");
    el.style.width = "26px";
    el.style.height = "26px";
    el.style.borderRadius = "9999px";
    el.style.background = "radial-gradient(circle at 50% 45%, rgba(255,255,255,0.25) 0 30%, hsl(217 91% 60%) 30% 100%)";
    el.style.boxShadow = "0 8px 24px hsla(217, 91%, 60%, .25), 0 0 0 1px rgba(255,255,255,.15) inset";
    el.style.transform = "translateY(-6px) scale(0.92)";
    el.style.transition = "transform 180ms ease, opacity 180ms ease";
    el.style.opacity = "0";
    // small “stem” to imply bottom-center anchor
    const stem = document.createElement("div");
    stem.style.position = "absolute";
    stem.style.left = "50%";
    stem.style.bottom = "-6px";
    stem.style.transform = "translateX(-50%)";
    stem.style.width = "6px";
    stem.style.height = "6px";
    stem.style.borderRadius = "9999px";
    stem.style.background = "hsl(217 91% 60%)";
    stem.style.boxShadow = "0 6px 12px hsla(217, 91%, 60%, .35)";
    el.appendChild(stem);
    // pop-in (respect reduced motion)
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
        el.style.opacity = "1";
        el.style.transform = prefersReduced ? "translateY(-6px)" : "translateY(-6px) scale(1)";
    });
    return el;
}

// Simple synth “pop” (no asset needed)
let audioCtx: AudioContext | null = null;
function playPop(isMuted: boolean) {
    if (isMuted) return;
    try {
        audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
        const ctx = audioCtx;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.value = 420; // start
        const now = ctx.currentTime;
        o.frequency.exponentialRampToValueAtTime(220, now + 0.12);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        o.connect(g).connect(ctx.destination);
        o.start(now); o.stop(now + 0.2);
        // light haptic, if available
        if ("vibrate" in navigator) navigator.vibrate?.(10);
    } catch { }
}

// Snap map click to nearest TILE_SIZE grid at the current zoom (uses project/unproject)
function snapToTile(map: any, lng: number, lat: number, zoom: number) {
    const p = map.project([lng, lat], zoom); // world px at this zoom
    const tx = Math.round(p.x / TILE_SIZE);
    const ty = Math.round(p.y / TILE_SIZE);
    const cx = (tx + 0.5) * TILE_SIZE;
    const cy = (ty + 0.5) * TILE_SIZE;
    const snapped = map.unproject({ x: cx, y: cy }, zoom);
    return { x: tx, y: ty, lat: snapped.lat, lng: snapped.lng };
}

// === Component ===
type Props = {
    placements: GridPlacement[];
    onClickEmpty: (xy: { x: number; y: number }) => void;
    onClickPlacement: (p: GridPlacement) => void;
    sizePx: 128 | 256 | 512;
    onCreate?: () => void;            // ⬅️ new: open prompt drawer
    hasTokens?: boolean;              // ⬅️ new: control disabled state
    cooldownLabel?: string;           // ⬅️ new: e.g. "Out of tokens — regenerates in 2:14"
};

export function MapLibreWorld({ placements, onClickEmpty, onClickPlacement,
    sizePx,
    onCreate,
    hasTokens = true,
    cooldownLabel = "You're out of tokens — regenerates soon",

}: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<any>(null);
    const center = useMemo<[number, number]>(() => [0, 20], []);
    const indexRef = useRef<Map<string, GridPlacement>>(new Map());

    const [overlaysVisible, setOverlaysVisible] = useState(true);

    // Track what we currently have on the map to avoid churn
    // track gp_* layers to toggle quickly
    const currentIdsRef = useRef<Set<string>>(new Set());
    const currentMetaRef = useRef<Map<string, string>>(new Map());
    const lastSigRef = useRef<string>("");

    // --- checkpoint state ---
    const [checkpoint, setCheckpoint] = useState<Checkpoint | undefined>(undefined);
    const markerRef = useRef<any>(null);  // maplibregl.Marker
    const markerElRef = useRef<HTMLDivElement | null>(null);
    const lastDownRef = useRef<{ x: number; y: number } | null>(null);
    const lastPlacementAtRef = useRef<number>(0);
    const [isMuted, setIsMuted] = useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        return localStorage.getItem(MUTE_KEY) === "1";
    });

    // --- selection modal state ---
    const [selectionTile, setSelectionTile] = useState<TileMeta | null>(null);
    const [selectionOpen, setSelectionOpen] = useState(false);

    // helper for “build meta” (dummy country for now)
    const toTileMeta = (x: number, y: number, z: number): TileMeta => ({
        x, y, zoom: z,
        countryName: undefined,       // MVP: unknown
        countryFlagEmoji: undefined,  // MVP: unknown
        painted: false,               // MVP: assume unpainted
    });

    // share handler
    const shareTile = async (tile: TileMeta) => {
        try {
            const url = new URL(window.location.href);
            url.pathname = "/map";
            url.searchParams.set("x", String(tile.x));
            url.searchParams.set("y", String(tile.y));
            url.searchParams.set("z", String(tile.zoom));
            await navigator.clipboard.writeText(url.toString());
            toast.success("Link copied", { duration: 1800 });
        } catch {
            toast.error("Couldn't copy link");
        }
    };

    // open drawer with coords (Option A)
    const createForTile = (tile: TileMeta) => {
        setSelectionOpen(false);
        // Use your existing “Create” integration:
        // Fire a targeted event with coords, MapPage will open PromptDrawer preset.
        window.dispatchEvent(new CustomEvent("genplace:create:tile", { detail: { x: tile.x, y: tile.y } }));
        // Also fire the generic event if you want to keep both flows working:
        if (!onCreate) window.dispatchEvent(new CustomEvent("genplace:create"));
        onCreate?.();
    };

    useEffect(() => {
        // close modal if user zooms out below threshold
        const map = mapRef.current;
        if (!map) return;
        const onZoomEnd = () => {
            const z = map.getZoom();
            if (z < MIN_INTERACT_ZOOM) setSelectionOpen(false);
        };
        map.on("zoomend", onZoomEnd);
        return () => { map.off("zoomend", onZoomEnd); };
    }, []);


    // Mount map
    useEffect(() => {
        let destroyed = false;
        (async () => {
            const lib = await import("maplibre-gl");
            if (destroyed) return;
            const maplibregl = (lib as any).default ?? lib;
            const map = new maplibregl.Map({
                container: containerRef.current!,
                style: STYLE_URL,
                center, zoom: 3, attributionControl: true,
                pitch: 0, maxPitch: 0, bearing: 0,
                dragRotate: false, pitchWithRotate: false, touchPitch: false,
            });
            mapRef.current = map;

            map.on("load", () => {
                installDeclutterHooks(map);
                map.getCanvas().style.cursor = "grab";
                const maplibregl = (lib as any).default ?? lib;

                // ----- low-zoom visibility gate for gp_* overlays -----
                const syncOverlayVisibilityForZoom = () => {
                    const z = map.getZoom();
                    const allowedByZoom = z >= TILES_VISIBLE_ZOOM;
                    for (const id of currentIdsRef.current) {
                        const layerId = `${id}_layer`;
                        if (map.getLayer(layerId)) {
                            const shouldShow = overlaysVisible && allowedByZoom;
                            map.setPaintProperty(layerId, "raster-opacity", shouldShow ? 1 : 0);
                        }
                    }
                };
                map.on("zoomend", syncOverlayVisibilityForZoom);

                // ----- pointer handlers for click vs drag -----
                map.on("mousedown", (e: any) => {
                    lastDownRef.current = { x: e.point.x, y: e.point.y };
                });

                map.on("click", async (e: any) => {
                    const now = Date.now();
                    if (now - lastPlacementAtRef.current < CLICK_DEBOUNCE_MS) return;

                    // treat it as a click only if not dragged
                    const d0 = lastDownRef.current;
                    const moved = d0 ? Math.hypot(e.point.x - d0.x, e.point.y - d0.y) : 0;
                    if (moved > MOVE_TOL_PX) return;

                    const z = map.getZoom();
                    if (z < MIN_INTERACT_ZOOM) {
                        toast.message("You need to zoom in to select a tile.", { duration: 2000 });
                        return;
                    }

                    // snap to tile @ current zoom
                    const { lng, lat } = e.lngLat;
                    const snapped = snapToTile(map, lng, lat, z);

                    const cp: Checkpoint = {
                        x: snapped.x, y: snapped.y, lng: snapped.lng, lat: snapped.lat, zoom: z, placedAt: now,
                    };
                    setCheckpoint(cp);
                    lastPlacementAtRef.current = now;

                    // add/update marker
                    const lib = (window as any).maplibregl || (await import("maplibre-gl")).default;
                    if (!markerRef.current) {
                        const el = makeMarkerEl();
                        markerElRef.current = el;
                        markerRef.current = new lib.Marker({ element: el, anchor: "bottom" })
                            .setLngLat([cp.lng, cp.lat])
                            .addTo(map);
                    } else {
                        markerRef.current.setLngLat([cp.lng, cp.lat]);
                        // quick re-pop animation
                        const el = markerElRef.current;
                        if (el) {
                            el.style.transform = "translateY(-6px) scale(0.92)";
                            requestAnimationFrame(() => { el.style.transform = "translateY(-6px) scale(1)"; });
                        }
                    }

                    // feedback
                    playPop(isMuted);
                    toast.success("Checkpoint set.", { duration: 1800 });

                    // NEW: open selection modal with meta
                    setSelectionTile(toTileMeta(cp.x, cp.y, z));
                    setSelectionOpen(true);
                });

                // Resize
                const onResize = () => map.resize();
                window.addEventListener("resize", onResize);
                map.once("remove", () => window.removeEventListener("resize", onResize));

                // Keyboard: ESC clears checkpoint
                const onKey = (ev: KeyboardEvent) => {
                    if (ev.key === "Escape") {
                        setCheckpoint(undefined);
                        if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; markerElRef.current = null; }
                    }
                };
                window.addEventListener("keydown", onKey);
                map.once("remove", () => window.removeEventListener("keydown", onKey));

                // initial sync for gp_* opacity vs zoom
                map.once("idle", syncOverlayVisibilityForZoom);
            });

            // prune cache when style changes
            map.on("styledata", () => {
                const style = map.getStyle?.();
                if (!style || !style.sources) return;
                const existing = new Set(Object.keys(style.sources).filter((k) => k.startsWith("gp_")));
                for (const id of currentIdsRef.current) {
                    if (!existing.has(id)) {
                        currentIdsRef.current.delete(id);
                        currentMetaRef.current.delete(id);
                    }
                }
            });
        })();

        return () => {
            destroyed = true;
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [center]);


    // Deep link: /map?x=&y=&z=
    useEffect(() => {
        if (typeof window === "undefined") return;
        const map = mapRef.current;
        if (!map) return;
        const url = new URL(window.location.href);
        const qx = url.searchParams.get("x");
        const qy = url.searchParams.get("y");
        const qz = url.searchParams.get("z");
        if (!qx || !qy || !qz) return;

        const x = Number(qx), y = Number(qy), z = Number(qz);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;

        // derive lat/lng for tile center at z
        const worldPxX = (x + 0.5) * TILE_SIZE;
        const worldPxY = (y + 0.5) * TILE_SIZE;
        const { lng, lat } = map.unproject({ x: worldPxX, y: worldPxY }, z);
        if (z >= MIN_INTERACT_ZOOM) {
            // place marker & center
            setTimeout(() => {
                flySmooth(map, [lng, lat], Math.max(z, MIN_INTERACT_ZOOM + 0.2), { speed: 0.65, curve: 1.35 });
                // place marker after flight begins
                setTimeout(() => {
                    const el = markerElRef.current ?? makeMarkerEl();
                    if (!markerRef.current) {
                        const lib = (window as any).maplibregl;
                        markerRef.current = new lib.Marker({ element: el, anchor: "bottom" })
                            .setLngLat([lng, lat])
                            .addTo(map);
                        markerElRef.current = el;
                    } else {
                        markerRef.current.setLngLat([lng, lat]);
                    }
                    setCheckpoint({ x, y, lng, lat, zoom: z, placedAt: Date.now() });
                }, 250);
            }, 200);
        } else {
            toast.message("Zoom in to select a tile.");
        }
    }, []);

    // Persist mute setting if you add a toggle later
    useEffect(() => {
        if (typeof window === "undefined") return;
        try { localStorage.setItem(MUTE_KEY, isMuted ? "1" : "0"); } catch { }
    }, [isMuted]);


    // ----------------- placements sync (unchanged, but with zoom-gate) -----------------


    // Sync placements → add/update/remove only what's necessary
    // Cache last placements signature to avoid doing work when nothing changed

    // Sync placements → add/update/remove only what's necessary
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.getStyle?.() || !map.isStyleLoaded?.()) return;

        // Early no-op if nothing changed (prevents churn)
        const sig = placementsSig(placements);
        if (sig === lastSigRef.current && currentIdsRef.current.size > 0) {
            // Still ensure opacity matches the toggle without scanning layers:
            for (const id of currentIdsRef.current) {
                const layerId = `${id}_layer`;
                if (map.getLayer(layerId)) {
                    map.setPaintProperty(layerId, "raster-opacity", overlaysVisible ? 1 : 0);
                }
            }
            return;
        }
        lastSigRef.current = sig;

        // 1) Build hit-test index
        indexRef.current.clear();
        placements.forEach((p) => indexRef.current.set(`${p.x}:${p.y}:${p.z}`, p));

        // 2) Desired ids + fingerprints at fixed z
        const wantIds = new Set<string>();
        const wantMeta = new Map<string, string>();
        for (const p of placements) {
            if (p.z !== TILE_ZOOM) continue;
            const id = artId(p.x, p.y, p.z);
            wantIds.add(id);
            wantMeta.set(id, fpPlacement(p));
        }

        // 3) Reconcile with current style sources (gp_* only)
        const style = map.getStyle();
        const existingSources = style?.sources ? Object.keys(style.sources) : [];
        const existingGpIds = new Set(existingSources.filter((k) => k.startsWith("gp_")));

        // Drop any local ids that aren't in the style anymore
        for (const id of Array.from(currentIdsRef.current)) {
            if (!existingGpIds.has(id)) {
                currentIdsRef.current.delete(id);
                currentMetaRef.current.delete(id);
            }
        }

        // 4) REMOVE stale ids from the style
        for (const id of existingGpIds) {
            if (!wantIds.has(id)) {
                const layerId = `${id}_layer`;
                if (map.getLayer(layerId)) map.removeLayer(layerId);
                if (map.getSource(id)) map.removeSource(id);
                currentIdsRef.current.delete(id);
                currentMetaRef.current.delete(id);
            }
        }

        // Helper: put new art layers above all basemap layers (top of stack)
        const addLayerOnTop = (layerSpec: any) => {
            const layers = map.getStyle()?.layers ?? [];
            // Insert at the end (top). If you want to insert just above labels, you could find a label id here.
            const beforeId = undefined;
            map.addLayer(layerSpec, beforeId);
        };

        // 5) ADD or UPDATE desired ids
        for (const p of placements) {
            if (p.z !== TILE_ZOOM) continue;

            const id = artId(p.x, p.y, p.z);
            const meta = fpPlacement(p);
            const layerId = `${id}_layer`;
            const bounds = tileBounds(p.x, p.y, p.z);

            if (!map.getSource(id)) {
                map.addSource(id, { type: "image", url: p.url, coordinates: bounds });
                addLayerOnTop({
                    id: layerId,
                    type: "raster",
                    source: id,
                    paint: { "raster-opacity": overlaysVisible ? 1 : 0 },
                });
                currentIdsRef.current.add(id);
                currentMetaRef.current.set(id, meta);
            } else {
                const prev = currentMetaRef.current.get(id);
                if (prev !== meta) {
                    const src = map.getSource(id) as any;
                    if (src?.updateImage) {
                        src.updateImage({ url: p.url, coordinates: bounds });
                    } else {
                        // Fallback if the source lost updateImage (e.g., style shenanigans):
                        if (map.getLayer(layerId)) map.removeLayer(layerId);
                        map.removeSource(id);
                        map.addSource(id, { type: "image", url: p.url, coordinates: bounds });
                        addLayerOnTop({
                            id: layerId,
                            type: "raster",
                            source: id,
                            paint: { "raster-opacity": overlaysVisible ? 1 : 0 },
                        });
                    }
                    currentMetaRef.current.set(id, meta);
                }
                // keep opacity in sync without scanning
                if (map.getLayer(layerId)) {
                    map.setPaintProperty(layerId, "raster-opacity", overlaysVisible ? 1 : 0);
                }
                currentIdsRef.current.add(id);
            }
        }
    }, [placements, overlaysVisible]);



    // Toggle visibility across our tracked overlay tiles only (no layer scan)
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded?.()) return;

        for (const id of currentIdsRef.current) {
            const layerId = `${id}_layer`;
            if (map.getLayer(layerId)) {
                map.setPaintProperty(layerId, "raster-opacity", overlaysVisible ? 1 : 0);
            }
        }
    }, [overlaysVisible]);


    // Handlers for controls
    const zoomIn = () => mapRef.current?.zoomIn({ duration: 200 });
    const zoomOut = () => mapRef.current?.zoomOut({ duration: 200 });
    const toggleOverlays = () => setOverlaysVisible((v) => !v);
    const showHelp = () => {
        window.alert("Pan/zoom the map. Click an empty tile to place. Toggle overlay to show/hide artwork.");
    };
    const openSocial = () => {
        const url = typeof window !== "undefined" ? window.location.href : "https://genplace.ai";
        const text = encodeURIComponent("Check out the GenPlace collaborative AI canvas!");
        window.open(`https://x.com/intent/tweet?text=${text}%20${encodeURIComponent(url)}`, "_blank");
    };

    // Optional: route or modal for login
    const onLogin = () => {
        // Replace with your auth modal or router push
        window.location.href = "/login";
    };

    // NEW: locate me
    // Locate me -> zoom-out → slide → zoom-in
    // Locate me
    const locateMe = () => {
        if (!("geolocation" in navigator)) {
            window.alert("Geolocation is not supported by your browser.");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                // A local “land” zoom level feels right around 11
                flySmooth(mapRef.current, [longitude, latitude], 11, {
                    speed: 0.7,      // slower & smoother
                    curve: 1.35,     // gentle curve
                    // maxDuration: 2500, // optionally cap long flights
                });
            },
            (err) => {
                console.warn("Geolocation error:", err);
                window.alert("Unable to get your location. Please allow location access in your browser.");
            },
            { enableHighAccuracy: false, maximumAge: 10_000, timeout: 7_000 }
        );
    };

    // Random explorer
    const flyRandom = () => {
        const lat = (Math.random() * 160) - 80;   // -80..+80
        const lng = (Math.random() * 360) - 180;  // -180..+180
        // Regional zoom feels explorative around ~4.5
        flySmooth(mapRef.current, [lng, lat], 4.5, {
            speed: 0.65,   // slightly slower for long hops
            curve: 1.35,
            // maxDuration: 3000,
        });
    };


    return (
        <div ref={containerRef} className="h-dvh w-dvw" style={{ position: "relative" }}>
            {/* Floating control bar (top-left) */}
            <TopLeftControls
                onHelp={showHelp}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onShare={openSocial}
                overlaysVisible={overlaysVisible}
                onToggleOverlays={toggleOverlays}
            />

            {/* Top-right controls (column) */}
            <TopRightControls onLogin={onLogin}
                onLocateMe={locateMe}
                onRandom={flyRandom}
            />
            {/* Or: <TopRightControls loginHref="/auth" /> */}

            {/* Bottom-center Create button */}
            {/* Bottom-center Create button — hidden when modal is open */}
            {!selectionOpen && (
                <BottomCenterAction
                    label="Create"
                    icon="wand"
                    onClick={onCreate ?? (() => window.dispatchEvent(new CustomEvent("genplace:create")))}
                    disabled={!hasTokens}
                    cooldownText={cooldownLabel}
                    tooltip="Type a prompt → generate → place it on the map"
                />
            )}

            {/* NEW: Bottom-center Selection Modal */}
            <SelectionModal
                open={!!selectionOpen && !!selectionTile}
                onClose={() => setSelectionOpen(false)}
                tile={selectionTile}
                onPrimary={createForTile}
                onShare={shareTile}
                canCreate={!!hasTokens}
                disabledReason={cooldownLabel}
            />
        </div>
    );
}

export { TILE_ZOOM };

// src/components/map/maplibre-world.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GridPlacement } from "./types";
import { TopLeftControls } from "./top-left-controls";
import { TopRightControls } from "./top-right-controls"; // ⬅️ add this import

// ---- CONFIG ----
const TILE_ZOOM = 5;
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
// ----------------

// Slippy helpers
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

// === Component ===
type Props = {
    placements: GridPlacement[];
    onClickEmpty: (xy: { x: number; y: number }) => void;
    onClickPlacement: (p: GridPlacement) => void;
    sizePx: 128 | 256 | 512;
};

export function MapLibreWorld({ placements, onClickEmpty, onClickPlacement }: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<any>(null);
    const center = useMemo<[number, number]>(() => [0, 20], []);
    const indexRef = useRef<Map<string, GridPlacement>>(new Map());
    const [overlaysVisible, setOverlaysVisible] = useState(true);
    // Track what we currently have on the map to avoid churn
    const currentIdsRef = useRef<Set<string>>(new Set());
    const currentMetaRef = useRef<Map<string, string>>(new Map()); // id -> fingerprint
    const lastSigRef = useRef<string>("");

    useEffect(() => {
        let destroyed = false;
        (async () => {
            const lib = await import("maplibre-gl");
            if (destroyed) return;
            const maplibregl = (lib as any).default ?? lib;

            const map = new maplibregl.Map({
                container: containerRef.current!,
                style: STYLE_URL,
                center,
                zoom: 3,
                attributionControl: true,
                pitch: 0,
                maxPitch: 0,
                bearing: 0,
                dragRotate: false,
                pitchWithRotate: false,
                touchPitch: false,
            });
            mapRef.current = map;

            map.on("load", () => {
                installDeclutterHooks(map);
                map.getCanvas().style.cursor = "grab";

                map.on("click", (e: any) => {
                    const lng = e.lngLat.lng;
                    const lat = e.lngLat.lat;
                    const x = lon2tile(lng, TILE_ZOOM);
                    const y = lat2tile(lat, TILE_ZOOM);
                    const hit = indexRef.current.get(`${x}:${y}:${TILE_ZOOM}`);
                    hit ? onClickPlacement(hit) : onClickEmpty({ x, y });
                });

                const onResize = () => map.resize();
                window.addEventListener("resize", onResize);
                map.once("remove", () => window.removeEventListener("resize", onResize));
            });
            // If the style is replaced (e.g., switch styles), clear local caches.
            // Our next placements sync will re-add only what's needed.
            map.on("styledata", () => {
                const style = map.getStyle?.();
                if (!style || !style.sources) return;
                const existing = new Set(Object.keys(style.sources).filter((k) => k.startsWith("gp_")));
                // prune anything not in the style anymore
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
    }, [center, onClickEmpty, onClickPlacement]);

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
            <TopRightControls onLogin={onLogin} />
            {/* Or: <TopRightControls loginHref="/auth" /> */}
        </div>
    );
}

export { TILE_ZOOM };

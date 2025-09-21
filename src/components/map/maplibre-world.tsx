// src/components/map/maplibre-world.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import type { GridPlacement } from "./types";

// ---- CONFIG ----
const TILE_ZOOM = 5;
// OpenFreeMap style (vector / free / OSS)
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
// or try another: "https://tiles.openfreemap.org/styles/liberty" bright

// ----------------

// Slippy helpers
function lon2tile(lon: number, z: number) {
    return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}
function lat2tile(lat: number, z: number) {
    const rad = (lat * Math.PI) / 180;
    return Math.floor(
        ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z)
    );
}
function tile2lon(x: number, z: number) {
    return (x / Math.pow(2, z)) * 360 - 180;
}
function tile2lat(y: number, z: number) {
    const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

// Compute geographic quad for a slippy tile
function tileBounds(x: number, y: number, z: number): [[number, number], [number, number], [number, number], [number, number]] {
    const west = tile2lon(x, z);
    const east = tile2lon(x + 1, z);
    const north = tile2lat(y, z);
    const south = tile2lat(y + 1, z);
    // MapLibre wants [lng, lat] corners in clockwise order
    return [
        [west, north], // top-left
        [east, north], // top-right
        [east, south], // bottom-right
        [west, south], // bottom-left
    ];
}

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

    // keep local index to find a placement by (x,y,z)
    const indexRef = useRef<Map<string, GridPlacement>>(new Map());

    // Mount the map
    useEffect(() => {
        let maplibregl: any;
        let destroyed = false;

        (async () => {
            const lib = await import("maplibre-gl");
            if (destroyed) return;
            maplibregl = lib.default ?? lib;

            const map = new maplibregl.Map({
                container: containerRef.current!,
                style: STYLE_URL,
                center,
                zoom: 3,
                attributionControl: true,
                // keep it flat
                pitch: 0,
                maxPitch: 0,
                bearing: 0,
                // stop rotation/tilt gestures from the start
                dragRotate: false,
                pitchWithRotate: false,
                touchPitch: false,         // you already had this
                // (optional) projection: 'mercator' // default; just being explicit
            });
            console.log(map)
            mapRef.current = map;

            map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");

            map.on("load", () => {
                // Hide busy layers: airports, POIs, tree/landcover labels, etc.
                // const ids = map.getStyle().layers.map((l: any) => l.id) as string[];
                // const hideIf = (test: (id: string) => boolean) => {
                //     ids.forEach((id) => {
                //         if (test(id) && map.getLayer(id)) {
                //             map.setLayoutProperty(id, "visibility", "none");
                //         }
                //     });
                // };

                // // These predicates are generous to handle differences across styles
                // const airports = /aeroway|airport|runway|taxiway/i;
                // const pois = /poi|amenity|poi-label|place_of_worship|mbxpoi/i;
                // const trees = /tree|landcover_wood|wood|forest|green|landuse|nature/i;  //park

                // hideIf((id) => airports.test(id));
                // hideIf((id) => pois.test(id));
                // hideIf((id) => trees.test(id));
                // --- Inspect layers once to know what's available ---
                const layers = (map.getStyle().layers || []) as any[];

                // Helper: hide by predicate
                const hideIf = (pred: (l: any) => boolean) => {
                    layers.forEach(l => {
                        if (pred(l) && map.getLayer(l.id)) {
                            map.setLayoutProperty(l.id, "visibility", "none");
                        }
                    });
                };
                // 1) HIDE BUILDINGS (all forms)
                hideIf(l =>
                    l["source-layer"] === "building" ||                            // OpenMapTiles schema
                    /building|building_outline|building-?number|housenumber/i.test(l.id) ||
                    l.type === "fill-extrusion"                                    // any 3D buildings, regardless of id
                );
                // 2) HIDE BUSY POIs (but keep place/transport labels if you want)
                hideIf(l =>
                    /(^|_)poi(_|$)|amenity|mbxpoi|place_of_worship/i.test(l.id) &&
                    !/place-label|place_label|transport|airport_label/i.test(l.id)
                );
                // 3) HIDE AIRPORT SURFACES (runways/taxiways), keep airport label if desired
                hideIf(l => /aeroway|runway|taxiway/i.test(l.id) && !/airport_label/i.test(l.id));
                // 4) TREES: keep parks/greens, only hide tree SYMBOLS if present
                // Many styles have separate point/symbol layers for individual trees; keep polygon greens!
                hideIf(l =>
                    /tree|wood_symbol/i.test(l.id) &&                               // only symbols
                    !/landuse|landcover|park|forest|wood|grass|meadow/i.test(l.id)  // never hide polygon greens
                );
                // Optional: if the style defines terrain, ensure flat look
                try { map.setTerrain(null as any); } catch { }
                // extra belts & braces: disable any handlers that might re-enable tilt/rotate
                map.dragRotate.disable();
                map.touchZoomRotate.disableRotation();
                map.keyboard?.disableRotation?.();

                // if the chosen style includes terrain, force it off for a perfectly flat map
                try { map.setTerrain(null as any); } catch { }

                // Optional: tone down admin boundaries/minor roads if needed
                // hideIf(id => /boundary-admin|minor_road|service|track/.test(id));

                // Cursor feedback on hover
                map.getCanvas().style.cursor = "grab";

                // Click-to-place
                map.on("click", (e: any) => {
                    const lng = e.lngLat.lng;
                    const lat = e.lngLat.lat;
                    const x = lon2tile(lng, TILE_ZOOM);
                    const y = lat2tile(lat, TILE_ZOOM);
                    const key = `${x}:${y}:${TILE_ZOOM}`;
                    const hit = indexRef.current.get(key);
                    if (hit) onClickPlacement(hit);
                    else onClickEmpty({ x, y });
                });

                // Resize handling
                const onResize = () => map.resize();
                window.addEventListener("resize", onResize);
                map.once("remove", () => window.removeEventListener("resize", onResize));
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

    // Sync placements → (image sources + layers)
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // Build index for hit-testing
        indexRef.current.clear();
        placements.forEach((p) => indexRef.current.set(`${p.x}:${p.y}:${p.z}`, p));

        // Track what should exist
        const wantIds = new Set<string>();
        placements.forEach((p) => {
            if (p.z !== TILE_ZOOM) return; // we render at fixed z
            const id = `gp_${p.x}_${p.y}_${p.z}`;
            wantIds.add(id);

            // add/update image source
            if (!map.getSource(id)) {
                map.addSource(id, {
                    type: "image",
                    url: p.url,
                    coordinates: tileBounds(p.x, p.y, p.z),
                });
                map.addLayer({
                    id: `${id}_layer`,
                    type: "raster",
                    source: id,
                    paint: { "raster-opacity": 1 },
                });
            } else {
                // Update coordinates or URL if changed
                const src = map.getSource(id);
                if (src && src.updateImage) {
                    (src as any).updateImage({
                        url: p.url,
                        coordinates: tileBounds(p.x, p.y, p.z),
                    });
                }
            }
        });

        // Remove any stale sources/layers
        (map.getStyle().layers as any[]).forEach((layer: any) => {
            if (!layer.id.startsWith("gp_")) return;
            const base = layer.id.replace(/_layer$/, "");
            if (!wantIds.has(base)) {
                if (map.getLayer(layer.id)) map.removeLayer(layer.id);
                if (map.getSource(base)) map.removeSource(base);
            }
        });
    }, [placements]);

    return <div ref={containerRef} className="h-dvh w-dvw" style={{ position: "relative" }} />;
}

export { TILE_ZOOM };

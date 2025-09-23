"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { GridPlacement } from "@/components/map/types";
import { PromptDrawer } from "@/components/map/prompt-drawer"; // when ready

const MapLibreWorld = dynamic(
    () => import("@/components/map/maplibre-world").then((m) => m.MapLibreWorld),
    { ssr: false }
);

export default function MapPage() {
    const [selectedEmpty, setSelectedEmpty] = useState<{ x: number; y: number } | null>(null);
    const [details, setDetails] = useState<GridPlacement | null>(null);
    const [size, setSize] = useState<128 | 256 | 512>(256);
    const [placements, setPlacements] = useState<GridPlacement[]>([]);
    const [hasTokens, setHasTokens] = useState(true); // TODO: wire to cooldown logic

    // Example: open the drawer without preselected tile (free-placement flow)
    const openCreate = () => {
        // If your drawer requires coords, you could use map center → slippy tile here later.
        setSelectedEmpty(null);
        // show drawer UI
        // setDrawerOpen(true);
    };

    // Optional: listen to the custom event if you don't pass onCreate
    useEffect(() => {
        const h = () => openCreate();
        window.addEventListener("genplace:create", h as any);
        return () => window.removeEventListener("genplace:create", h as any);
    }, []);

    const handlePlace = (p: GridPlacement) => {
        setPlacements((prev) => [...prev.filter((q) => !(q.x === p.x && q.y === p.y && q.z === p.z)), p]);
        setSelectedEmpty(null);
    };

    return (
        <div className="h-dvh w-screen overflow-hidden">
            <MapLibreWorld
                sizePx={size}
                placements={placements}
                onClickEmpty={(xy) => setSelectedEmpty(xy)}
                onClickPlacement={(p) => setDetails(p)}
                onCreate={openCreate}           // ⬅️ wire Create → Drawer
                hasTokens={hasTokens}           // ⬅️ control disabled state
                cooldownLabel="Out of tokens — regenerates in 2:14"
            />

            {/* Bring this back when ready */}
            <PromptDrawer
                tile={selectedEmpty}
                size={size}
                onClose={() => setSelectedEmpty(null)}
                onPlaced={handlePlace}
            />
        </div>
    );
}



//   <TileDetailsModal placement={details} onClose={() => setDetails(null)} /> */}

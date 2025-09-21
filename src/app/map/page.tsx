// src/app/map/page.tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { GridPlacement } from "@/components/map/types";

const MapLibreWorld = dynamic(
    () => import("@/components/map/maplibre-world").then(m => m.MapLibreWorld),
    { ssr: false }
);

export default function MapPage() {
    const [selectedEmpty, setSelectedEmpty] = useState<{ x: number; y: number } | null>(null);
    const [details, setDetails] = useState<GridPlacement | null>(null);
    const [size, setSize] = useState<128 | 256 | 512>(256);
    const [placements, setPlacements] = useState<GridPlacement[]>([]);

    const handlePlace = (p: GridPlacement) => {
        setPlacements(prev => [...prev.filter(q => !(q.x === p.x && q.y === p.y && q.z === p.z)), p]);
        setSelectedEmpty(null);
    };

    return (
        <div className="h-dvh w-screen overflow-hidden">
            <MapLibreWorld
                sizePx={size}
                placements={placements}
                onClickEmpty={(xy) => setSelectedEmpty(xy)}
                onClickPlacement={(p) => setDetails(p)}
            />

            {/* bring these back when ready; they’ll float on top if fixed/absolute */}
            {/* <PromptDrawer tile={selectedEmpty} size={size} onClose={() => setSelectedEmpty(null)} onPlaced={handlePlace} />
      <TileDetailsModal placement={details} onClose={() => setDetails(null)} /> */}
        </div>
    );
}

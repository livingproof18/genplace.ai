"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const PHASES = [
    "Interpreting your prompt…",
    "Sketching the composition…",
    "Adding details and lighting…",
    "Refining the final image…",
];

export function GenerationPhases({
    active,
    className,
}: {
    active: boolean;
    className?: string;
}) {
    const [index, setIndex] = React.useState(0);

    React.useEffect(() => {
        if (!active) return;

        setIndex(0);
        const interval = setInterval(() => {
            setIndex((i) => (i + 1) % PHASES.length);
        }, 1600);

        return () => clearInterval(interval);
    }, [active]);

    if (!active) return null;

    return (
        <div className={cn("relative h-5 overflow-hidden", className)}>
            {PHASES.map((text, i) => (
                <p
                    key={text}
                    className={cn(
                        "absolute left-0 top-0 w-full text-xs text-muted-foreground transition-all duration-500 ease-out",
                        i === index
                            ? "opacity-100 translate-y-0"
                            : "opacity-0 translate-y-2"
                    )}
                >
                    {text}
                </p>
            ))}
        </div>
    );
}

// src/components/map/onboarding.tsx
"use client";

import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

export function OnboardingCoach() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const seen = typeof window !== "undefined" && localStorage.getItem("gp_onboard_v1");
        if (!seen) {
            setShow(true);
            localStorage.setItem("gp_onboard_v1", "1");
        }
    }, []);

    if (!show) return null;

    return (
        <TooltipProvider delayDuration={0}>
            <div className="fixed bottom-4 left-4 z-[60]">
                <Tooltip open>
                    <TooltipTrigger asChild>
                        <div className="rounded-full h-9 w-9 grid place-items-center border bg-card">
                            <HelpCircle className="h-5 w-5" />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[260px]">
                        <p className="font-medium">Welcome to the canvas</p>
                        <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground space-y-1">
                            <li>Pan/zoom to explore</li>
                            <li>Click an <b>empty</b> tile to place</li>
                            <li>Use the drawer to generate & preview</li>
                        </ul>
                    </TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    );
}

"use client";

import { Wand2, Sparkles, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";

type Props = {
    label?: string;
    onClick?: () => void;
    disabled?: boolean;
    tooltip?: string;        // hover text
    cooldownText?: string;   // shown to screen readers + title when disabled
    icon?: "wand" | "sparkles";
    className?: string;
};

export function BottomCenterAction({
    label = "Create",
    onClick,
    disabled = false,
    tooltip = "Type a prompt → generate → place it on the map",
    cooldownText = "You're out of tokens — regenerates soon",
    icon = "wand",
    className,
}: Props) {
    const Icon = icon === "sparkles" ? Sparkles : Wand2;

    return (
        <div
            className={cn(
                "pointer-events-none fixed left-1/2 -translate-x-1/2 z-[1000]",
                "bottom-6 sm:bottom-7",
                className
            )}
            aria-live="polite"
        >
            <button
                type="button"
                onClick={disabled ? undefined : onClick}
                aria-label="Create new image"
                title={disabled ? cooldownText : tooltip}
                // className="bottom-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]"
                className={cn(
                    // base pill
                    "pointer-events-auto rounded-full",
                    "min-w-[200px] h-14 px-5 sm:min-w-[220px] sm:h-14",
                    "inline-flex items-center justify-center gap-2",
                    "bg-primary text-primary-foreground",
                    "border border-white/10",
                    // glow & hover
                    "btn-glow transition will-change-transform",
                    "motion-safe:hover:scale-[1.03] hover:brightness-110",
                    // disabled
                    disabled &&
                    "bg-primary/50 text-primary-foreground/70 cursor-not-allowed hover:scale-100 hover:brightness-100",
                    // focus ring
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
                disabled={disabled}
            >
                <Icon className="h-[18px] w-[18px]" aria-hidden />
                <span className="text-base font-medium">{label}</span>

                {/* subtle lock overlay when disabled */}
                {disabled && (
                    <span className="ml-2 inline-flex items-center text-xs opacity-80">
                        <Lock className="h-[14px] w-[14px] mr-1" />
                        Locked
                    </span>
                )}
            </button>

            {/* mobile width helper: full-width on tiny screens */}
            <style jsx>{`
        @media (max-width: 480px) {
          button {
            width: min(90vw, 500px);
          }
        }
      `}</style>
        </div>
    );
}

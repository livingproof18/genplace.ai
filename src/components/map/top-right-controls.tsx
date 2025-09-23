// src/components/map/top-right-controls.tsx
"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocateFixed, Shuffle } from "lucide-react";

type Props = {
    onLogin?: () => void;      // optional handler if you open a modal
    loginHref?: string;        // default route if no handler
    onLocateMe?: () => void;   // NEW
    onRandom?: () => void;     // NEW
};

export function TopRightControls({
    onLogin,
    loginHref = "/login",
    onLocateMe,
    onRandom,
}: Props) {
    return (
        <div className="pointer-events-none fixed top-3 right-3 z-[1000] flex flex-col gap-2 items-end">
            {/* Login (primary pill) */}
            {onLogin ? (
                <button
                    onClick={onLogin}
                    className="pointer-events-auto h-11 px-5 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition border border-white/10"
                    aria-label="Login"
                    title="Login"
                >
                    Login
                </button>
            ) : (
                <Link
                    href={loginHref}
                    className="pointer-events-auto h-11 px-5 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition border border-white/10 inline-flex items-center"
                    aria-label="Login"
                    title="Login"
                >
                    Login
                </Link>
            )}

            {/* Theme toggle (glass) */}
            <div className="pointer-events-auto rounded-full border bg-background/70 backdrop-blur shadow-md overflow-hidden">
                <ThemeToggle />
            </div>

            {/* Locate me */}
            <button
                onClick={onLocateMe}
                className="pointer-events-auto h-11 w-11 grid place-items-center rounded-full border bg-background/70 backdrop-blur shadow-md hover:bg-background/90 transition"
                aria-label="Go to my location"
                title="Go to my location"
            >
                <LocateFixed className="h-5 w-5" />
            </button>

            {/* Random location */}
            <button
                onClick={onRandom}
                className="pointer-events-auto h-11 w-11 grid place-items-center rounded-full border bg-background/70 backdrop-blur shadow-md hover:bg-background/90 transition"
                aria-label="Take me somewhere random"
                title="Take me somewhere random"
            >
                <Shuffle className="h-5 w-5" />
            </button>
        </div>
    );
}

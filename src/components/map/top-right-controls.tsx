// src/components/map/top-right-controls.tsx
"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocateFixed, Shuffle } from "lucide-react";

type Props = {
    onLogin?: () => void;
    loginHref?: string;
    onLocateMe?: () => void;
    onRandom?: () => void;
};

export function TopRightControls({
    onLogin,
    loginHref = "/login",
    onLocateMe,
    onRandom,
}: Props) {
    return (
        <div className="pointer-events-none fixed top-3 right-3 z-[1000] flex flex-col gap-2 items-end ">
            {/* Login — solid primary (better legibility) */}
            {onLogin ? (
                <button
                    onClick={onLogin}
                    className="pointer-events-auto control-solid-primary control-pill"
                    aria-label="Login"
                    title="Login"
                >
                    Login
                </button>
            ) : (
                <Link
                    href={loginHref}
                    className="pointer-events-auto control-solid-primary control-pill"
                    aria-label="Login"
                    title="Login"
                >
                    Login
                </Link>
            )}

            {/* Theme toggle — compact glass */}
            <div className="pointer-events-auto control-glass">
                <ThemeToggle />
            </div>

            {/* Locate me — compact glass icon */}
            <button
                onClick={onLocateMe}
                className="pointer-events-auto control-glass control-icon"
                aria-label="Go to my location"
                title="Go to my location"
            >
                <LocateFixed className="icon-4" />
            </button>

            {/* Random location — compact glass icon */}
            <button
                onClick={onRandom}
                className="pointer-events-auto control-glass control-icon"
                aria-label="Take me somewhere random"
                title="Take me somewhere random"
            >
                <Shuffle className="icon-4" />
            </button>
        </div>
    );
}

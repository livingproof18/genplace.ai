// src/components/map/top-right-controls.tsx
"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

type Props = {
    onLogin?: () => void;      // optional handler (if you wire a modal); otherwise we use href
    loginHref?: string;        // default: "/login"
};

export function TopRightControls({ onLogin, loginHref = "/login" }: Props) {
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
                {/* Reuse your existing ThemeToggle button */}
                <ThemeToggle />
            </div>
        </div>
    );
}

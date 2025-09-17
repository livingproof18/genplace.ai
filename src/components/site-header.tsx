// src/components/site-header.tsx
"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
    return (
        <header className="sticky top-0 z-40 w-full bg-background/50 backdrop-blur">
            <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-400 to-blue-600" />
                    <span className="font-semibold tracking-tight">GenPlace</span>
                </Link>
                <div className="flex items-center gap-2">
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}

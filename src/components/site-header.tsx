// src/components/site-header.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
    return (
        <header className="sticky top-0 z-40 w-full bg-transparent backdrop-blur-md">
            <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <Image
                        src="/logo-genplace.svg"
                        alt="GenPlace logo"
                        width={34}
                        height={34}
                        priority
                    />
                    <span className="font-bold text-xl tracking-tight">GenPlace</span>
                </Link>
                <div className="flex items-center gap-2">
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}

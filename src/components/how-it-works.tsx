// src/components/how-it-works.tsx
import { Card } from "@/components/ui/card";
import { Wand2, MessageSquareText, MapPinned } from "lucide-react";

const steps = [
    {
        icon: MessageSquareText,
        title: "Prompt",
        desc: "Describe what you want to see. One line is enough.",
    },
    {
        icon: Wand2,
        title: "Generate",
        desc: "We create an image using AI, instantly.",
    },
    {
        icon: MapPinned,
        title: "Place",
        desc: "Claim a tile on the shared canvas. Watch it go live.",
    },
];

export function HowItWorks() {
    return (
        <section className="mx-auto max-w-7xl px-4">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-6">How it works</h2>
            <div className="grid md:grid-cols-3 gap-4">
                {steps.map(({ icon: Icon, title, desc }) => (
                    <Card key={title} className="p-5 bg-card/70">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-9 w-9 grid place-items-center rounded-lg bg-primary/15 border">
                                <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <h3 className="font-semibold">{title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">{desc}</p>
                    </Card>
                ))}
            </div>
        </section>
    );
}

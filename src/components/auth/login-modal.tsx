"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createBrowserClient } from "@/lib/supabase/browser";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LoginModal({ open, onOpenChange }: Props) {
  const supabase = React.useMemo(() => createBrowserClient(), []);

  const handleLogin = async (provider: "google" | "discord") => {
    if (typeof window === "undefined") return;
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold">
            GP
          </div>
          <div className="text-lg font-semibold">GenPlace</div>
        </div>

        <div className="mt-4 grid gap-3">
          <Button className="w-full" onClick={() => handleLogin("google")}>
            Continue with Google
          </Button>
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => handleLogin("discord")}
          >
            Continue with Discord
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

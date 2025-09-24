"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-right"            // move stack to top-right
      richColors                      // colored bg for info/success/error
      closeButton                     // show × on each toast
      className="toaster"
      toastOptions={{
        classNames: {
          toast: "rounded-xl border border-white/10 shadow-lg",
          title: "text-foreground",
          description: "text-foreground/80",
          actionButton: "rounded-md bg-foreground text-background",
          cancelButton: "rounded-md border border-white/20",
        },
      }}
      /* For plain toast.message(): use SOLID bg (not glass) */
      style={
        {
          "--normal-bg": "hsl(var(--card))",
          "--normal-text": "hsl(var(--card-foreground))",
          "--normal-border": "hsl(var(--border))",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }

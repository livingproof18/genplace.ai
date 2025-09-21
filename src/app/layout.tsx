// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GenPlace",
  description: "Prompts come alive.",
  icons: {
    icon: [
      { url: "/favicon.ico" }, // default favicon
      { url: "/logo-genplace.svg", type: "image/svg+xml" }, // scalable vector
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }, // iOS
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "GenPlace",
    description: "The place where prompts come alive.",
    url: "https://genplace.com", // replace with your actual domain
    siteName: "GenPlace",
    images: [
      {
        url: "/logo-genplace.png", // 512×512 PNG
        width: 512,
        height: 512,
        alt: "GenPlace Logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "GenPlace",
    description: "Prompts come alive.",
    images: ["/logo-genplace.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

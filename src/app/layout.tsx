import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

// Inter is the de-facto body font for modern developer documentation portals
// (Stripe, Linear, Vercel, Mintlify, Resend all use Inter or an Inter-adjacent face).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// JetBrains Mono is purpose-built for code — clearer digit disambiguation than
// IBM Plex Mono and ships with ligatures off by default (correct for API docs).
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Space Grotesk stays for display headings — it has the geometric character that
// distinguishes the brand voice without sacrificing legibility.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Musicosy Developer Portal",
    template: "%s — Musicosy Docs",
  },
  description:
    "Musicosy platform architecture and API reference: 27 bounded domains, 413 endpoints, 7 documented modals, 74 catalogued UI components.",
  keywords: [
    "Musicosy",
    "Developer Portal",
    "API Reference",
    "Domain Architecture",
    "OpenAPI",
  ],
  authors: [{ name: "Musicosy" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Musicosy Developer Portal",
    description:
      "27 bounded domains, 413 endpoints, 7 modals, 74 catalogued UI components.",
    siteName: "Musicosy",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Musicosy Developer Portal",
    description:
      "27 bounded domains, 413 endpoints, 7 modals, 74 catalogued UI components.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

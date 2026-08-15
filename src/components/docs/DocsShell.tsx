"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { SearchDialog } from "@/components/docs/SearchDialog";
import { GetKeyCta } from "@/components/docs/GetKeyCta";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/docs/getting-started/quickstart", label: "Getting Started" },
  { href: "/docs/api-reference", label: "API Reference" },
  { href: "/docs/appendices/feature-index", label: "Feature Index" },
] as const;

export function DocsShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname() ?? "";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="flex h-14 w-full items-center gap-4 px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center border border-foreground font-mono text-[11px] font-bold">
              M
            </span>
            <span className="font-display text-sm font-semibold tracking-tight">
              Musicosy <span className="text-muted-foreground">Docs</span>
            </span>
          </Link>
          <nav className="ml-6 hidden items-center gap-5 md:flex">
            {NAV_LINKS.map((link) => {
              const active =
                link.href === "/docs"
                  ? pathname === "/docs" || pathname.startsWith("/docs/")
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-[13px] font-medium transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto hidden sm:block">
            <SearchDialog />
          </div>
          <button
            className="ml-auto rounded-sm border border-border p-1.5 lg:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </header>

      {/*
        Body: full-bleed flex layout.
        - Sidebar is `sticky` and pinned to the header height. It uses
          `no-scrollbar` so any internal overflow scrolls invisibly —
          the user never sees a scrollbar gutter next to the content.
        - Main column is full-bleed (extends to the right viewport edge).
          Inside main, a centered reading column (`mx-auto max-w-[1100px]`)
          keeps line lengths comfortable while letting the layout breathe
          edge-to-edge — the "full bleed + centered text" pattern used by
          Stripe / Linear / Vercel docs.
      */}
      <div className="flex w-full flex-1">
        <aside className="no-scrollbar sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[296px] shrink-0 overflow-y-auto border-r border-border px-5 py-8 lg:block">
          <DocsSidebar />
          <GetKeyCta />
        </aside>

        {mobileOpen && (
          <div className="no-scrollbar fixed inset-x-0 top-14 bottom-0 z-30 overflow-y-auto border-t border-border bg-background p-4 lg:hidden">
            <div className="mb-4">
              <SearchDialog />
            </div>
            <DocsSidebar onNavigate={() => setMobileOpen(false)} />
            <div className="mt-6">
              <GetKeyCta />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1100px] px-6 py-10 sm:px-10 lg:px-16 lg:py-14">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

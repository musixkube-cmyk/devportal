"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { sidebarTree, type SidebarItem } from "@/lib/api-reference";
import { cn } from "@/lib/utils";

/**
 * New docs sidebar — proper Stripe/Linear/Vercel-style tree:
 *
 *   Getting Started
 *     Quickstart
 *     Authentication
 *     ...
 *   Guides
 *     Shared State Machines
 *     Domain Ownership Matrix
 *   API Reference
 *     Identity & Social Graph                ← collapsible
 *       Users
 *       Profiles
 *       Follows
 *     Feed & Discovery                       ← collapsible
 *       Feed
 *       Recommendations
 *       ...
 *     ... 27 domains ...
 *   Appendices
 *     UI Components
 *     Modals
 *     Feature Index
 *
 * Active domain is auto-expanded; others stay collapsed. User can click
 * any group chevron to toggle. Sidebar is sticky and never shows a
 * scrollbar (see `no-scrollbar` utility on the <aside> in DocsShell).
 */
export function DocsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";

  // Track which domain groups are open. Initialize from the route —
  // the domain that matches the current URL is open by default.
  const initialOpen: Record<string, boolean> = {};
  for (const group of sidebarTree) {
    if (group.label !== "API Reference") continue;
    for (const item of group.items) {
      if (item.type !== "group") continue;
      // Auto-open if this domain is in the URL
      if (item.href && pathname.startsWith(item.href)) {
        initialOpen[item.href] = true;
      }
    }
  }
  const [openGroups, setOpenGroups] =
    useState<Record<string, boolean>>(initialOpen);

  const toggle = (key: string) =>
    setOpenGroups((s) => ({ ...s, [key]: !s[key] }));

  const isActive = (href: string) => {
    if (href === "/docs") return pathname === "/docs";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <nav className="space-y-7 pb-8">
      {sidebarTree.map((group) => (
        <div key={group.label}>
          <p className="sidebar-group-label mb-2 px-2">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item, i) => (
              <li key={i}>
                <SidebarItemView
                  item={item}
                  isActive={isActive}
                  isOpen={(key) => openGroups[key] ?? false}
                  onToggle={toggle}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarItemView({
  item,
  isActive,
  isOpen,
  onToggle,
  onNavigate,
}: {
  item: SidebarItem;
  isActive: (href: string) => boolean;
  isOpen: (key: string) => boolean;
  onToggle: (key: string) => void;
  onNavigate?: () => void;
}) {
  if (item.type === "link") {
    const active = isActive(item.href);
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "sidebar-link block rounded-md px-2 py-1 transition-colors hover:bg-accent hover:text-foreground",
          active && "bg-accent text-foreground font-medium",
        )}
      >
        {item.label}
      </Link>
    );
  }

  // Group — collapsible
  const open = isOpen(item.href ?? item.label);
  const active = item.href ? isActive(item.href) : false;
  return (
    <div>
      <div className="flex items-center">
        {item.href ? (
          <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "sidebar-link min-w-0 flex-1 truncate rounded-md px-2 py-1 transition-colors hover:bg-accent hover:text-foreground",
              active && "text-foreground font-medium",
            )}
          >
            {item.label}
          </Link>
        ) : (
          <span className="sidebar-link min-w-0 flex-1 truncate px-2 py-1">
            {item.label}
          </span>
        )}
        <button
          type="button"
          onClick={() => item.href && onToggle(item.href)}
          aria-expanded={open}
          aria-label={open ? "Collapse" : "Expand"}
          className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn(
              "size-3 shrink-0 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </div>
      {open && item.children.length > 0 && (
        <ul className="mt-0.5 ml-2 space-y-0.5 border-l border-border pl-2">
          {item.children.map((child, ci) => {
            if (child.type !== "link") return null;
            const childActive = isActive(child.href);
            return (
              <li key={ci}>
                <Link
                  href={child.href}
                  onClick={onNavigate}
                  aria-current={childActive ? "page" : undefined}
                  className={cn(
                    "sidebar-link-child -ml-px block border-l border-transparent py-0.5 pl-3 transition-colors hover:border-foreground/40 hover:text-foreground",
                    childActive &&
                      "border-foreground text-foreground font-medium",
                  )}
                >
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { search } from "@/lib/docs";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hits = useMemo(() => search(query), [query]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-foreground/40 sm:w-64"
      >
        <Search className="size-3.5" />
        <span className="flex-1">Search docs…</span>
        <kbd className="font-mono text-[10px] text-muted-foreground">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search features, routes, endpoints…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {query ? "No matching features." : "Type to search 296 features."}
          </CommandEmpty>
          {hits.length > 0 && (
            <CommandGroup heading="Features">
              {hits.map((hit) => (
                <CommandItem
                  key={`${hit.sectionSlug}/${hit.slug}`}
                  value={`${hit.name} ${hit.sectionTitle}`}
                  onSelect={() => {
                    setOpen(false);
                    setQuery("");
                    router.push(`/docs/${hit.sectionSlug}/${hit.slug}`);
                  }}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="text-sm font-medium">{hit.name}</span>
                  <span className="line-clamp-1 font-mono text-[11px] text-muted-foreground">
                    {hit.sectionTitle}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

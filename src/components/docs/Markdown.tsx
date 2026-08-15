"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Render markdown documentation content with a documentation-appropriate
 * style: headings, paragraphs, lists, tables, fenced code blocks.
 *
 * Uses Tailwind typography utilities inline (no @tailwindcss/typography
 * plugin dependency). Each element gets a class tailored for docs.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div
      className={cn(
        "text-[15px] leading-relaxed text-foreground/90",
        // Headings
        "[&_h1]:mt-8 [&_h1]:mb-3 [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight",
        "[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:scroll-mt-24",
        "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-semibold [&_h3]:scroll-mt-24",
        "[&_h4]:mt-4 [&_h4]:mb-1.5 [&_h4]:font-medium [&_h4]:text-sm [&_h4]:uppercase [&_h4]:tracking-wide [&_h4]:text-muted-foreground",
        // Paragraphs
        "[&_p]:my-3 [&_p]:leading-relaxed",
        // Links
        "[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:opacity-80",
        // Lists
        "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1",
        "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1",
        "[&_li]:leading-relaxed",
        // Inline code
        "[&_code]:rounded-sm [&_code]:border [&_code]:border-border [&_code]:bg-code [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
        // Pre / code blocks
        "[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-border [&_pre]:bg-code [&_pre]:p-4 [&_pre]:text-[13px] [&_pre]:leading-relaxed",
        "[&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-foreground",
        // Blockquote
        "[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-foreground [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
        // Tables — proper docs table styling
        "[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-md [&_table]:border [&_table]:border-border [&_table]:text-sm",
        "[&_thead]:bg-surface",
        "[&_th]:border-b [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-mono [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground",
        "[&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
        "[&_tbody_tr:last-child_td]:border-b-0",
        // Horizontal rule
        "[&_hr]:my-6 [&_hr]:border-border",
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

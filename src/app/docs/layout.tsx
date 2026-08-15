import type { Metadata } from "next";
import { DocsShell } from "@/components/docs/DocsShell";

export const metadata: Metadata = {
  title: "Musicosy Docs",
  description:
    "Complete Musicosy platform reference: 296 features across 15 surfaces with routes, components, endpoints and permission rules.",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DocsShell>{children}</DocsShell>;
}

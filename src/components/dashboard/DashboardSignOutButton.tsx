"use client";

import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

export function DashboardSignOutButton() {
  const router = useRouter();
  const supabase = createBrowserClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/signin");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="mt-1 flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <LogOut className="size-3.5" />
      Sign out
    </button>
  );
}
